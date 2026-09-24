package service

import (
	"encoding/base64"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// attachQuotaSaturationToOther nests a quota saturation marker under
// other.admin_info.quota_saturation. Nesting under admin_info makes it
// admin-only for free, since model.formatUserLogs strips the whole admin_info
// object for non-admin viewers. Creates admin_info if absent. No-op when the
// clamp is nil (the common case: no saturation happened).
func attachQuotaSaturationToOther(other *model.LogOther, clamp *common.QuotaClamp) {
	if clamp == nil || other == nil {
		return
	}
	other.SetAdmin("quota_saturation", clamp.AuditMap())
}

// attachQuotaSaturation records the request's quota clamp (if any) onto the
// consume log's other.admin_info and emits a request-correlated backend audit
// line. Called right before RecordConsumeLog on the text/audio/wss paths.
func attachQuotaSaturation(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil {
		return
	}
	clamp := relayInfo.QuotaClamp
	if clamp == nil {
		return
	}
	attachQuotaSaturationToOther(other, clamp)
	logger.LogWarn(ctx, fmt.Sprintf("quota saturation on consume log: op=%s kind=%s original=%g clamped=%d user=%d model=%s",
		clamp.Op, clamp.Kind, clamp.Original, clamp.Clamped, relayInfo.UserId, relayInfo.GetBillingModelName()))
}

func appendRequestPath(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if other == nil {
		return
	}
	if ctx != nil && ctx.Request != nil && ctx.Request.URL != nil {
		if path := ctx.Request.URL.Path; path != "" {
			other.SetPublic("request_path", path)
			return
		}
	}
	if relayInfo != nil && relayInfo.RequestURLPath != "" {
		path := relayInfo.RequestURLPath
		if idx := strings.Index(path, "?"); idx != -1 {
			path = path[:idx]
		}
		other.SetPublic("request_path", path)
	}
}

// AppendClientInfo records the caller's raw User-Agent header (if present) as
// a public other-field, so log viewers can tell what client issued the
// request (terminal CLI, IDE plugin, SDK, browser, etc.) — the primary
// signal used to diagnose client-side malformed-request errors such as an
// upstream 400. Shared by successful and failed request logs.
func AppendClientInfo(relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil || other == nil {
		return
	}
	if ua := relayInfo.RequestHeaders["User-Agent"]; ua != "" {
		other.SetPublic("client_user_agent", ua)
	}
}

// AppendRelayLogAdminInfo records relay routing and conversion diagnostics in
// the admin-only scope shared by successful and failed request logs.
func AppendRelayLogAdminInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if ctx == nil || other == nil {
		return
	}
	other.SetAdmin("use_channel", ctx.GetStringSlice("use_channel"))
	if relayInfo != nil {
		if billingModel := relayInfo.GetBillingModelName(); billingModel != "" && billingModel != relayInfo.OriginModelName {
			other.SetAdmin("billing_model", billingModel)
		}
		if diagnostics := relayInfo.ConversionDiagnostics(); len(diagnostics) > 0 {
			other.SetAdmin("conversion_diagnostics", diagnostics)
		}
		if relayInfo.ConversionDiagnosticsTruncated() {
			other.SetAdmin("conversion_diagnostics_truncated", true)
		}
	}
	if common.GetContextKeyBool(ctx, constant.ContextKeyChannelIsMultiKey) {
		other.SetAdmin("is_multi_key", true)
		other.SetAdmin("multi_key_index", common.GetContextKeyInt(ctx, constant.ContextKeyChannelMultiKeyIndex))
	}
	if common.GetContextKeyBool(ctx, constant.ContextKeyLocalCountTokens) {
		other.SetAdmin("local_count_tokens", true)
	}

	appendRequestRoutingAdminInfo(relayInfo, other)
	appendUpstreamAuditAdminInfo(ctx, relayInfo, other)
	AppendChannelAffinityAdminInfo(ctx, other)
	if events := RequestPolicy(ctx).Events(); len(events) > 0 {
		other.SetAdmin("request_policy", events)
	}
}

// appendRequestRoutingAdminInfo 记录本次尝试的路由 / 请求侧诊断：渠道类型与地址、
// 重试序号、模型映射链、发往上游的推理强度、本地估算 token、预扣额度、透传与
// Header 覆盖（仅记录键名，不记录值）以及处理节点与版本。全部为管理员可见。
func appendRequestRoutingAdminInfo(relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	other.SetAdmin("node_name", common.NodeName)
	other.SetAdmin("version", common.Version)
	if relayInfo == nil {
		return
	}
	other.SetAdmin("retry_index", relayInfo.RetryIndex)
	if relayInfo.ChannelMeta != nil {
		other.SetAdmin("channel_type", relayInfo.ChannelType)
		if relayInfo.ChannelBaseUrl != "" {
			other.SetAdmin("channel_base_url", relayInfo.ChannelBaseUrl)
		}
		if relayInfo.UpstreamModelName != "" {
			other.SetAdmin("sent_model", relayInfo.UpstreamModelName)
		}
		if relayInfo.ChannelSetting.PassThroughBodyEnabled || model_setting.GetGlobalSettings().PassThroughRequestEnabled {
			other.SetAdmin("pass_through_body", true)
		}
		if len(relayInfo.HeadersOverride) > 0 {
			keys := make([]string, 0, len(relayInfo.HeadersOverride))
			for key := range relayInfo.HeadersOverride {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			other.SetAdmin("header_override_keys", keys)
		}
	}
	if chain := buildModelMappingChain(relayInfo); chain != "" {
		other.SetAdmin("model_mapping_chain", chain)
	}
	if state := relayInfo.ReasoningState(); state != nil && state.Effort != "" && state.Effort != relayInfo.ReasoningEffort {
		other.SetAdmin("upstream_reasoning_effort", state.Effort)
	}
	if estimated := relayInfo.GetEstimatePromptTokens(); estimated > 0 {
		other.SetAdmin("estimated_prompt_tokens", estimated)
	}
	if relayInfo.FinalPreConsumedQuota > 0 {
		other.SetAdmin("pre_consumed_quota", relayInfo.FinalPreConsumedQuota)
	}
}

// buildModelMappingChain 生成 "客户端请求模型 → 发往上游模型 → 计费模型" 链路；
// 相邻两段相同则折叠，最终只有一段时返回空串（无需展示）。
func buildModelMappingChain(relayInfo *relaycommon.RelayInfo) string {
	if relayInfo == nil {
		return ""
	}
	segments := []string{relayInfo.OriginModelName}
	if upstream := relayInfo.GetUpstreamModelName(); upstream != "" && upstream != segments[len(segments)-1] {
		segments = append(segments, upstream)
	}
	if billing := relayInfo.GetBillingModelName(); billing != "" && billing != relayInfo.OriginModelName && billing != segments[len(segments)-1] {
		segments = append(segments, billing)
	}
	if len(segments) < 2 || segments[0] == "" {
		return ""
	}
	return strings.Join(segments, " → ")
}

// appendUpstreamAuditAdminInfo 记录上游 HTTP 往返事实以及"上游响应模型是否与
// 发往上游的模型一致"的比对结果。响应中未声明模型时不写入 mismatch 字段（三态）。
func appendUpstreamAuditAdminInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	audit := relaycommon.GetUpstreamResponseAudit(ctx)
	if audit == nil {
		return
	}
	summary := audit.Summary()
	other.SetAdmin("upstream", audit.AdminInfo(summary))
	if summary.Model == "" {
		return
	}
	other.SetAdmin("upstream_response_model", summary.Model)
	if summary.ModelConflict {
		other.SetAdmin("upstream_response_model_conflict", true)
	}
	sentModel := ""
	if relayInfo != nil {
		sentModel = relayInfo.GetUpstreamModelName()
		if sentModel == "" {
			sentModel = relayInfo.OriginModelName
		}
	}
	other.SetAdmin("upstream_model_mismatch", sentModel == "" || !relaycommon.UpstreamModelsMatchForAudit(sentModel, summary.Model))
}

// AppendUpstreamUsageAdminInfo 记录上游原始 usage 快照（未经本地估算 / 修正），
// 便于管理员核对计费 token 与上游声明是否一致。
func AppendUpstreamUsageAdminInfo(other *model.LogOther, usage *dto.Usage) {
	if other == nil || usage == nil {
		return
	}
	snapshot := map[string]any{
		"prompt_tokens":     usage.PromptTokens,
		"completion_tokens": usage.CompletionTokens,
		"total_tokens":      usage.TotalTokens,
	}
	if usage.InputTokens > 0 {
		snapshot["input_tokens"] = usage.InputTokens
	}
	if usage.OutputTokens > 0 {
		snapshot["output_tokens"] = usage.OutputTokens
	}
	if usage.PromptTokensDetails.CachedTokens > 0 {
		snapshot["cached_tokens"] = usage.PromptTokensDetails.CachedTokens
	}
	if usage.PromptTokensDetails.CachedCreationTokens > 0 {
		snapshot["cache_creation_tokens"] = usage.PromptTokensDetails.CachedCreationTokens
	}
	if usage.PromptTokensDetails.CacheWriteTokens > 0 {
		snapshot["cache_write_tokens"] = usage.PromptTokensDetails.CacheWriteTokens
	}
	if usage.CompletionTokenDetails.ReasoningTokens > 0 {
		snapshot["reasoning_tokens"] = usage.CompletionTokenDetails.ReasoningTokens
	}
	if usage.UsageSource != "" {
		snapshot["source"] = usage.UsageSource
	}
	if usage.UsageSemantic != "" {
		snapshot["semantic"] = usage.UsageSemantic
	}
	other.SetAdmin("upstream_usage", snapshot)
}

func GenerateTextOtherInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, modelRatio, groupRatio, completionRatio float64,
	cacheTokens int, cacheRatio float64, modelPrice float64, userGroupRatio float64) *model.LogOther {
	MarkRequestPolicySuccess(ctx, relayInfo.StreamStatus)
	other := model.NewLogOther()
	other.SetPublic("model_ratio", modelRatio)
	other.SetPublic("group_ratio", groupRatio)
	other.SetPublic("completion_ratio", completionRatio)
	other.SetPublic("cache_tokens", cacheTokens)
	other.SetPublic("cache_ratio", cacheRatio)
	other.SetPublic("model_price", modelPrice)
	other.SetPublic("user_group_ratio", userGroupRatio)
	other.SetPublic("frt", float64(relayInfo.FirstResponseTime.UnixMilli()-relayInfo.StartTime.UnixMilli()))
	if relayInfo.ReasoningEffort != "" {
		other.SetPublic("reasoning_effort", relayInfo.ReasoningEffort)
	}
	if relayInfo.IsModelMapped {
		other.SetPublic("is_model_mapped", true)
		other.SetPublic("upstream_model_name", relayInfo.UpstreamModelName)
	}

	isSystemPromptOverwritten := common.GetContextKeyBool(ctx, constant.ContextKeySystemPromptOverride)
	if isSystemPromptOverwritten {
		other.SetPublic("is_system_prompt_overwritten", true)
	}

	AppendRelayLogAdminInfo(ctx, relayInfo, other)
	AppendClientInfo(relayInfo, other)
	AppendResponseModelLogInfo(relayInfo, other)
	appendRequestPath(ctx, relayInfo, other)
	appendRequestConversionChain(relayInfo, other)
	appendFinalRequestFormat(relayInfo, other)
	appendBillingInfo(relayInfo, other)
	appendParamOverrideInfo(relayInfo, other)
	appendStreamStatus(relayInfo, other)
	return other
}

func AppendResponseModelLogInfo(relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil || relayInfo.ResponseModel == nil || other == nil {
		return
	}
	observation := relayInfo.ResponseModel
	if observation.ReturnedModel == observation.RequestedModel &&
		(observation.UpstreamModel == "" || observation.UpstreamModel == observation.RequestedModel) &&
		(relayInfo.ChannelMeta == nil || !relayInfo.IsModelMapped) {
		return
	}
	other.SetPublic("response_model", *observation)
}

func appendParamOverrideInfo(relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil || other == nil || len(relayInfo.ParamOverrideAudit) == 0 {
		return
	}
	other.SetPublic("po", relayInfo.ParamOverrideAudit)
}

func appendStreamStatus(relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil || other == nil || !relayInfo.IsStream || relayInfo.StreamStatus == nil {
		return
	}
	ss := relayInfo.StreamStatus
	status := "ok"
	if !ss.IsNormalEnd() || ss.HasErrors() || ss.ResponseFailed() {
		status = "error"
	}
	streamInfo := map[string]any{
		"status":     status,
		"end_reason": string(ss.EndReason),
	}
	if outcome := ss.ResponseOutcome(); outcome != "" {
		streamInfo["response_status"] = outcome
	}
	if ss.EndError != nil {
		streamInfo["end_error"] = ss.EndError.Error()
	}
	if ss.ErrorCount > 0 {
		streamInfo["error_count"] = ss.ErrorCount
		messages := make([]string, 0, len(ss.Errors))
		for _, e := range ss.Errors {
			messages = append(messages, e.Message)
		}
		streamInfo["errors"] = messages
	}
	other.SetPublic("stream_status", streamInfo)
}

func appendBillingInfo(relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil || other == nil {
		return
	}
	// billing_source: "wallet" or "subscription"
	if relayInfo.BillingSource != "" {
		other.SetPublic("billing_source", relayInfo.BillingSource)
	}
	if relayInfo.UserSetting.BillingPreference != "" {
		other.SetPublic("billing_preference", relayInfo.UserSetting.BillingPreference)
	}
	if relayInfo.BillingSource == "subscription" {
		if relayInfo.SubscriptionId != 0 {
			other.SetPublic("subscription_id", relayInfo.SubscriptionId)
		}
		if relayInfo.SubscriptionPreConsumed > 0 {
			other.SetPublic("subscription_pre_consumed", relayInfo.SubscriptionPreConsumed)
		}
		// post_delta: settlement delta applied after actual usage is known (can be negative for refund)
		if relayInfo.SubscriptionPostDelta != 0 {
			other.SetPublic("subscription_post_delta", relayInfo.SubscriptionPostDelta)
		}
		if relayInfo.SubscriptionPlanId != 0 {
			other.SetPublic("subscription_plan_id", relayInfo.SubscriptionPlanId)
		}
		if relayInfo.SubscriptionPlanTitle != "" {
			other.SetPublic("subscription_plan_title", relayInfo.SubscriptionPlanTitle)
		}
		// Compute "this request" subscription consumed + remaining
		consumed := relayInfo.SubscriptionPreConsumed + relayInfo.SubscriptionPostDelta
		usedFinal := relayInfo.SubscriptionAmountUsedAfterPreConsume + relayInfo.SubscriptionPostDelta
		if consumed < 0 {
			consumed = 0
		}
		if usedFinal < 0 {
			usedFinal = 0
		}
		if relayInfo.SubscriptionAmountTotal > 0 {
			remain := max(relayInfo.SubscriptionAmountTotal-usedFinal, 0)
			other.SetPublic("subscription_total", relayInfo.SubscriptionAmountTotal)
			other.SetPublic("subscription_used", usedFinal)
			other.SetPublic("subscription_remain", remain)
		}
		if consumed > 0 {
			other.SetPublic("subscription_consumed", consumed)
		}
		// Wallet quota is not deducted when billed from subscription.
		other.SetPublic("wallet_quota_deducted", 0)
	}
}

func appendRequestConversionChain(relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil || other == nil {
		return
	}
	if len(relayInfo.RequestConversionChain) == 0 {
		return
	}
	chain := make([]string, 0, len(relayInfo.RequestConversionChain))
	for _, f := range relayInfo.RequestConversionChain {
		switch f {
		case types.RelayFormatOpenAI:
			chain = append(chain, "OpenAI Compatible")
		case types.RelayFormatClaude:
			chain = append(chain, "Claude Messages")
		case types.RelayFormatGemini:
			chain = append(chain, "Google Gemini")
		case types.RelayFormatOpenAIResponses:
			chain = append(chain, "OpenAI Responses")
		default:
			chain = append(chain, string(f))
		}
	}
	if len(chain) == 0 {
		return
	}
	other.SetPublic("request_conversion", chain)
}

func appendFinalRequestFormat(relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil || other == nil {
		return
	}
	if relayInfo.GetFinalRequestRelayFormat() == types.RelayFormatClaude {
		// claude indicates the final upstream request format is Claude Messages.
		// Frontend log rendering uses this to keep the original Claude input display.
		other.SetPublic("claude", true)
	}
}

func GenerateWssOtherInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage, modelRatio, groupRatio, completionRatio, audioRatio, audioCompletionRatio, modelPrice, userGroupRatio float64) *model.LogOther {
	info := GenerateTextOtherInfo(ctx, relayInfo, modelRatio, groupRatio, completionRatio, 0, 0.0, modelPrice, userGroupRatio)
	info.SetPublic("ws", true)
	info.SetPublic("audio_input", usage.InputTokenDetails.AudioTokens)
	info.SetPublic("audio_output", usage.OutputTokenDetails.AudioTokens)
	info.SetPublic("text_input", usage.InputTokenDetails.TextTokens)
	info.SetPublic("text_output", usage.OutputTokenDetails.TextTokens)
	info.SetPublic("audio_ratio", audioRatio)
	info.SetPublic("audio_completion_ratio", audioCompletionRatio)
	return info
}

func GenerateAudioOtherInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, modelRatio, groupRatio, completionRatio, audioRatio, audioCompletionRatio, modelPrice, userGroupRatio float64) *model.LogOther {
	info := GenerateTextOtherInfo(ctx, relayInfo, modelRatio, groupRatio, completionRatio, 0, 0.0, modelPrice, userGroupRatio)
	info.SetPublic("audio", true)
	info.SetPublic("audio_input", usage.PromptTokensDetails.AudioTokens)
	info.SetPublic("audio_output", usage.CompletionTokenDetails.AudioTokens)
	info.SetPublic("text_input", usage.PromptTokensDetails.TextTokens)
	info.SetPublic("text_output", usage.CompletionTokenDetails.TextTokens)
	info.SetPublic("audio_ratio", audioRatio)
	info.SetPublic("audio_completion_ratio", audioCompletionRatio)
	return info
}

func GenerateClaudeOtherInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, modelRatio, groupRatio, completionRatio float64,
	cacheTokens int, cacheRatio float64,
	cacheCreationTokens int, cacheCreationRatio float64,
	cacheCreationTokens5m int, cacheCreationRatio5m float64,
	cacheCreationTokens1h int, cacheCreationRatio1h float64,
	modelPrice float64, userGroupRatio float64) *model.LogOther {
	info := GenerateTextOtherInfo(ctx, relayInfo, modelRatio, groupRatio, completionRatio, cacheTokens, cacheRatio, modelPrice, userGroupRatio)
	info.SetPublic("claude", true)
	info.SetPublic("cache_creation_tokens", cacheCreationTokens)
	info.SetPublic("cache_creation_ratio", cacheCreationRatio)
	if cacheCreationTokens5m != 0 {
		info.SetPublic("cache_creation_tokens_5m", cacheCreationTokens5m)
		info.SetPublic("cache_creation_ratio_5m", cacheCreationRatio5m)
	}
	if cacheCreationTokens1h != 0 {
		info.SetPublic("cache_creation_tokens_1h", cacheCreationTokens1h)
		info.SetPublic("cache_creation_ratio_1h", cacheCreationRatio1h)
	}
	return info
}

func GenerateMjOtherInfo(relayInfo *relaycommon.RelayInfo, priceData hosttypes.PriceData) *model.LogOther {
	other := model.NewLogOther()
	other.SetPublic("model_price", priceData.ModelPrice)
	other.SetPublic("group_ratio", priceData.GroupRatioInfo.GroupRatio)
	if priceData.GroupRatioInfo.HasSpecialRatio {
		other.SetPublic("user_group_ratio", priceData.GroupRatioInfo.GroupSpecialRatio)
	}
	appendRequestPath(nil, relayInfo, other)
	AppendClientInfo(relayInfo, other)
	return other
}

// InjectTieredBillingInfo overlays tiered billing fields onto an existing
// module-specific other map. Call this after GenerateTextOtherInfo /
// GenerateClaudeOtherInfo / etc. when the request used tiered_expr billing.
func InjectTieredBillingInfo(other *model.LogOther, relayInfo *relaycommon.RelayInfo, result *billingexpr.TieredResult) {
	if relayInfo == nil || other == nil {
		return
	}
	snap := relayInfo.TieredBillingSnapshot
	if snap == nil {
		return
	}
	other.SetPublic("billing_mode", "tiered_expr")
	other.SetPublic("expr_b64", base64.StdEncoding.EncodeToString([]byte(snap.ExprString)))
	if result != nil {
		if tokens := result.BillingTokens; tokens != nil && result.BillingUnit == billingexpr.BillingUnitToken {
			other.SetPublic("image_cache_tokens", tokens.ImgCR)
			other.SetPublic("billing_tokens", map[string]float64{
				"p": tokens.P, "c": tokens.C, "len": tokens.Len,
				"cr": tokens.CR, "cc": tokens.CC, "cc1h": tokens.CC1h,
				"img": tokens.Img, "img_cr": tokens.ImgCR, "img_o": tokens.ImgO,
				"ai": tokens.AI, "ao": tokens.AO,
			})
		}
		if result.ImageCount != nil {
			other.SetPublic("image_count", *result.ImageCount)
		}
		other.SetPublic("matched_tier", result.MatchedTier)
		if result.BillingUnit != "" {
			other.SetPublic("billing_unit", result.BillingUnit)
		}
		if result.FixedPrice != nil {
			other.SetPublic("fixed_price", *result.FixedPrice)
		}
		if len(result.RequestRules) > 0 {
			other.SetPublic("request_rules", result.RequestRules)
		}
	} else if snap.EstimatedBillingUnit != "" {
		if snap.EstimatedImageCount != nil {
			other.SetPublic("image_count", *snap.EstimatedImageCount)
		}
		other.SetPublic("matched_tier", snap.EstimatedTier)
		other.SetPublic("billing_unit", snap.EstimatedBillingUnit)
		if snap.EstimatedFixedPrice != nil {
			other.SetPublic("fixed_price", *snap.EstimatedFixedPrice)
		}
	}
}
