package logging

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsVerboseDefaultFalse(t *testing.T) {
	os.Unsetenv("VERBOSE_MEAL_PLAN_LOGS")
	ResetForTest()
	assert.False(t, IsVerbose())
}

func TestIsVerboseEnvVar(t *testing.T) {
	os.Setenv("VERBOSE_MEAL_PLAN_LOGS", "true")
	ResetForTest()
	assert.True(t, IsVerbose())
	os.Unsetenv("VERBOSE_MEAL_PLAN_LOGS")
}
