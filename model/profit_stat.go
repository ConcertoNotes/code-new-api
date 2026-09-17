package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// 收支统计的日趋势按本地时区分桶，时区偏移限制在 UTC±14 小时以内
const maxProfitTimezoneOffsetSeconds = 14 * 3600

// ChannelGroupUsageStat 某渠道在某分组下的消费汇总
type ChannelGroupUsageStat struct {
	ChannelId     int     `json:"channel_id"`
	UseGroup      string  `json:"use_group"`
	Requests      int64   `json:"requests"`
	Quota         int64   `json:"quota"`
	OfficialQuota float64 `json:"official_quota"`
	LastUsedAt    int64   `json:"last_used_at"`
}

// ChannelDailyUsageStat 某渠道在某分组下按天分桶的消费汇总
type ChannelDailyUsageStat struct {
	Bucket        int64   `json:"bucket"`
	ChannelId     int     `json:"channel_id"`
	UseGroup      string  `json:"use_group"`
	Quota         int64   `json:"quota"`
	OfficialQuota float64 `json:"official_quota"`
}

// ProfitChannelBrief 收支页面需要的渠道基础信息
type ProfitChannelBrief struct {
	Id     int    `json:"id"`
	Name   string `json:"name"`
	Type   int    `json:"type"`
	Status int    `json:"status"`
	Group  string `json:"group"`
}

// GetChannelGroupUsageStats 按 (渠道, 分组) 汇总时间范围内的消费日志
func GetChannelGroupUsageStats(startTimestamp int64, endTimestamp int64) ([]ChannelGroupUsageStat, error) {
	selectExpression := fmt.Sprintf(
		"channel_id, %s AS use_group, COUNT(*) AS requests, COALESCE(SUM(quota), 0) AS quota, COALESCE(SUM(%s), 0) AS official_quota, COALESCE(MAX(created_at), 0) AS last_used_at",
		logGroupCol,
		logOfficialQuotaExpression(),
	)
	var stats []ChannelGroupUsageStat
	err := LOG_DB.Model(&Log{}).
		Select(selectExpression).
		Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, startTimestamp, endTimestamp).
		Group("channel_id, " + logGroupCol).
		Scan(&stats).Error
	if err != nil {
		common.SysError("failed to query channel group usage stats: " + err.Error())
		return nil, errors.New("查询渠道收支数据失败")
	}
	return stats, nil
}

// GetChannelDailyUsageStats 按 (本地日期, 渠道, 分组) 汇总时间范围内的消费日志。
// timezoneOffsetSeconds 为本地时区相对 UTC 的偏移秒数，返回的 Bucket 为本地零点对应的 Unix 时间戳。
func GetChannelDailyUsageStats(startTimestamp int64, endTimestamp int64, timezoneOffsetSeconds int64) ([]ChannelDailyUsageStat, error) {
	if timezoneOffsetSeconds > maxProfitTimezoneOffsetSeconds || timezoneOffsetSeconds < -maxProfitTimezoneOffsetSeconds {
		return nil, errors.New("无效的时区偏移")
	}
	// 先平移到本地时间再对 86400 取模，三种数据库均支持整数取模运算
	bucketExpression := fmt.Sprintf(
		"((created_at + %d) - ((created_at + %d) %% 86400))",
		timezoneOffsetSeconds,
		timezoneOffsetSeconds,
	)
	selectExpression := fmt.Sprintf(
		"%s AS bucket, channel_id, %s AS use_group, COALESCE(SUM(quota), 0) AS quota, COALESCE(SUM(%s), 0) AS official_quota",
		bucketExpression,
		logGroupCol,
		logOfficialQuotaExpression(),
	)
	var stats []ChannelDailyUsageStat
	err := LOG_DB.Model(&Log{}).
		Select(selectExpression).
		Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, startTimestamp, endTimestamp).
		Group(bucketExpression + ", channel_id, " + logGroupCol).
		Order("bucket ASC, channel_id ASC").
		Scan(&stats).Error
	if err != nil {
		common.SysError("failed to query channel daily usage stats: " + err.Error())
		return nil, errors.New("查询渠道收支趋势失败")
	}
	// 数据库返回的是平移后的本地零点，转换回真实 Unix 时间戳
	for i := range stats {
		stats[i].Bucket -= timezoneOffsetSeconds
	}
	return stats, nil
}

// GetProfitChannelBriefs 返回全部渠道的基础信息（含禁用渠道）
func GetProfitChannelBriefs() ([]ProfitChannelBrief, error) {
	var channels []ProfitChannelBrief
	err := DB.Model(&Channel{}).
		Select("id, name, type, status, " + commonGroupCol).
		Order("id ASC").
		Scan(&channels).Error
	if err != nil {
		return nil, err
	}
	for i := range channels {
		channels[i].Group = strings.TrimSpace(channels[i].Group)
	}
	return channels, nil
}
