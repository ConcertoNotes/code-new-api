package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestAppendClientInfo(t *testing.T) {
	t.Run("records the raw User-Agent header as a public field", func(t *testing.T) {
		relayInfo := &relaycommon.RelayInfo{
			RequestHeaders: map[string]string{"User-Agent": "claude-cli/1.2.3 (external, cli)"},
		}
		other := model.NewLogOther()

		AppendClientInfo(relayInfo, other)

		assert.Equal(t, "claude-cli/1.2.3 (external, cli)", other.Snapshot()["client_user_agent"])
	})

	t.Run("does nothing when the User-Agent header is absent", func(t *testing.T) {
		relayInfo := &relaycommon.RelayInfo{RequestHeaders: map[string]string{}}
		other := model.NewLogOther()

		AppendClientInfo(relayInfo, other)

		_, exists := other.Snapshot()["client_user_agent"]
		assert.False(t, exists)
	})

	t.Run("does nothing when relayInfo or other is nil", func(t *testing.T) {
		assert.NotPanics(t, func() {
			AppendClientInfo(nil, model.NewLogOther())
			AppendClientInfo(&relaycommon.RelayInfo{}, nil)
		})
	})
}
