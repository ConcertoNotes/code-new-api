package types

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPriceDataUsesPerCallBillingDistinguishesVideoPerSecondPrice(t *testing.T) {
	tests := []struct {
		name        string
		priceData   PriceData
		legacyPatch bool
		want        bool
	}{
		{
			name:      "fixed model price is per request",
			priceData: PriceData{UsePrice: true, FixedPrice: true},
			want:      true,
		},
		{
			name:      "video per second price is not per request",
			priceData: PriceData{UsePrice: true, VideoPriceConfigured: true},
			want:      false,
		},
		{
			name:        "legacy patch remains per request without video price",
			priceData:   PriceData{},
			legacyPatch: true,
			want:        true,
		},
		{
			name:        "legacy patch yields to configured video per second price",
			priceData:   PriceData{UsePrice: true, VideoPriceConfigured: true},
			legacyPatch: true,
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, tt.priceData.UsesPerCallBilling(tt.legacyPatch))
		})
	}
}
