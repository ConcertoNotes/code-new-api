package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateGroupUserAllowlistJSON(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		wantErr bool
	}{
		{name: "valid", value: `{"private":[1,2]}`},
		{name: "empty allowlist", value: `{"private":[]}`},
		{name: "invalid JSON", value: `{"private":`, wantErr: true},
		{name: "empty group", value: `{"": [1]}`, wantErr: true},
		{name: "zero user ID", value: `{"private":[0]}`, wantErr: true},
		{name: "duplicate user ID", value: `{"private":[1,1]}`, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateGroupUserAllowlistJSON(test.value)
			if test.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
