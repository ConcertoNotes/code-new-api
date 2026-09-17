package controller

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/profit_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// 收支统计允许的最大时间跨度（一年），避免全表扫描
const maxProfitRangeSeconds int64 = 366 * 24 * 3600

// ChannelProfitRow 单个渠道在单个分组下的收支明细
type ChannelProfitRow struct {
	Key           string  `json:"key"`
	ChannelId     int     `json:"channel_id"`
	ChannelName   string  `json:"channel_name"`
	ChannelType   int     `json:"channel_type"`
	ChannelStatus int     `json:"channel_status"`
	ChannelExists bool    `json:"channel_exists"`
	Hidden        bool    `json:"hidden"`
	Group         string  `json:"group"`
	SellRatio     float64 `json:"sell_ratio"`
	UpstreamRatio float64 `json:"upstream_ratio"`
	Requests      int64   `json:"requests"`
	Quota         int64   `json:"quota"`
	OfficialQuota float64 `json:"official_quota"`
	CostQuota     float64 `json:"cost_quota"`
	ProfitQuota   float64 `json:"profit_quota"`
	LastUsedAt    int64   `json:"last_used_at"`
}

// ChannelProfitTrendPoint 按天汇总的收支趋势点
type ChannelProfitTrendPoint struct {
	Date        int64   `json:"date"`
	Quota       int64   `json:"quota"`
	CostQuota   float64 `json:"cost_quota"`
	ProfitQuota float64 `json:"profit_quota"`
}

// ChannelProfitSummary 时间范围内的收支汇总（不含被移除的行）
type ChannelProfitSummary struct {
	Quota          int64   `json:"quota"`
	OfficialQuota  float64 `json:"official_quota"`
	CostQuota      float64 `json:"cost_quota"`
	ProfitQuota    float64 `json:"profit_quota"`
	Requests       int64   `json:"requests"`
	ActiveChannels int     `json:"active_channels"`
	TotalChannels  int     `json:"total_channels"`
}

func parseProfitTimeRange(c *gin.Context) (int64, int64, bool) {
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return 0, 0, false
	}
	if endTimestamp-startTimestamp > maxProfitRangeSeconds {
		common.ApiErrorMsg(c, "时间跨度不能超过 1 年")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

// ensureProfitStatsStartAt 返回统计起点；首次访问时把“现在”记为起点，之前的日志不再计入
func ensureProfitStatsStartAt() (int64, error) {
	startAt := profit_setting.GetStatsStartAt()
	if startAt > 0 {
		return startAt, nil
	}
	startAt = common.GetTimestamp()
	if err := model.UpdateOption(profit_setting.StatsStartAtOptionKey, strconv.FormatInt(startAt, 10)); err != nil {
		return 0, err
	}
	return startAt, nil
}

func toKeySet(keys []string) map[string]struct{} {
	set := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		set[key] = struct{}{}
	}
	return set
}

// GetChannelProfitStats 返回各渠道 × 分组的实时收支统计
func GetChannelProfitStats(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseProfitTimeRange(c)
	if !ok {
		return
	}
	timezoneOffset, _ := strconv.ParseInt(c.DefaultQuery("tz_offset", "0"), 10, 64)

	statsStartAt, err := ensureProfitStatsStartAt()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 统计起点之前的日志不计入
	if startTimestamp < statsStartAt {
		startTimestamp = statsStartAt
	}

	channels, err := model.GetProfitChannelBriefs()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var usageStats []model.ChannelGroupUsageStat
	var dailyStats []model.ChannelDailyUsageStat
	if endTimestamp >= startTimestamp {
		usageStats, err = model.GetChannelGroupUsageStats(startTimestamp, endTimestamp)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		dailyStats, err = model.GetChannelDailyUsageStats(startTimestamp, endTimestamp, timezoneOffset)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	groupRatios := ratio_setting.GetGroupRatioCopy()
	sellRatioOf := func(group string) float64 {
		if ratio, exists := groupRatios[group]; exists {
			return ratio
		}
		return 1
	}
	hiddenRows := profit_setting.GetHiddenRows()
	hiddenSet := toKeySet(hiddenRows)

	channelById := make(map[int]model.ProfitChannelBrief, len(channels))
	rows := make(map[string]*ChannelProfitRow)
	// 先按渠道当前所属分组生成空行，保证新增渠道即使没有用量也会出现在列表中
	for _, channel := range channels {
		channelById[channel.Id] = channel
		for _, group := range strings.Split(channel.Group, ",") {
			group = strings.TrimSpace(group)
			if group == "" {
				continue
			}
			key := profit_setting.RowKey(channel.Id, group)
			if _, exists := rows[key]; exists {
				continue
			}
			rows[key] = &ChannelProfitRow{
				Key:           key,
				ChannelId:     channel.Id,
				ChannelName:   channel.Name,
				ChannelType:   channel.Type,
				ChannelStatus: channel.Status,
				ChannelExists: true,
				Group:         group,
				SellRatio:     sellRatioOf(group),
				UpstreamRatio: profit_setting.GetChannelUpstreamRatio(channel.Id),
			}
		}
	}
	// 再把使用记录里出现的 (渠道, 分组) 组合合并进来，包含已删除渠道或已移出的分组
	for _, stat := range usageStats {
		key := profit_setting.RowKey(stat.ChannelId, stat.UseGroup)
		row, exists := rows[key]
		if !exists {
			row = &ChannelProfitRow{
				Key:           key,
				ChannelId:     stat.ChannelId,
				ChannelName:   fmt.Sprintf("#%d", stat.ChannelId),
				Group:         stat.UseGroup,
				SellRatio:     sellRatioOf(stat.UseGroup),
				UpstreamRatio: profit_setting.GetChannelUpstreamRatio(stat.ChannelId),
			}
			if channel, found := channelById[stat.ChannelId]; found {
				row.ChannelName = channel.Name
				row.ChannelType = channel.Type
				row.ChannelStatus = channel.Status
				row.ChannelExists = true
			}
			rows[key] = row
		}
		row.Requests = stat.Requests
		row.Quota = stat.Quota
		row.OfficialQuota = stat.OfficialQuota
		row.LastUsedAt = stat.LastUsedAt
	}

	summary := ChannelProfitSummary{TotalChannels: len(channels)}
	activeChannels := make(map[int]struct{})
	rowList := make([]*ChannelProfitRow, 0, len(rows))
	for _, row := range rows {
		row.CostQuota = row.OfficialQuota * row.UpstreamRatio
		row.ProfitQuota = float64(row.Quota) - row.CostQuota
		_, row.Hidden = hiddenSet[row.Key]
		rowList = append(rowList, row)
		if row.Hidden {
			continue
		}
		summary.Quota += row.Quota
		summary.OfficialQuota += row.OfficialQuota
		summary.CostQuota += row.CostQuota
		summary.ProfitQuota += row.ProfitQuota
		summary.Requests += row.Requests
		if row.Requests > 0 {
			activeChannels[row.ChannelId] = struct{}{}
		}
	}
	summary.ActiveChannels = len(activeChannels)

	// 用户拖拽过的行按保存的顺序排在前面，其余按收入降序
	rowOrder := profit_setting.GetRowOrder()
	orderIndex := make(map[string]int, len(rowOrder))
	for index, key := range rowOrder {
		orderIndex[key] = index
	}
	sort.Slice(rowList, func(i, j int) bool {
		left, leftOrdered := orderIndex[rowList[i].Key]
		right, rightOrdered := orderIndex[rowList[j].Key]
		if leftOrdered != rightOrdered {
			return leftOrdered
		}
		if leftOrdered {
			return left < right
		}
		if rowList[i].Quota != rowList[j].Quota {
			return rowList[i].Quota > rowList[j].Quota
		}
		if rowList[i].ChannelId != rowList[j].ChannelId {
			return rowList[i].ChannelId < rowList[j].ChannelId
		}
		return rowList[i].Group < rowList[j].Group
	})

	trendByDate := make(map[int64]*ChannelProfitTrendPoint)
	for _, stat := range dailyStats {
		if _, hidden := hiddenSet[profit_setting.RowKey(stat.ChannelId, stat.UseGroup)]; hidden {
			continue
		}
		point, exists := trendByDate[stat.Bucket]
		if !exists {
			point = &ChannelProfitTrendPoint{Date: stat.Bucket}
			trendByDate[stat.Bucket] = point
		}
		cost := stat.OfficialQuota * profit_setting.GetChannelUpstreamRatio(stat.ChannelId)
		point.Quota += stat.Quota
		point.CostQuota += cost
		point.ProfitQuota += float64(stat.Quota) - cost
	}
	trend := make([]*ChannelProfitTrendPoint, 0, len(trendByDate))
	for _, point := range trendByDate {
		trend = append(trend, point)
	}
	sort.Slice(trend, func(i, j int) bool { return trend[i].Date < trend[j].Date })

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"start_timestamp":        startTimestamp,
			"end_timestamp":          endTimestamp,
			"stats_start_at":         statsStartAt,
			"group_ratio":            groupRatios,
			"channel_upstream_ratio": profit_setting.GetChannelUpstreamRatioCopy(),
			"row_order":              rowOrder,
			"hidden_rows":            hiddenRows,
			"summary":                summary,
			"rows":                   rowList,
			"trend":                  trend,
		},
	})
}

type updateChannelUpstreamRatioRequest struct {
	ChannelId int     `json:"channel_id"`
	Ratio     float64 `json:"ratio"`
}

// UpdateChannelUpstreamRatio 更新某个渠道的上游倍率
func UpdateChannelUpstreamRatio(c *gin.Context) {
	var req updateChannelUpstreamRatioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "无效的参数")
		return
	}
	if req.ChannelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	jsonStr, err := profit_setting.BuildChannelUpstreamRatioJSON(req.ChannelId, req.Ratio)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOption(profit_setting.ChannelUpstreamRatioOptionKey, jsonStr); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"channel_id": req.ChannelId,
			"ratio":      req.Ratio,
		},
	})
}

// updateProfitSettingsRequest 只更新传入的字段；stats_start_at 为 0 表示“从现在开始重新统计”
type updateProfitSettingsRequest struct {
	StatsStartAt *int64    `json:"stats_start_at"`
	RowOrder     *[]string `json:"row_order"`
	HiddenRows   *[]string `json:"hidden_rows"`
}

// UpdateProfitSettings 更新统计起点、明细行顺序与被移除的行
func UpdateProfitSettings(c *gin.Context) {
	var req updateProfitSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "无效的参数")
		return
	}
	values := make(map[string]string, 3)
	if req.StatsStartAt != nil {
		startAt := *req.StatsStartAt
		if startAt < 0 || startAt > common.GetTimestamp() {
			common.ApiErrorMsg(c, "统计起点不能晚于当前时间")
			return
		}
		if startAt == 0 {
			startAt = common.GetTimestamp()
		}
		values[profit_setting.StatsStartAtOptionKey] = strconv.FormatInt(startAt, 10)
	}
	if req.RowOrder != nil {
		jsonStr, err := profit_setting.BuildRowKeysJSON(*req.RowOrder)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		values[profit_setting.RowOrderOptionKey] = jsonStr
	}
	if req.HiddenRows != nil {
		jsonStr, err := profit_setting.BuildRowKeysJSON(*req.HiddenRows)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		values[profit_setting.HiddenRowsOptionKey] = jsonStr
	}
	if len(values) == 0 {
		common.ApiErrorMsg(c, "没有需要更新的设置")
		return
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"stats_start_at": profit_setting.GetStatsStartAt(),
			"row_order":      profit_setting.GetRowOrder(),
			"hidden_rows":    profit_setting.GetHiddenRows(),
		},
	})
}
