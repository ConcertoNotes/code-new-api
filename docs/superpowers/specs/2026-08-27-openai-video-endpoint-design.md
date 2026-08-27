# OpenAI 视频接口兼容设计

## 背景

当前网关同时暴露标准 OpenAI 视频路径 `/v1/videos` 和历史任务路径 `/v1/video/generations`。Sora 适配器会依据网关请求路径选择上游路径，因此历史路径被转发为 `POST /v1/video/generations`，而 OpenAI 上游只接受 `POST /v1/videos`，最终返回 404 `Invalid URL`。

## 目标与范围

- 将 `/v1/videos` 作为唯一规范的 OpenAI 视频协议入口。
- 保留 `/v1/video/generations` 的 POST/GET 兼容入口，避免现有客户端失效。
- 两个入口共用现有任务提交、查询、计费、鉴权和 OpenAI 视频响应转换逻辑。
- 对 Sora/OpenAI 上游，无论客户端使用哪个入口，都发送到 `/v1/videos` 及 `/v1/videos/{task_id}`。
- 不新增非官方路径 `/v1/videos/generations`，不改动 Doubao、Kling、Jimeng 等渠道的专用上游协议。

## 设计

### 路由与请求流

路由层继续注册标准路径和历史别名，并将两者都交给 `controller.RelayTask` / `controller.RelayTaskFetch`。分发器保留两种路径的 relay mode 判断，使模型选择、Token 鉴权和任务查询行为一致。`RelayInfo.RequestURLPath` 可继续记录客户端原始路径，用于日志和兼容性判断，但 Sora 适配器构造 OpenAI 上游 URL 时不再把历史别名直接透传。

### 上游 URL 规则

- Sora/OpenAI 创建任务：`{baseURL}/v1/videos`
- Sora/OpenAI 查询任务：`{baseURL}/v1/videos/{upstreamTaskID}`
- Remix：继续使用 `{baseURL}/v1/videos/{originTaskID}/remix`

其他任务适配器的 BuildRequestURL/FetchTask 实现保持不变；它们的专用协议不受该兼容修正影响。

### 响应与错误

创建和查询响应继续通过现有 `OpenAIVideo` 转换器返回，公开任务 ID 与网关当前行为保持一致。上游非 2xx 响应沿用现有 `TaskError` 包装，状态码和错误消息不做额外重写。

## 测试策略

- 路由测试断言标准入口和历史别名均存在，并明确不注册 `/v1/videos/generations`。
- Sora 适配器 URL 测试覆盖标准入口、历史别名、查询和 remix，确认创建/查询统一使用 `/v1/videos`。
- 运行受影响 Go 包测试，并执行根模块编译/测试；本次不涉及 relaykit API，按根模块验证即可。

## 非目标

- 不引入新的数据库字段、配置项或前端入口。
- 不改变 OpenAI 视频请求字段、计费规则、任务状态映射或内容代理路径。
