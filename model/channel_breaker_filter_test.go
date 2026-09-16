package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
)

func TestFilterCandidateIDsChannelBreaker(t *testing.T) {
	primary := &Channel{Id: 910001, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled}
	backup := &Channel{Id: 910002, Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled}

	channelSyncLock.Lock()
	previous := channelsIDM
	channelsIDM = map[int]*Channel{
		910001: primary,
		910002: backup,
	}
	t.Cleanup(func() {
		channelsIDM = previous
		channelSyncLock.Unlock()
	})

	breakerFilter := func(ids ...int) dto.ChannelFilter {
		skipped := make(map[int]struct{}, len(ids))
		for _, id := range ids {
			skipped[id] = struct{}{}
		}
		return dto.ChannelFilter{Kind: dto.FilterChannelBreaker, ExcludedChannelIDs: skipped}
	}

	tests := []struct {
		name      string
		ids       []int
		filters   []dto.ChannelFilter
		wantKept  []int
		wantEmpty dto.ChannelFilterKind
	}{
		{
			name:     "cooling channel is skipped when a backup exists",
			ids:      []int{910001, 910002},
			filters:  []dto.ChannelFilter{breakerFilter(910001)},
			wantKept: []int{910002},
		},
		{
			name:     "all channels cooling falls open and keeps every candidate",
			ids:      []int{910001, 910002},
			filters:  []dto.ChannelFilter{breakerFilter(910001, 910002)},
			wantKept: []int{910001, 910002},
		},
		{
			name: "breaker fail-open still honors excluded channels from earlier attempts",
			ids:  []int{910001, 910002},
			filters: []dto.ChannelFilter{
				{Kind: dto.FilterExcludedChannels, ExcludedChannelIDs: map[int]struct{}{910001: {}}},
				breakerFilter(910002),
			},
			wantKept: []int{910002},
		},
		{
			name: "excluded channels still empty the set when nothing is left",
			ids:  []int{910001},
			filters: []dto.ChannelFilter{
				{Kind: dto.FilterExcludedChannels, ExcludedChannelIDs: map[int]struct{}{910001: {}}},
				breakerFilter(910002),
			},
			wantKept:  []int{},
			wantEmpty: dto.FilterExcludedChannels,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			kept, emptiedBy := filterCandidateIDs(testCase.ids, "gpt-4", testCase.filters)
			assert.Equal(t, testCase.wantKept, kept)
			assert.Equal(t, testCase.wantEmpty, emptiedBy)
		})
	}
}
