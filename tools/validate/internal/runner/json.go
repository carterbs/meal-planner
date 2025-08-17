package runner

import (
	"encoding/json"
	"time"
)

// MarshalJSON implements custom JSON marshaling for Result.
func (r Result) MarshalJSON() ([]byte, error) {
	// Create a type alias to avoid infinite recursion
	type resultAlias Result
	
	// Create an anonymous struct with the duration as a string
	return json.Marshal(&struct {
		resultAlias
		Duration string `json:"duration"`
	}{
		resultAlias: resultAlias(r),
		Duration:    r.Duration.String(),
	})
}

// UnmarshalJSON implements custom JSON unmarshaling for Result.
func (r *Result) UnmarshalJSON(data []byte) error {
	// Create a type alias to avoid infinite recursion
	type resultAlias Result
	
	// Create an anonymous struct with the duration as a string
	aux := &struct {
		*resultAlias
		Duration string `json:"duration"`
	}{
		resultAlias: (*resultAlias)(r),
	}
	
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	
	// Parse the duration string
	duration, err := time.ParseDuration(aux.Duration)
	if err != nil {
		return err
	}
	r.Duration = duration
	
	return nil
}

// ToJSON converts the result to a JSON string.
func (r Result) ToJSON() (string, error) {
	data, err := json.Marshal(r)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// FromJSON creates a Result from a JSON string.
func FromJSON(jsonStr string) (Result, error) {
	var r Result
	err := json.Unmarshal([]byte(jsonStr), &r)
	return r, err
}