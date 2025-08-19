package parser

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// JestTestResult represents the structure of Jest JSON output.
type JestTestResult struct {
	TestResults         []JestTestFile              `json:"testResults"`
	NumTotalTestSuites  int                         `json:"numTotalTestSuites"`
	NumPassedTestSuites int                         `json:"numPassedTestSuites"`
	NumFailedTestSuites int                         `json:"numFailedTestSuites"`
	NumTotalTests       int                         `json:"numTotalTests"`
	NumPassedTests      int                         `json:"numPassedTests"`
	NumFailedTests      int                         `json:"numFailedTests"`
	Success             bool                        `json:"success"`
	CoverageMap         map[string]JestFileCoverage `json:"coverageMap,omitempty"`
}

// JestTestFile represents a test file in Jest JSON output.
type JestTestFile struct {
	AssertionResults []JestAssertion             `json:"assertionResults"`
	Name             string                      `json:"name"`
	Status           string                      `json:"status"`
	Message          string                      `json:"message"`
	Coverage         map[string]JestFileCoverage `json:"coverage,omitempty"`
}

// JestAssertion represents a single test assertion in Jest output.
type JestAssertion struct {
	AncestorTitles  []string      `json:"ancestorTitles"`
	FullName        string        `json:"fullName"`
	Status          string        `json:"status"`
	Title           string        `json:"title"`
	Duration        int           `json:"duration,omitempty"`
	FailureMessages []string      `json:"failureMessages,omitempty"`
	Location        *JestLocation `json:"location,omitempty"`
}

// JestLocation represents the location of a test.
type JestLocation struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// JestFileCoverage represents coverage information for a file.
type JestFileCoverage struct {
	Path         string                   `json:"path"`
	StatementMap map[string]JestStatement `json:"statementMap"`
	S            map[string]int           `json:"s"`
	BranchMap    map[string]JestBranch    `json:"branchMap"`
	B            map[string][]int         `json:"b"`
	FnMap        map[string]JestFunction  `json:"fnMap"`
	F            map[string]int           `json:"f"`
}

// JestStatement represents a statement for coverage.
type JestStatement struct {
	Start JestPosition `json:"start"`
	End   JestPosition `json:"end"`
}

// JestBranch represents a branch for coverage.
type JestBranch struct {
	Line      int            `json:"line"`
	Type      string         `json:"type"`
	Locations []JestPosition `json:"locations"`
}

// JestFunction represents a function for coverage.
type JestFunction struct {
	Name string       `json:"name"`
	Line int          `json:"line"`
	Loc  JestLocation `json:"loc"`
}

// JestPosition represents a position in code.
type JestPosition struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// JestCoverageSummary represents the coverage summary JSON structure.
type JestCoverageSummary struct {
	Total JestCoverageMetrics            `json:"total"`
	Files map[string]JestCoverageMetrics `json:"-"`
}

// UnmarshalJSON custom unmarshaling for JestCoverageSummary
func (j *JestCoverageSummary) UnmarshalJSON(data []byte) error {
	// First unmarshal into a map to capture all fields
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	// Extract the "total" field
	if totalData, exists := raw["total"]; exists {
		if err := json.Unmarshal(totalData, &j.Total); err != nil {
			return err
		}
	}

	// Extract all other fields as files
	j.Files = make(map[string]JestCoverageMetrics)
	for key, value := range raw {
		if key != "total" {
			var metrics JestCoverageMetrics
			if err := json.Unmarshal(value, &metrics); err == nil {
				j.Files[key] = metrics
			}
		}
	}

	return nil
}

// JestCoverageMetrics represents coverage metrics for statements, branches, functions, and lines.
type JestCoverageMetrics struct {
	Lines      JestCoverageData `json:"lines"`
	Functions  JestCoverageData `json:"functions"`
	Statements JestCoverageData `json:"statements"`
	Branches   JestCoverageData `json:"branches"`
}

// JestCoverageData represents coverage data with total, covered, skipped, and percentage.
type JestCoverageData struct {
	Total   int     `json:"total"`
	Covered int     `json:"covered"`
	Skipped int     `json:"skipped"`
	Pct     float64 `json:"pct"`
}

// ParseJestJSON parses Jest JSON output and returns test results.
func ParseJestJSON(output string) (*runner.Result, error) {
	if strings.TrimSpace(output) == "" {
		return &runner.Result{
			Status:      runner.StatusSuccess,
			PassedCount: 0,
			FailedCount: 0,
		}, nil
	}

	var jestResult JestTestResult
	if err := json.Unmarshal([]byte(output), &jestResult); err != nil {
		return nil, fmt.Errorf("failed to parse Jest JSON: %w", err)
	}

	result := &runner.Result{
		Status:      runner.StatusSuccess,
		PassedCount: jestResult.NumPassedTests,
		FailedCount: jestResult.NumFailedTests,
		Failures:    []runner.Failure{},
	}

	// Determine status
	if !jestResult.Success || jestResult.NumFailedTests > 0 {
		result.Status = runner.StatusFailure
	}

	// Extract failures
	for _, testFile := range jestResult.TestResults {
		for _, assertion := range testFile.AssertionResults {
			if assertion.Status == "failed" {
				failure := runner.Failure{
					File: testFile.Name,
					Type: "test",
				}

				// Extract line number if available
				if assertion.Location != nil {
					failure.Line = assertion.Location.Line
				}

				// Extract failure message
				if len(assertion.FailureMessages) > 0 {
					failure.Message = extractFailureMessage(assertion.FailureMessages[0])
				} else {
					failure.Message = fmt.Sprintf("Test failed: %s", assertion.FullName)
				}

				result.Failures = append(result.Failures, failure)
			}
		}
	}

	// Parse coverage if available
	if len(jestResult.CoverageMap) > 0 {
		result.Coverage = parseCoverageFromMap(jestResult.CoverageMap)
	}

	return result, nil
}

// ParseJestCoverage parses Jest coverage-summary.json file.
func ParseJestCoverage(coveragePath string) (*runner.Coverage, error) {
	data, err := os.ReadFile(coveragePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read coverage file: %w", err)
	}

	var summary JestCoverageSummary
	if err := json.Unmarshal(data, &summary); err != nil {
		return nil, fmt.Errorf("failed to parse coverage JSON: %w", err)
	}

	coverage := &runner.Coverage{
		Details: make(map[string]runner.FileCoverage),
	}

	// Extract total coverage
	if summary.Total.Statements.Total > 0 {
		coverage.Percentage = summary.Total.Statements.Pct
		coverage.Covered = summary.Total.Statements.Covered
		coverage.Total = summary.Total.Statements.Total
	}

	// Extract file-level coverage (exclude 'total' key)
	for filePath, metrics := range summary.Files {
		if filePath != "total" {
			coverage.Details[filePath] = runner.FileCoverage{
				Percentage: metrics.Statements.Pct,
				Covered:    metrics.Statements.Covered,
				Total:      metrics.Statements.Total,
			}
		}
	}

	return coverage, nil
}

// ParseJestTextOutput parses Jest text output for failures when JSON is not available.
func ParseJestTextOutput(output string) *runner.Result {
	result := &runner.Result{
		Status:      runner.StatusSuccess,
		PassedCount: 0,
		FailedCount: 0,
		Failures:    []runner.Failure{},
	}

	lines := strings.Split(output, "\n")

	// Patterns for parsing test results
	testCountPattern := regexp.MustCompile(`Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total`)
	testCountPatternAlt := regexp.MustCompile(`Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total`)
	failurePattern := regexp.MustCompile(`^\s*✕\s+(.+?)(?:\s+\((\d+)\s*ms\))?$`)
	passPattern := regexp.MustCompile(`^\s*✓\s+(.+?)(?:\s+\((\d+)\s*ms\))?$`)
	filePattern := regexp.MustCompile(`^\s*●\s+(.+)$`)

	var currentFile string
	var inFailureBlock bool
	var failureLines []string
	var passedFromSummary bool

	for i, line := range lines {
		// Extract test counts
		if matches := testCountPattern.FindStringSubmatch(line); len(matches) == 4 {
			if failed, err := strconv.Atoi(matches[1]); err == nil {
				result.FailedCount = failed
			}
			if passed, err := strconv.Atoi(matches[2]); err == nil {
				result.PassedCount = passed
			}
			passedFromSummary = true
		} else if matches := testCountPatternAlt.FindStringSubmatch(line); len(matches) == 3 {
			if passed, err := strconv.Atoi(matches[1]); err == nil {
				result.PassedCount = passed
				result.FailedCount = 0
			}
			passedFromSummary = true
		}

		// Count passed tests from individual test lines only if we don't have summary
		if !passedFromSummary && passPattern.MatchString(line) {
			result.PassedCount++
		}

		// Detect failure blocks
		if matches := filePattern.FindStringSubmatch(line); len(matches) > 1 {
			currentFile = strings.TrimSpace(matches[1])
			inFailureBlock = true
			failureLines = []string{}
			continue
		}

		// Detect individual test failures
		if matches := failurePattern.FindStringSubmatch(line); len(matches) > 1 {
			failure := runner.Failure{
				File:    currentFile,
				Type:    "test",
				Message: extractTestName(matches[1]),
			}

			// Look ahead for error message
			if i+1 < len(lines) {
				nextLine := strings.TrimSpace(lines[i+1])
				if nextLine != "" && !strings.HasPrefix(nextLine, "✕") && !strings.HasPrefix(nextLine, "●") {
					failure.Message += ": " + truncateMessage(nextLine)
				}
			}

			result.Failures = append(result.Failures, failure)
			inFailureBlock = false
		}

		// Collect failure block lines
		if inFailureBlock && line != "" {
			failureLines = append(failureLines, line)
		}
	}

	// Determine overall status
	if result.FailedCount > 0 || len(result.Failures) > 0 {
		result.Status = runner.StatusFailure
	}

	// Try to extract coverage percentage if present
	coveragePattern := regexp.MustCompile(`All files\s+\|\s+([\d.]+)`)
	for _, line := range lines {
		if matches := coveragePattern.FindStringSubmatch(line); len(matches) > 1 {
			if percentage, err := strconv.ParseFloat(matches[1], 64); err == nil {
				result.Coverage = &runner.Coverage{
					Percentage: percentage,
				}
			}
			break
		}
	}

	return result
}

// Helper functions

func extractFailureMessage(message string) string {
	// Remove ANSI color codes
	ansiPattern := regexp.MustCompile(`\x1b\[[0-9;]*m`)
	cleaned := ansiPattern.ReplaceAllString(message, "")

	// Extract the first meaningful line
	lines := strings.Split(cleaned, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "at ") {
			return truncateMessage(line)
		}
	}

	return truncateMessage(cleaned)
}

func extractTestName(testName string) string {
	// Remove any timing information in parentheses
	timingPattern := regexp.MustCompile(`\s*\(\d+\s*ms\)$`)
	return strings.TrimSpace(timingPattern.ReplaceAllString(testName, ""))
}

func truncateMessage(message string) string {
	const maxLength = 200
	if len(message) <= maxLength {
		return message
	}
	return message[:maxLength] + "..."
}

func parseCoverageFromMap(coverageMap map[string]JestFileCoverage) *runner.Coverage {
	coverage := &runner.Coverage{
		Details: make(map[string]runner.FileCoverage),
	}

	var totalStatements, coveredStatements int

	for filePath, fileCoverage := range coverageMap {
		// Calculate coverage for this file
		total := len(fileCoverage.S)
		covered := 0
		for _, count := range fileCoverage.S {
			if count > 0 {
				covered++
			}
		}

		var percentage float64
		if total > 0 {
			percentage = float64(covered) / float64(total) * 100
		}

		coverage.Details[filePath] = runner.FileCoverage{
			Percentage: percentage,
			Covered:    covered,
			Total:      total,
		}

		totalStatements += total
		coveredStatements += covered
	}

	// Calculate overall coverage
	if totalStatements > 0 {
		coverage.Percentage = float64(coveredStatements) / float64(totalStatements) * 100
		coverage.Covered = coveredStatements
		coverage.Total = totalStatements
	}

	return coverage
}
