package billing_setting

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/samber/lo"
)

const (
	BillingModeRatio      = "ratio"
	BillingModeTieredExpr = "tiered_expr"
	BillingModeField      = "billing_mode"
	BillingExprField      = "billing_expr"
	GroupBillingExprField = "group_billing_expr"
	maxTaskExprSmokeTests = 64
)

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr
type BillingSetting struct {
	BillingMode      map[string]string            `json:"billing_mode"`
	BillingExpr      map[string]string            `json:"billing_expr"`
	GroupBillingExpr map[string]map[string]string `json:"group_billing_expr"`
}

var billingSetting = BillingSetting{
	BillingMode:      make(map[string]string),
	BillingExpr:      make(map[string]string),
	GroupBillingExpr: make(map[string]map[string]string),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
	if mode, ok := billingSetting.BillingMode[model]; ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	expr, ok := billingSetting.BillingExpr[model]
	return expr, ok
}

// ResolveBillingExpr returns the group-specific final-price expression when
// configured, otherwise it falls back to the model-wide tiered expression.
// Group-specific expressions already represent the final customer price and
// therefore must not be multiplied by the normal group ratio again.
func ResolveBillingExpr(model, group string) (expr string, groupOverride bool, ok bool) {
	if models, exists := billingSetting.GroupBillingExpr[group]; exists {
		if expr, exists = models[model]; exists && strings.TrimSpace(expr) != "" {
			return expr, true, true
		}
	}
	if GetBillingMode(model) != BillingModeTieredExpr {
		return "", false, false
	}
	expr, ok = GetBillingExpr(model)
	return expr, false, ok && strings.TrimSpace(expr) != ""
}

func HasGroupBillingExprForModel(model string) bool {
	for _, models := range billingSetting.GroupBillingExpr {
		if expr, ok := models[model]; ok && strings.TrimSpace(expr) != "" {
			return true
		}
	}
	return false
}

func GetBillingModeCopy() map[string]string {
	return lo.Assign(billingSetting.BillingMode)
}

func GetBillingExprCopy() map[string]string {
	return lo.Assign(billingSetting.BillingExpr)
}

func GetGroupBillingExprCopy() map[string]map[string]string {
	result := make(map[string]map[string]string, len(billingSetting.GroupBillingExpr))
	for group, models := range billingSetting.GroupBillingExpr {
		result[group] = lo.Assign(models)
	}
	return result
}

func RemapGroupBillingExprJSON(jsonStr string, renames map[string]string) (string, error) {
	values := make(map[string]map[string]string)
	if strings.TrimSpace(jsonStr) != "" {
		if err := common.UnmarshalJsonStr(jsonStr, &values); err != nil {
			return "", err
		}
	}
	ratio_setting.RemapGroupKeys(values, renames)
	data, err := common.Marshal(values)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func PruneGroupBillingExprJSON(jsonStr string, validGroups map[string]float64) (string, bool, error) {
	groupExprs := make(map[string]map[string]string)
	if strings.TrimSpace(jsonStr) != "" {
		if err := common.UnmarshalJsonStr(jsonStr, &groupExprs); err != nil {
			return "", false, err
		}
	}
	changed := false
	for group := range groupExprs {
		if _, ok := validGroups[group]; ok {
			continue
		}
		delete(groupExprs, group)
		changed = true
	}
	if !changed {
		return jsonStr, false, nil
	}
	data, err := common.Marshal(groupExprs)
	if err != nil {
		return "", false, err
	}
	return string(data), true, nil
}

// PruneGroupBillingExpr removes overrides for groups that no longer exist in
// GroupRatio. Remaining stale names after an explicit rename cascade are dropped.
func PruneGroupBillingExpr(validGroups map[string]float64) (string, bool, error) {
	data, err := common.Marshal(GetGroupBillingExprCopy())
	if err != nil {
		return "", false, err
	}
	return PruneGroupBillingExprJSON(string(data), validGroups)
}

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 3)
	if modes := GetBillingModeCopy(); len(modes) > 0 {
		extra[BillingModeField] = modes
	}
	if exprs := GetBillingExprCopy(); len(exprs) > 0 {
		extra[BillingExprField] = exprs
	}
	if groupExprs := GetGroupBillingExprCopy(); len(groupExprs) > 0 {
		extra[GroupBillingExprField] = groupExprs
	}
	return lo.Assign(base, extra)
}

func ValidateGroupBillingExpr(value string) error {
	var groups map[string]map[string]string
	if err := common.UnmarshalJsonStr(value, &groups); err != nil {
		return fmt.Errorf("invalid group billing expression JSON: %w", err)
	}
	for group, models := range groups {
		if strings.TrimSpace(group) == "" {
			return fmt.Errorf("group name must not be empty")
		}
		for model, expr := range models {
			if strings.TrimSpace(model) == "" {
				return fmt.Errorf("model name in group %s must not be empty", group)
			}
			if strings.TrimSpace(expr) == "" {
				return fmt.Errorf("billing expression for group %s model %s must not be empty", group, model)
			}
			if err := SmokeTestExpr(expr); err != nil {
				return fmt.Errorf("invalid billing expression for group %s model %s: %w", group, model, err)
			}
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return smokeTestExpr(exprStr)
}

func smokeTestExpr(exprStr string) error {
	if _, err := billingexpr.CompileFromCache(exprStr); err != nil {
		return err
	}
	usageKeys := billingexpr.UsedUsageKeys(exprStr)
	if len(usageKeys) > 0 {
		sortedKeys := make([]string, 0, len(usageKeys))
		for key := range usageKeys {
			sortedKeys = append(sortedKeys, key)
		}
		sort.Strings(sortedKeys)
		return fmt.Errorf("expression references usage keys %v but the model has no task plugin usage schema", sortedKeys)
	}

	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
	}

	for _, v := range vectors {
		for _, request := range billingExprSmokeRequests() {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if math.IsNaN(result) || math.IsInf(result, 0) || result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result must be finite and non-negative, got %f", v.P, v.C, result)
			}
		}
	}
	return nil
}

// SmokeTestTaskExpr validates a task usage expression against the usage facts
// declared by its plugin. Literal u() keys must be declared; dynamic calls are
// still exercised by the generated runtime vectors when possible.
func SmokeTestTaskExpr(exprStr string, schema map[string]jsplugin.UsageFieldSchema) error {
	if _, err := billingexpr.CompileFromCache(exprStr); err != nil {
		return err
	}
	for key := range billingexpr.UsedUsageKeys(exprStr) {
		if _, declared := schema[key]; !declared {
			return fmt.Errorf("usage key %q is not declared by the task plugin", key)
		}
	}

	for _, usage := range taskUsageSmokeVectors(schema) {
		for _, request := range billingExprSmokeRequests() {
			request.Usage = usage
			result, _, err := billingexpr.RunExprWithRequest(exprStr, billingexpr.TokenParams{}, request)
			if err != nil {
				return fmt.Errorf("usage vector %v: run failed: %w", usage, err)
			}
			if math.IsNaN(result) || math.IsInf(result, 0) || result < 0 {
				return fmt.Errorf("usage vector %v: result must be finite and non-negative, got %f", usage, result)
			}
		}
	}
	return nil
}

type usageSmokeDimension struct {
	name   string
	values []any
}

func taskUsageSmokeVectors(schema map[string]jsplugin.UsageFieldSchema) []map[string]any {
	names := make([]string, 0, len(schema))
	for name := range schema {
		names = append(names, name)
	}
	sort.Strings(names)

	dimensions := make([]usageSmokeDimension, 0, len(names))
	for _, name := range names {
		field := schema[name]
		if len(field.Enum) > 0 {
			values := make([]any, len(field.Enum))
			for index, value := range field.Enum {
				values[index] = value
			}
			dimensions = append(dimensions, usageSmokeDimension{name: name, values: values})
			continue
		}
		if field.Type == "boolean" {
			dimensions = append(dimensions, usageSmokeDimension{name: name, values: []any{false, true}})
			continue
		}
		limit := relaycommon.MaxTaskDurationSeconds
		if field.Unit == "count" {
			limit = dto.MaxImageN
		}
		if field.Unit == "token" || field.Unit == "credit" {
			limit = common.MaxQuota
		}
		dimensions = append(dimensions, usageSmokeDimension{
			name:   name,
			values: []any{float64(0), float64(1), float64(limit)},
		})
	}

	if usageSmokeCombinationCount(dimensions, maxTaskExprSmokeTests) > maxTaskExprSmokeTests {
		for index := range dimensions {
			field := schema[dimensions[index].name]
			if len(field.Enum) <= 2 {
				continue
			}
			dimensions[index].values = []any{field.Enum[0], field.Enum[len(field.Enum)-1]}
		}
	}

	vectors := make([]map[string]any, 0, maxTaskExprSmokeTests)
	var appendVectors func(int, map[string]any)
	appendVectors = func(index int, current map[string]any) {
		if len(vectors) >= maxTaskExprSmokeTests {
			return
		}
		if index == len(dimensions) {
			vector := make(map[string]any, len(current))
			for key, value := range current {
				vector[key] = value
			}
			vectors = append(vectors, vector)
			return
		}
		for _, value := range dimensions[index].values {
			current[dimensions[index].name] = value
			appendVectors(index+1, current)
		}
		delete(current, dimensions[index].name)
	}
	appendVectors(0, make(map[string]any, len(dimensions)))

	combinationCount := usageSmokeCombinationCount(dimensions, maxTaskExprSmokeTests)
	if combinationCount > maxTaskExprSmokeTests && len(vectors) > 0 {
		last := make(map[string]any, len(dimensions))
		for _, dimension := range dimensions {
			last[dimension.name] = dimension.values[len(dimension.values)-1]
		}
		vectors[len(vectors)-1] = last
	}
	return vectors
}

func usageSmokeCombinationCount(dimensions []usageSmokeDimension, stopAfter int) int {
	count := 1
	for _, dimension := range dimensions {
		if len(dimension.values) == 0 {
			return 0
		}
		if count > stopAfter/len(dimension.values) {
			return stopAfter + 1
		}
		count *= len(dimension.values)
	}
	return count
}

func billingExprSmokeRequests() []billingexpr.RequestInput {
	return []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}
}
