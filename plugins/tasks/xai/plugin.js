export const meta = {
  apiVersion: 1,
  key: "xai",
  name: "Grok Imagine",
  description: {
    en: "xAI Grok Imagine video generation (text-to-video, image-to-video, and reference-to-video)",
    zh: "xAI Grok Imagine 视频生成（文生视频、图生视频、参考图生视频）",
  },
  version: "1.0.0",
  channelTypes: [48], // xAI channels serve chat, images, and video from one base URL and bearer key
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
const RESOLUTIONS = ["480p", "720p", "1080p"];
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
const MAX_REFERENCE_IMAGES = 7;
const MAX_REFERENCE_AUDIOS = 3;
const MAX_IMAGE_BYTES = 20971520;

// grok-imagine-video tops out at 720p. grok-imagine-video-1.5 adds native 1080p
// for text-to-video and image-to-video, but reference-to-video stays at 720p.
const MODEL_MAX_RESOLUTION = { "grok-imagine-video": "720p", "grok-imagine-video-1.5": "1080p" };

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

// aspectRatio reduces a pixel size to one of the vendor's seven accepted ratios,
// returning "" when the size does not map onto any of them.
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

// cappedResolution rejects a request the vendor would reject anyway, so the
// caller is not pre-charged for a submit that cannot succeed. An unrecognized
// model (a channel alias, or a model added upstream after this version) is left
// to the vendor.
function cappedResolution(model, resolution, hasReferenceImages) {
  let ceiling = MODEL_MAX_RESOLUTION[model];
  if (!ceiling) return resolution;
  if (hasReferenceImages && RESOLUTIONS.indexOf(ceiling) > RESOLUTIONS.indexOf("720p")) ceiling = "720p";
  if (RESOLUTIONS.indexOf(resolution) > RESOLUTIONS.indexOf(ceiling)) {
    throw new Error("model " + model + " supports at most " + ceiling + " for this request mode");
  }
  return resolution;
}

// vendorRequest converts one client request — OpenAI video, OpenAI responses, or
// an xAI-native body — into the single /v1/videos/generations shape. duration and
// resolution are always emitted so per-second video pricing has both facts.
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

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  if (!trimmed(req.prompt)) throw new Error("field prompt is required");
  return {
    url: ctx.baseUrl + "/v1/videos/generations",
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
    body: Object.assign({}, req, { model: ctx.upstreamModel || ctx.model }),
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  const taskId = trimmed(body.request_id || body.id);
  if (!taskId) throw new Error("request_id is empty");
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
    url: ctx.baseUrl + "/v1/videos/" + encodeURIComponent(ctx.taskId),
    method: "GET",
    headers: { Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
  };
}

export function parseTaskResult(ctx, body) {
  const statuses = { pending: "IN_PROGRESS", processing: "IN_PROGRESS", queued: "QUEUED", done: "SUCCESS", failed: "FAILURE", expired: "FAILURE" };
  const raw = trimmed(body && body.status).toLowerCase();
  const status = statuses[raw];
  if (!status) return { status: "UNKNOWN", reason: "unrecognized status: " + raw };
  const result = { status: status };
  if (status === "SUCCESS") {
    const url = trimmed(((body || {}).video || {}).url);
    if (!url) return { status: "UNKNOWN", reason: "the completed generation carries no video url" };
    result.url = url;
  }
  if (status === "FAILURE") {
    const error = (body || {}).error || {};
    result.reason = trimmed(error.message) || (raw === "expired" ? "the generation request expired" : "task failed");
  }
  return result;
}

// The vendor reports the delivered duration, which can differ from the requested
// one; settlement re-prices on this fact.
export function extractUsageOnComplete(_task, _taskResult, body) {
  const seconds = Number(((body || {}).video || {}).duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return { seconds: Math.min(seconds, MAX_DURATION_SECONDS) };
}

function artifactVideoURL(source) {
  return trimmed((((source || {}).data || {}).video || {}).url);
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" && artifactVideoURL(task) ? [{ key: "video", type: "video", mimeType: "video/mp4" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = artifactVideoURL(ctx);
  if (!url) throw new Error("artifact_not_found");
  // Delivered videos live on a public, short-lived vendor CDN host rather than
  // behind the channel base URL, so the proxy fetch carries no credentials.
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
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
      const seconds = Number((data.video || {}).duration);
      if (Number.isFinite(seconds) && seconds > 0) output.seconds = seconds;
      if (task.status === "FAILURE") {
        const error = data.error || {};
        output.error = { code: trimmed(error.code) || "video_generation_failed", message: trimmed(error.message) || "The video generation task failed." };
      }
      return output;
    },
  },
};
