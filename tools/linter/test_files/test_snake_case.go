package test

// TestStruct is a test struct with snake_case json tags
type TestStruct struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Age       int    `json:"age"`
	EmailAddr string `json:"email_addr"`
}

// GoodStruct is a struct with proper camelCase json tags
type GoodStruct struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Age       int    `json:"age"`
	Email     string `json:"email"`
}