package dto

// ChannelBreakerSnapshot 渠道熔断状态快照，用于管理端展示。
type ChannelBreakerSnapshot struct {
	ChannelId  int    `json:"channel_id"`
	State      string `json:"state"` // closed / open / half_open
	Failures   int    `json:"failures"`
	Trips      int    `json:"trips"`
	OpenUntil  int64  `json:"open_until,omitempty"`  // Unix 秒
	ProbeUntil int64  `json:"probe_until,omitempty"` // Unix 秒
}
