package router

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestVideoGenerationRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetVideoRouter(engine)

	routes := make(map[string]struct{}, len(engine.Routes()))
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = struct{}{}
	}

	assert.Contains(t, routes, "POST /v1/videos")
	assert.Contains(t, routes, "GET /v1/videos/:task_id")
	assert.Contains(t, routes, "POST /v1/video/generations")
	assert.Contains(t, routes, "GET /v1/video/generations/:task_id")
	assert.NotContains(t, routes, "POST /v1/videos/generations")
}
