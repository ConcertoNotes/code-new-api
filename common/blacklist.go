package common

import (
	"fmt"
	"net"
	"strings"
	"sync"
)

var blacklistState = struct {
	sync.RWMutex
	emails map[string]struct{}
	ips    map[string]struct{}
}{
	emails: make(map[string]struct{}),
	ips:    make(map[string]struct{}),
}

func NormalizeBlacklistEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func NormalizeBlacklistIP(ip string) (string, bool) {
	parsed := net.ParseIP(strings.TrimSpace(ip))
	if parsed == nil {
		return "", false
	}
	return parsed.String(), true
}

func ParseBlacklistEmails(raw string) []string {
	seen := make(map[string]struct{})
	result := make([]string, 0)
	for _, line := range strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n") {
		email := NormalizeBlacklistEmail(line)
		if email == "" {
			continue
		}
		if _, exists := seen[email]; exists {
			continue
		}
		seen[email] = struct{}{}
		result = append(result, email)
	}
	return result
}

func ParseBlacklistIPs(raw string) ([]string, error) {
	seen := make(map[string]struct{})
	result := make([]string, 0)
	for _, line := range strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		ip, ok := NormalizeBlacklistIP(trimmed)
		if !ok {
			return nil, fmt.Errorf("invalid blacklist IP %q", trimmed)
		}
		if _, exists := seen[ip]; exists {
			continue
		}
		seen[ip] = struct{}{}
		result = append(result, ip)
	}
	return result, nil
}

func SetBlacklistEmails(emails []string) {
	parsed := make(map[string]struct{}, len(emails))
	for _, email := range emails {
		if normalized := NormalizeBlacklistEmail(email); normalized != "" {
			parsed[normalized] = struct{}{}
		}
	}
	blacklistState.Lock()
	blacklistState.emails = parsed
	blacklistState.Unlock()
}

func SetBlacklistIPs(ips []string) {
	parsed := make(map[string]struct{}, len(ips))
	for _, ip := range ips {
		if normalized, ok := NormalizeBlacklistIP(ip); ok {
			parsed[normalized] = struct{}{}
		}
	}
	blacklistState.Lock()
	blacklistState.ips = parsed
	blacklistState.Unlock()
}

func IsBlacklistedEmail(email string) bool {
	normalized := NormalizeBlacklistEmail(email)
	blacklistState.RLock()
	_, exists := blacklistState.emails[normalized]
	blacklistState.RUnlock()
	return exists
}

func IsBlacklistedIP(ip string) bool {
	normalized, ok := NormalizeBlacklistIP(ip)
	if !ok {
		return false
	}
	blacklistState.RLock()
	_, exists := blacklistState.ips[normalized]
	blacklistState.RUnlock()
	return exists
}
