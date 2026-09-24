package controller

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
)

// 会话亲和规则的 skip_retry_on_failure 只应拦住业务类错误；
// 渠道级故障（5xx/429/连接失败）必须仍能切换到其他渠道，否则故障切换对粘连会话完全失效。
func TestShouldRetryWithAffinitySkipRetryStillFailsOverOnChannelFailure(t *testing.T) {
	tests := []struct {
		name string
		err  *types.NewAPIError
		want bool
	}{
		{name: "502 fails over", err: types.NewOpenAIError(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway), want: true},
		{name: "429 fails over", err: types.NewOpenAIError(errors.New("rate limited"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests), want: true},
		{name: "connection failure fails over", err: types.NewError(errors.New("dial tcp: connection refused"), types.ErrorCodeDoRequestFailed), want: true},
		{name: "401 stays on the affinity channel", err: types.NewOpenAIError(errors.New("invalid key"), types.ErrorCodeBadResponseStatusCode, http.StatusUnauthorized), want: false},
		{name: "404 stays on the affinity channel", err: types.NewOpenAIError(errors.New("not found"), types.ErrorCodeBadResponseStatusCode, http.StatusNotFound), want: false},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			c := newPinRetryContext()
			c.Set("channel_affinity_skip_retry_on_failure", true)
			assert.Equal(t, testCase.want, service.ShouldRetryRelayError(c, testCase.err, 1))
		})
	}
}

func TestShouldRetryTaskRelayWithAffinitySkipRetryStillFailsOverOnUpstreamFailure(t *testing.T) {
	c := newPinRetryContext()
	c.Set("channel_affinity_skip_retry_on_failure", true)
	assert.Equal(t, "retry", decideTaskRetry(c, &dto.TaskError{StatusCode: http.StatusBadGateway}, 1).Action)

	local := newPinRetryContext()
	local.Set("channel_affinity_skip_retry_on_failure", true)
	assert.NotEqual(t, "retry", decideTaskRetry(local, &dto.TaskError{StatusCode: http.StatusBadGateway, LocalError: true}, 1).Action)
}
