package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
)

func TestShouldDisableChannelTreatsTransportFailureAsChannelFailure(t *testing.T) {
	previousEnabled := common.AutomaticDisableChannelEnabled
	previousRanges := operation_setting.AutomaticDisableStatusCodeRanges
	common.AutomaticDisableChannelEnabled = true
	operation_setting.AutomaticDisableStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: http.StatusUnauthorized, End: http.StatusUnauthorized}}
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = previousEnabled
		operation_setting.AutomaticDisableStatusCodeRanges = previousRanges
	})

	transportError := types.NewError(
		errors.New("connection refused"),
		types.ErrorCodeDoRequestFailed,
		types.ErrOptionWithStatusCode(http.StatusInternalServerError),
		types.ErrOptionWithSkipRetry(),
	)
	ordinaryServerError := types.NewErrorWithStatusCode(
		errors.New("upstream internal error"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusInternalServerError,
	)

	assert.True(t, ShouldDisableChannel(transportError))
	assert.False(t, ShouldDisableChannel(ordinaryServerError))
}
