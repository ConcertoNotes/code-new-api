package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBlacklistEmailNormalizationAndParsing(t *testing.T) {
	require.Equal(t, "user@example.com", NormalizeBlacklistEmail("  USER@Example.COM "))
	require.Equal(t, []string{"user@example.com", "second@example.com"}, ParseBlacklistEmails(" USER@example.com\n\nsecond@example.com\nuser@example.com "))

	SetBlacklistEmails([]string{"USER@example.com"})
	require.True(t, IsBlacklistedEmail(" user@EXAMPLE.com "))
	require.False(t, IsBlacklistedEmail("other@example.com"))
}

func TestBlacklistIPNormalizationAndParsing(t *testing.T) {
	got, ok := NormalizeBlacklistIP(" 192.0.2.1 ")
	require.True(t, ok)
	require.Equal(t, "192.0.2.1", got)

	ipv6, ok := NormalizeBlacklistIP("2001:0db8:0:0:0:0:0:1")
	require.True(t, ok)
	require.Equal(t, "2001:db8::1", ipv6)

	gotIPs, err := ParseBlacklistIPs("192.0.2.1\n\n2001:0db8::1\n192.0.2.1")
	require.NoError(t, err)
	require.Equal(t, []string{"192.0.2.1", "2001:db8::1"}, gotIPs)
	_, err = ParseBlacklistIPs("not-an-ip")
	require.Error(t, err)

	SetBlacklistIPs([]string{"192.0.2.1"})
	require.True(t, IsBlacklistedIP("192.0.2.1"))
	require.False(t, IsBlacklistedIP("192.0.2.2"))
}
