export const meta = {
  apiVersion: 1,
  key: "xai-relay",
  name: "Grok Imagine (Upstream)",
  description: {
    en: "Grok Imagine video generation through an upstream new-api gateway on /v1/video/generations",
    zh: "通过上游 new-api 网关的 /v1/video/generations 接口调用 Grok Imagine 视频生成",
  },
  version: "1.1.0",
  channelTypes: [60], // New API — an upstream gateway relaying grok-imagine-* over /v1/video/generations
  author: { name: "QuantumNous" },
  models: ["grok-imagine-video", "grok-imagine-video-1.5"],
  fetchMode: "per_task",
  usageSchema: {
    seconds: {
      type: "number",
      unit: "second",
      description: { en: "Requested video duration in seconds.", zh: "请求的视频时长，单位为秒。" },
    },
    resolution: {
      enum: ["480p", "720p", "1080p"],
      description: { en: "Requested output resolution.", zh: "请求的输出分辨率。" },
    },
  },
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
};

const MAX_DURATION_SECONDS = 15;
const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_RESOLUTION = "480p";
const DEFAULT_ASPECT_RATIO = "16:9";
const RESOLUTIONS = ["480p", "720p", "1080p"];
const SHORT_EDGE_PIXELS = { "480p": 480, "720p": 720, "1080p": 1080 };
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
const MAX_REFERENCE_IMAGES = 7;
const MAX_REFERENCE_AUDIOS = 3;
const MAX_IMAGE_BYTES = 20971520;
const MODEL_MAX_RESOLUTION = { "grok-imagine-video": "720p", "grok-imagine-video-1.5": "1080p" };

// The `xai` plugin and this one both claim grok-imagine-video on the shared
// /v1/videos and /v1/responses endpoints. Whichever decoder the host pins first
// produces the normalized request body that the *selected* provider's
// buildSubmitRequest then consumes, so the normalization below must stay
// byte-for-byte equivalent to plugins/tasks/xai/plugin.js. Only the wire
// translation in buildSubmitRequest / buildQueryRequest differs.

function trimmed(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toBoolean(value, field) {
  if (typeof value === "boolean") return value;
  const text = trimmed(value).toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  throw new Error(field + " must be a boolean");
}

function aspectRatio(width, height) {
  let left = width;
  let right = height;
  while (right) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  const ratio = width / left + ":" + height / left;
  return ASPECT_RATIOS.includes(ratio) ? ratio : "";
}

function parseSize(value) {
  const match = /^(\d{2,5})\s*[xX*]\s*(\d{2,5})$/.exec(trimmed(value));
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  const shortEdge = Math.min(width, height);
  let resolution = "1080p";
  if (shortEdge <= 540) resolution = "480p";
  else if (shortEdge <= 810) resolution = "720p";
  return { resolution: resolution, aspect_ratio: aspectRatio(width, height) };
}

function normalizeResolution(value) {
  const text = trimmed(value).toLowerCase();
  if (!text) return "";
  if (RESOLUTIONS.includes(text)) return text;
  const tiers = { 480: "480p", 720: "720p", 1080: "1080p", sd: "480p", hd: "720p", fhd: "1080p" };
  if (tiers[text]) return tiers[text];
  const size = parseSize(text);
  return size ? size.resolution : "";
}

function normalizeDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || Math.floor(seconds) !== seconds || seconds < 1 || seconds > MAX_DURATION_SECONDS) {
    throw new Error("duration must be a whole number of seconds between 1 and " + MAX_DURATION_SECONDS);
  }
  return seconds;
}

function cappedResolution(model, resolution, hasReferenceImages) {
  let ceiling = MODEL_MAX_RESOLUTION[model];
  if (!ceiling) return resolution;
  if (hasReferenceImages && RESOLUTIONS.indexOf(ceiling) > RESOLUTIONS.indexOf("720p")) ceiling = "720p";
  if (RESOLUTIONS.indexOf(resolution) > RESOLUTIONS.indexOf(ceiling)) {
    throw new Error("model " + model + " supports at most " + ceiling + " for this request mode");
  }
  return resolution;
}

function vendorRequest(source, billingModel, upstreamModel, imageFileField) {
  const prompt = trimmed(source.prompt);
  if (!prompt) throw new Error("field prompt is required");

  const references = [];
  for (const entry of toArray(source.reference_images)) {
    const url = trimmed(entry);
    if (url && !references.includes(url)) references.push(url);
  }
  if (references.length > MAX_REFERENCE_IMAGES) {
    throw new Error("reference_images accepts at most " + MAX_REFERENCE_IMAGES + " images");
  }

  let image = null;
  if (imageFileField) {
    image = { __fileRef: "request_file:" + imageFileField, encoding: "dataUrl", maxBytes: MAX_IMAGE_BYTES };
  } else {
    const url = trimmed(source.image || source.input_reference);
    if (url) image = url;
  }
  if (image && references.length) throw new Error("image and reference_images cannot be combined in one request");

  const claimedDuration = source.duration === undefined ? source.seconds : source.duration;
  const duration =
    claimedDuration === undefined || claimedDuration === null || claimedDuration === ""
      ? DEFAULT_DURATION_SECONDS
      : normalizeDuration(claimedDuration);

  const size = parseSize(source.size);
  const claimedResolution = normalizeResolution(source.resolution);
  if (trimmed(source.resolution) && !claimedResolution) {
    throw new Error("resolution must be one of " + RESOLUTIONS.join(", "));
  }
  const resolution = cappedResolution(
    upstreamModel,
    claimedResolution || (size ? size.resolution : "") || DEFAULT_RESOLUTION,
    references.length > 0
  );

  const request = { model: billingModel, prompt: prompt, duration: duration, resolution: resolution };
  const ratio = trimmed(source.aspect_ratio) || (size ? size.aspect_ratio : "");
  if (ratio) {
    if (!ASPECT_RATIOS.includes(ratio)) throw new Error("aspect_ratio must be one of " + ASPECT_RATIOS.join(", "));
    request.aspect_ratio = ratio;
  }
  if (source.generate_audio !== undefined) request.generate_audio = toBoolean(source.generate_audio, "generate_audio");
  if (image) request.image = image;
  if (references.length) request.reference_images = references;
  const audios = toArray(source.reference_audios);
  if (audios.length > MAX_REFERENCE_AUDIOS) throw new Error("reference_audios accepts at most " + MAX_REFERENCE_AUDIOS + " entries");
  if (audios.length) request.reference_audios = audios;
  return request;
}

function submitAction(request) {
  if (request.reference_images) return "reference_to_video";
  if (request.image) return "image_to_video";
  return "text_to_video";
}

// pixelFrame renders resolution + aspect ratio back into the pixel dimensions
// the upstream expresses size with. The short edge carries the tier, and the
// long edge is rounded to an even number of pixels the way encoders expect
// (480p 16:9 becomes the conventional 854x480, not 853x480).
function evenPixels(value) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function pixelFrame(resolution, ratio) {
  const edge = SHORT_EDGE_PIXELS[resolution] || SHORT_EDGE_PIXELS[DEFAULT_RESOLUTION];
  const parts = String(ratio || DEFAULT_ASPECT_RATIO).split(":");
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (!width || !height) return { width: edge, height: edge };
  if (width >= height) return { width: evenPixels((edge * width) / height), height: edge };
  return { width: edge, height: evenPixels((edge * height) / width) };
}

// A new-api upstream answers GET /v1/video/generations/:task_id with the generic
// task envelope {"code":"success","data":{...}}, while an OpenAI-shaped upstream
// answers with the task object itself. unwrap collapses both into one object so
// the parsers below never have to know which one replied. The task object itself
// also carries a nested `data` (the raw vendor body new-api stored), so descend
// only when the outer object is not already the task — i.e. has no status.
function unwrap(body) {
  const outer = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const inner = outer.data;
  if (!trimmed(outer.status) && inner && typeof inner === "object" && !Array.isArray(inner)) {
    return { outer: outer, inner: inner };
  }
  return { outer: outer, inner: outer };
}

function firstNumber(sources, keys) {
  for (const source of sources) {
    for (const key of keys) {
      const value = Number((source || {})[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return 0;
}

function responsesInput(req) {
  const texts = [],
    images = [];
  const input = req.input;
  if (typeof input === "string") texts.push(input);
  else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") {
        texts.push(item);
        continue;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const content = item.content === undefined ? [item] : Array.isArray(item.content) ? item.content : [item.content];
      for (const part of content) {
        if (typeof part === "string") {
          texts.push(part);
          continue;
        }
        if (!part || typeof part !== "object" || Array.isArray(part)) continue;
        if (["input_text", "text"].includes(part.type) && typeof part.text === "string") texts.push(part.text);
        if (["input_image", "image_url"].includes(part.type)) {
          let image = part.image_url;
          if (image && typeof image === "object") image = image.url;
          if (trimmed(image)) images.push(trimmed(image));
        }
      }
    }
  }
  return {
    prompt: texts
      .filter(function (text) {
        return trimmed(text);
      })
      .join("\n"),
    images: images,
  };
}

function responsesVideoText(ctx) {
  const artifact = ctx && ctx.artifacts && ctx.artifacts.video;
  const url = trimmed(artifact && artifact.url);
  if (!url) throw new Error("video artifact is unavailable");
  const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return '<video controls src="' + escaped + '"></video>';
}

function multipartFields(ctx) {
  const fields = ctx.body.fields || {};
  const request = {};
  for (const name of Object.keys(fields)) {
    const values = fields[name] || [];
    if (values.length > 1) throw new Error(name + " must be provided once");
    request[name] = values[0];
  }
  return request;
}

function multipartImageField(ctx) {
  let field = "";
  for (const file of ctx.body.files || []) {
    if (file.field !== "input_reference" && file.field !== "image") throw new Error("unexpected file field: " + file.field);
    if (field) throw new Error("only one input image may be uploaded");
    field = file.field;
  }
  return field;
}

// The upstream is a new-api gateway, whose video submit endpoint is
// POST /v1/video/generations. Its request DTO is duration/width/height with a
// free-form `metadata` bag for vendor-specific parameters, so those are the
// canonical fields here. The OpenAI Videos spelling (seconds/size/
// input_reference) and the xAI spelling (resolution/aspect_ratio) ride along
// because the same body may be forwarded to an upstream that prefers either,
// and unknown fields are ignored by every one of those parsers.
export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  if (!trimmed(req.prompt)) throw new Error("field prompt is required");

  let duration = Number(req.duration === undefined ? req.seconds : req.duration);
  if (!Number.isFinite(duration) || duration <= 0) duration = DEFAULT_DURATION_SECONDS;
  const resolution = normalizeResolution(req.resolution) || DEFAULT_RESOLUTION;
  const ratio = ASPECT_RATIOS.includes(trimmed(req.aspect_ratio)) ? trimmed(req.aspect_ratio) : DEFAULT_ASPECT_RATIO;
  const frame = pixelFrame(resolution, ratio);

  const metadata = { resolution: resolution, aspect_ratio: ratio };
  if (req.reference_images) metadata.reference_images = req.reference_images;
  if (req.reference_audios) metadata.reference_audios = req.reference_audios;
  if (req.generate_audio !== undefined) metadata.generate_audio = req.generate_audio;

  const body = {
    model: ctx.upstreamModel || ctx.model,
    prompt: req.prompt,
    duration: duration,
    width: frame.width,
    height: frame.height,
    metadata: metadata,
    seconds: duration,
    size: frame.width + "x" + frame.height,
    resolution: resolution,
    aspect_ratio: ratio,
  };
  if (req.image !== undefined && req.image !== null) {
    body.image = req.image;
    body.input_reference = req.image;
  }
  if (req.reference_images) body.reference_images = req.reference_images;
  if (req.reference_audios) body.reference_audios = req.reference_audios;
  if (req.generate_audio !== undefined) body.generate_audio = req.generate_audio;

  return {
    url: ctx.baseUrl + "/v1/video/generations",
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
    body: body,
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  const parts = unwrap(body);
  const taskId = trimmed(
    parts.inner.task_id || parts.inner.id || parts.outer.task_id || parts.outer.id || parts.outer.request_id
  );
  if (!taskId) {
    throw new Error(trimmed((body.error || {}).message) || trimmed(body.message) || "task_id is empty");
  }
  return { taskId: taskId, taskData: body };
}

export function extractUsage(ctx) {
  const req = ctx.requestBody || {};
  let seconds = Number(req.duration === undefined ? req.seconds : req.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = DEFAULT_DURATION_SECONDS;
  return {
    seconds: Math.min(seconds, MAX_DURATION_SECONDS),
    resolution: normalizeResolution(req.resolution) || DEFAULT_RESOLUTION,
  };
}

export function buildQueryRequest(ctx) {
  return {
    url: ctx.baseUrl + "/v1/video/generations/" + encodeURIComponent(ctx.taskId),
    method: "GET",
    headers: { Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
  };
}

export function parseTaskResult(ctx, body) {
  // A new-api upstream reports its own uppercase task states; an OpenAI-shaped
  // one reports lowercase video states. Lowercasing folds the two vocabularies
  // into a single table.
  const statuses = {
    not_start: "QUEUED",
    submitted: "QUEUED",
    queued: "QUEUED",
    pending: "QUEUED",
    in_progress: "IN_PROGRESS",
    processing: "IN_PROGRESS",
    running: "IN_PROGRESS",
    completed: "SUCCESS",
    succeeded: "SUCCESS",
    success: "SUCCESS",
    done: "SUCCESS",
    failed: "FAILURE",
    failure: "FAILURE",
    cancelled: "FAILURE",
    expired: "FAILURE",
  };
  const source = unwrap(body).inner;
  const raw = trimmed(source.status).toLowerCase();
  const status = statuses[raw];
  if (!status) return { status: "UNKNOWN", reason: "unrecognized status: " + raw };
  const result = { status: status };
  // new-api already formats progress as "30%"; an OpenAI-shaped upstream sends a
  // bare number.
  const progress = Number(trimmed(source.progress).replace("%", ""));
  if (Number.isFinite(progress) && progress > 0 && progress < 100) result.progress = progress + "%";
  if (status === "SUCCESS") {
    const url = trimmed(source.result_url || source.url);
    if (url) result.url = url;
  }
  if (status === "FAILURE") {
    const error = source.error || {};
    result.reason = trimmed(source.fail_reason) || trimmed(error.message) || "task failed";
  }
  return result;
}

// The delivered length can differ from the requested one, and settlement
// re-prices on it. new-api's task envelope carries it under metadata.duration or
// on the raw vendor body it stored in `data`; an OpenAI-shaped upstream reports
// `seconds`.
export function extractUsageOnComplete(_task, _taskResult, body) {
  const source = unwrap(body).inner;
  const seconds = firstNumber(
    [source, source.metadata || {}, source.video || {}, source.data || {}],
    ["seconds", "duration"]
  );
  if (seconds <= 0) return null;
  return { seconds: Math.min(seconds, MAX_DURATION_SECONDS) };
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" ? [{ key: "video", type: "video", mimeType: "video/mp4" }] : [];
}

// new-api has no content route under /v1/video/generations, and its task
// envelope may point result_url at a short-lived vendor CDN this gateway cannot
// authenticate against. Its always-registered /v1/videos/:task_id/content proxy
// resolves both problems, so the bytes come back through the channel host.
export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  return {
    url: ctx.baseUrl + "/v1/videos/" + encodeURIComponent(ctx.upstreamTaskId) + "/content",
    method: ctx.clientRequest.method,
    headers: { Authorization: "Bearer " + ctx.apiKey },
  };
}

export const protocols = {
  openai_responses: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const req = ctx.body.value;
      if (!req || typeof req !== "object" || Array.isArray(req)) throw new Error("request body must be an object");
      const model = trimmed(ctx.model);
      if (!model) throw new Error("model is required");
      if (req.input !== undefined && typeof req.input !== "string" && !Array.isArray(req.input)) throw new Error("input must be a string or array");
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      const input = responsesInput(req);
      const images = [];
      for (const image of [req.image, req.input_reference].concat(req.images || [], req.reference_images || [], input.images)) {
        if (trimmed(image) && !images.includes(trimmed(image))) images.push(trimmed(image));
      }
      const source = Object.assign({}, req, { prompt: input.prompt || trimmed(req.prompt) });
      delete source.image;
      delete source.input_reference;
      delete source.reference_images;
      if (images.length === 1) source.image = images[0];
      else if (images.length > 1) source.reference_images = images;
      const requestBody = vendorRequest(source, model, ctx.upstreamModel || model, "");
      return { kind: "submit", model: model, action: submitAction(requestBody), requestBody: requestBody };
    },
    renderEvents: function (ctx, task, previousState) {
      const status = String(task.status || "UNKNOWN").toUpperCase();
      const value = Number(String(task.progress || "").replace("%", ""));
      const progress = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const state = { status: status, progress: progress };
      if (status === "SUCCESS") {
        const text = responsesVideoText(ctx);
        const events = previousState && previousState.status === status ? [] : [{ type: "output", data: text }];
        return { events: events, state: state, done: true };
      }
      if (status === "FAILURE")
        return { events: [{ type: "error", code: "task_failed", message: task.fail_reason || "task failed" }], state: state, done: true };
      if (previousState && previousState.status === status && previousState.progress === progress) return { events: [], state: state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state: state, done: false };
    },
    renderFinal: function (ctx, _task) {
      return {
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: responsesVideoText(ctx), annotations: [], logprobs: [] }],
          },
        ],
        metadata: { vendor: "xai" },
      };
    },
  },
  openai_video: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
      let source;
      let imageFileField = "";
      if (ctx.body.kind === "json") {
        if (!ctx.body.value || typeof ctx.body.value !== "object" || Array.isArray(ctx.body.value)) throw new Error("JSON object required");
        source = ctx.body.value;
      } else {
        source = multipartFields(ctx);
        imageFileField = multipartImageField(ctx);
        if (imageFileField) delete source[imageFileField];
        if (source.reference_images !== undefined) {
          let parsed;
          try {
            parsed = JSON.parse(source.reference_images);
          } catch (e) {
            throw new Error("reference_images must be a JSON array string");
          }
          if (!Array.isArray(parsed)) throw new Error("reference_images must be a JSON array string");
          source.reference_images = parsed;
        }
      }
      const requestBody = vendorRequest(source, ctx.model, ctx.upstreamModel || ctx.model, imageFileField);
      return { kind: "submit", model: ctx.model, action: submitAction(requestBody), requestBody: requestBody };
    },
    render: function (ctx, task) {
      const statuses = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
      const data = task.data || {};
      const output = {
        id: task.task_id,
        object: "video",
        model: (task.properties || {}).origin_model_name || "",
        status: statuses[task.status] || "unknown",
        progress: Number(String(task.progress || "0").replace("%", "")),
        created_at: Number(task.created_at || 0),
      };
      const completedAt = Number(task.finished_at || task.updated_at || 0);
      if (completedAt > 0) output.completed_at = completedAt;
      const seconds = Number(data.seconds);
      if (Number.isFinite(seconds) && seconds > 0) output.seconds = seconds;
      if (task.status === "FAILURE") {
        const error = data.error || {};
        output.error = { code: trimmed(error.code) || "video_generation_failed", message: trimmed(error.message) || "The video generation task failed." };
      }
      return output;
    },
  },
};
