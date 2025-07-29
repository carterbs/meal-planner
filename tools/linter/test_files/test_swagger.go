package test

// @Summary Test endpoint with non-proto response
// @Description This should trigger a violation
// @Accept json
// @Produce json
// @Success 200 {object} TestResponse "Success"
// @Router /test [get]
func testHandler() {
	// Handler implementation
}

// @Summary Good endpoint with proto response
// @Description This should not trigger a violation
// @Accept json
// @Produce json
// @Success 200 {object} apipb.TestResponse "Success"
// @Router /test/good [get]
func goodHandler() {
	// Handler implementation
}

// TestResponse is a custom response type (should not be used in Swagger)
type TestResponse struct {
	Message string `json:"message"`
	Status  string `json:"status"`
}