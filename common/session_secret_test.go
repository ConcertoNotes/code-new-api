package common

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func restoreSessionSecretState(t *testing.T) {
	t.Helper()
	previousFile := sessionSecretFile
	previousSecret := SessionSecret
	t.Cleanup(func() {
		sessionSecretFile = previousFile
		SessionSecret = previousSecret
	})
}

func TestLoadOrCreateSessionSecretPersistsFirstBootSecretAndReusesItOnRestart(t *testing.T) {
	restoreSessionSecretState(t)
	sessionSecretFile = filepath.Join(t.TempDir(), "session.secret")

	SessionSecret = "first-boot-secret"
	loadOrCreateSessionSecret()

	persisted, err := os.ReadFile(sessionSecretFile)
	require.NoError(t, err, "first boot must persist the generated secret")
	assert.Equal(t, "first-boot-secret", string(persisted))

	// A later process start rolls a fresh in-memory secret but must adopt the
	// persisted one, otherwise stored refresh hashes no longer validate and
	// every restart forces a re-login.
	SessionSecret = "second-boot-random-secret"
	loadOrCreateSessionSecret()
	assert.Equal(t, "first-boot-secret", SessionSecret, "restart must reuse the persisted secret")
}

func TestLoadOrCreateSessionSecretRegeneratesWhenPersistedFileIsBlank(t *testing.T) {
	restoreSessionSecretState(t)
	secretFile := filepath.Join(t.TempDir(), "session.secret")
	sessionSecretFile = secretFile
	require.NoError(t, os.WriteFile(secretFile, []byte("  \n"), 0600))

	SessionSecret = "fresh-secret"
	loadOrCreateSessionSecret()

	assert.Equal(t, "fresh-secret", SessionSecret, "a blank file must not become the signing secret")
	persisted, err := os.ReadFile(secretFile)
	require.NoError(t, err)
	assert.Equal(t, "fresh-secret", string(persisted), "the blank file must be overwritten with the new secret")
}
