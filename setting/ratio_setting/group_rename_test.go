package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDetectGroupRenames(t *testing.T) {
	oldGroups := map[string]float64{"default": 1, "vip": 1}
	newGroups := map[string]float64{"default": 1, "gold": 1}
	assert.Equal(t, map[string]string{"vip": "gold"}, DetectGroupRenames(oldGroups, newGroups))
	assert.Nil(t, DetectGroupRenames(oldGroups, map[string]float64{"default": 1, "vip": 1, "gold": 1}))
	assert.Nil(t, DetectGroupRenames(oldGroups, map[string]float64{"default": 1}))
}

func TestValidateGroupRenames(t *testing.T) {
	oldGroups := map[string]float64{"default": 1, "vip": 1, "svip": 1}
	newGroups := map[string]float64{"default": 1, "gold": 1, "svip": 1}
	renames, err := ValidateGroupRenames(oldGroups, newGroups, map[string]string{"vip": "gold"})
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"vip": "gold"}, renames)

	_, err = ValidateGroupRenames(oldGroups, newGroups, map[string]string{"vip": "svip"})
	require.Error(t, err)

	_, err = ValidateGroupRenames(oldGroups, newGroups, map[string]string{"vip": "auto"})
	require.Error(t, err)
}

func TestRemapCommaSeparatedGroups(t *testing.T) {
	next, changed := RemapCommaSeparatedGroups("vip,default,vip", map[string]string{"vip": "gold"})
	assert.True(t, changed)
	assert.Equal(t, "gold,default", next)

	unchanged, changed := RemapCommaSeparatedGroups("default", map[string]string{"vip": "gold"})
	assert.False(t, changed)
	assert.Equal(t, "default", unchanged)
}

func TestRemapNestedAndSpecialGroups(t *testing.T) {
	nested := map[string]map[string]float64{
		"vip": {"default": 0.9, "vip": 0.8},
	}
	RemapNestedGroupRatio(nested, map[string]string{"vip": "gold"})
	assert.Equal(t, map[string]map[string]float64{
		"gold": {"default": 0.9, "gold": 0.8},
	}, nested)

	special := map[string]map[string]string{
		"vip": {":vip": "keep", "+:vip": "add", "-:default": "remove"},
	}
	special["vip"]["vip"] = "plain"
	RemapSpecialUsableGroups(special, map[string]string{"vip": "gold"})
	assert.Equal(t, "add", special["gold"]["+:gold"])
	assert.Equal(t, "plain", special["gold"]["gold"])
	assert.Equal(t, "remove", special["gold"]["-:default"])
}
