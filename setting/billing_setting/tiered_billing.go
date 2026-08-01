package billing_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/samber/lo"
)

const (
	BillingModeRatio      = "ratio"
	BillingModeTieredExpr = "tiered_expr"
	BillingModeField      = "billing_mode"
	BillingExprField      = "billing_expr"
	GroupBillingExprField = "group_billing_expr"
)

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr,
// billing_setting.group_billing_expr
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

// PruneGroupBillingExpr removes overrides for groups that no longer exist in
// GroupRatio. A rename is intentionally treated as deleting the old group and
// creating a new one; pricing is never migrated to a different name silently.
func PruneGroupBillingExpr(validGroups map[string]float64) (string, bool, error) {
	groupExprs := GetGroupBillingExprCopy()
	changed := false
	for group := range groupExprs {
		if _, ok := validGroups[group]; ok {
			continue
		}
		delete(groupExprs, group)
		changed = true
	}
	if !changed {
		return "", false, nil
	}
	data, err := common.Marshal(groupExprs)
	if err != nil {
		return "", false, err
	}
	return string(data), true, nil
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
	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
	}
	requests := []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}

	for _, v := range vectors {
		for _, request := range requests {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result %f < 0", v.P, v.C, result)
			}
		}
	}
	return nil
}
