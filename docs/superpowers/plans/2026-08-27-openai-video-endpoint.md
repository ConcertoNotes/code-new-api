# OpenAI Video Endpoint Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/v1/videos` the canonical OpenAI video endpoint while keeping `/v1/video/generations` as a compatible alias whose Sora/OpenAI upstream requests use `/v1/videos`.

**Architecture:** Keep both existing route registrations and the shared relay task pipeline. Adjust only the Sora task adaptor's URL selection so the canonical upstream path is used for create and fetch requests regardless of the client-facing alias; preserve remix and non-Sora adaptor behavior.

**Tech Stack:** Go 1.22+, Gin, GORM-backed task pipeline, testify, existing `common` JSON wrappers.

## Global Constraints

- Preserve unrelated worktree changes and keep the patch limited to video endpoint compatibility.
- `/v1/videos` is the canonical OpenAI protocol path; `/v1/video/generations` remains a compatibility alias.
- Do not add `/v1/videos/generations`.
- Sora/OpenAI upstream create/fetch requests must use `/v1/videos` paths; remix remains `/v1/videos/{id}/remix`.
- Use `common.Marshal`/`common.Unmarshal` for JSON operations in production code.

---

### Task 1: Lock route contract with regression tests

**Files:**
- Modify: `router/video_router_test.go`

**Interfaces:**
- Produces route assertions consumed by the router implementation and future regressions.

- [ ] **Step 1: Write the failing test**

Update `TestVideoGenerationRoutes` so it asserts both POST/GET pairs:

```go
assert.Contains(t, routes, "POST /v1/videos")
assert.Contains(t, routes, "GET /v1/videos/:task_id")
assert.Contains(t, routes, "POST /v1/video/generations")
assert.Contains(t, routes, "GET /v1/video/generations/:task_id")
assert.NotContains(t, routes, "POST /v1/videos/generations")
```

- [ ] **Step 2: Run test to verify the contract baseline**

Run: `go test ./router -run TestVideoGenerationRoutes -count=1`

Expected: PASS on the current route registrations; this records the intended public contract before URL behavior changes.

- [ ] **Step 3: Commit**

```bash
git add router/video_router_test.go
git commit -m "test: cover canonical and legacy video routes"
```

### Task 2: Make Sora upstream URL canonical

**Files:**
- Modify: `relay/channel/task/sora/adaptor.go`
- Modify: `relay/channel/task/sora/adaptor_test.go`

**Interfaces:**
- `TaskAdaptor.BuildRequestURL(info *relaycommon.RelayInfo) (string, error)` returns the upstream create/remix URL.
- `TaskAdaptor.FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error)` builds the upstream status URL.

- [ ] **Step 1: Write the failing test**

Replace the legacy-path expectation in `TestSoraBuildRequestURLPreservesVideoGenerationEndpoint` with a canonical expectation:

```go
{
    name:        "legacy video generation endpoint uses OpenAI videos upstream",
    requestPath: "/v1/video/generations",
    want:        "https://video.example.com/v1/videos",
},
```

Add a fetch URL test using an `httptest.Server` that records `r.URL.Path`; call `FetchTask` with `body["task_id"] = "video_123"` and `body["request_path"] = "/v1/video/generations"`, then assert the recorded path is `/v1/videos/video_123`.

Run: `go test ./relay/channel/task/sora -run 'TestSoraBuildRequestURL|TestSoraFetchTask' -count=1`

Expected: FAIL because the current adaptor still emits `/v1/video/generations` for the legacy request path.

- [ ] **Step 2: Implement the minimal URL change**

In `BuildRequestURL`, remove the branch that returns `.../v1/video/generations`; after the remix branch, always return `fmt.Sprintf("%s/v1/videos", a.baseURL)`.

In `FetchTask`, remove request-path-dependent selection and always construct `fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)`.

- [ ] **Step 3: Run the focused tests**

Run: `go test ./relay/channel/task/sora -run 'TestSoraBuildRequestURL|TestSoraFetchTask' -count=1`

Expected: PASS with no failures.

- [ ] **Step 4: Run the affected package test suite**

Run: `go test ./relay/channel/task/sora -count=1`

Expected: PASS; existing request-body, response conversion, and status mapping tests remain green.

- [ ] **Step 5: Commit**

```bash
git add relay/channel/task/sora/adaptor.go relay/channel/task/sora/adaptor_test.go
git commit -m "fix: canonicalize Sora video upstream paths"
```

### Task 3: Verify the complete change

**Files:**
- Inspect only: `router/video-router.go`, `middleware/distributor.go`, `relay/channel/task/sora/adaptor.go`

**Interfaces:**
- Verifies route aliases, relay mode selection, and Sora upstream URL behavior together.

- [ ] **Step 1: Run router and Sora regression tests**

Run: `go test ./router ./relay/channel/task/sora -count=1`

Expected: PASS.

- [ ] **Step 2: Run root-module compilation/tests relevant to relay changes**

Run: `go test ./relay/... ./controller/... ./middleware/... -count=1`

Expected: PASS with exit code 0.

- [ ] **Step 3: Inspect the final diff and working tree**

Run: `git diff HEAD~2..HEAD -- router/video_router_test.go relay/channel/task/sora/adaptor.go relay/channel/task/sora/adaptor_test.go; git status --short`

Expected: only the planned route-test and Sora URL changes plus the committed design/plan documents are present; no unrelated files are modified.

- [ ] **Step 4: Format changed Go files**

Run: `gofmt -w router/video_router_test.go relay/channel/task/sora/adaptor.go relay/channel/task/sora/adaptor_test.go` followed by `git diff --check`.

Expected: `git diff --check` produces no output.

