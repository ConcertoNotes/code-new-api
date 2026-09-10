package common

import (
	"encoding/json"
	"strings"
	"sync"
)

var topupGroupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}
var topupGroupRatioMutex sync.RWMutex

func TopupGroupRatio2JSONString() string {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	jsonBytes, err := json.Marshal(topupGroupRatio)
	if err != nil {
		SysError("error marshalling topup group ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateTopupGroupRatioByJSONString(jsonStr string) error {
	topupGroupRatioMutex.Lock()
	defer topupGroupRatioMutex.Unlock()
	topupGroupRatio = make(map[string]float64)
	return json.Unmarshal([]byte(jsonStr), &topupGroupRatio)
}

func remapTopupGroupKeys(values map[string]float64, renames map[string]string) {
	if len(values) == 0 || len(renames) == 0 {
		return
	}
	pending := make(map[string]float64, len(renames))
	for oldName, newName := range renames {
		value, ok := values[oldName]
		if !ok {
			continue
		}
		delete(values, oldName)
		pending[newName] = value
	}
	for newName, value := range pending {
		if _, exists := values[newName]; !exists {
			values[newName] = value
		}
	}
}

func RemapTopupGroupRatioJSON(jsonStr string, renames map[string]string) (string, error) {
	values := make(map[string]float64)
	if strings.TrimSpace(jsonStr) != "" {
		if err := UnmarshalJsonStr(jsonStr, &values); err != nil {
			return "", err
		}
	}
	remapTopupGroupKeys(values, renames)
	data, err := Marshal(values)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func GetTopupGroupRatio(name string) float64 {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	ratio, ok := topupGroupRatio[name]
	if !ok {
		SysError("topup group ratio not found: " + name)
		return 1
	}
	return ratio
}
