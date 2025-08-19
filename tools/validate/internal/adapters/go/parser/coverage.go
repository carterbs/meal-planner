package parser

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/bradcarter-meal-planner/tools/validate/internal/runner"
)

// ParseCoverageProfile parses a Go coverage profile file and returns coverage information.
func ParseCoverageProfile(profilePath string) (*runner.Coverage, error) {
	file, err := os.Open(profilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open coverage profile: %w", err)
	}
	defer file.Close()

	coverage := &runner.Coverage{
		Details: make(map[string]runner.FileCoverage),
	}

	var totalStatements, coveredStatements int
	fileStats := make(map[string]*fileCoverageStats)

	scanner := bufio.NewScanner(file)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())

		// Skip the mode line (first line)
		if lineNum == 1 && strings.HasPrefix(line, "mode:") {
			continue
		}

		if line == "" {
			continue
		}

		// Parse coverage line: filename:startline.startcol,endline.endcol numstmt count
		parts := strings.Fields(line)
		if len(parts) != 3 {
			continue
		}

		// Extract filename
		colonIdx := strings.LastIndex(parts[0], ":")
		if colonIdx == -1 {
			continue
		}
		filename := parts[0][:colonIdx]

		// Parse number of statements
		numStmt, err := strconv.Atoi(parts[1])
		if err != nil {
			continue
		}

		// Parse count
		count, err := strconv.Atoi(parts[2])
		if err != nil {
			continue
		}

		// Initialize file stats if not exists
		if fileStats[filename] == nil {
			fileStats[filename] = &fileCoverageStats{}
		}

		// Update statistics
		totalStatements += numStmt
		fileStats[filename].Total += numStmt

		if count > 0 {
			coveredStatements += numStmt
			fileStats[filename].Covered += numStmt
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading coverage profile: %w", err)
	}

	// Calculate overall percentage
	if totalStatements > 0 {
		coverage.Percentage = float64(coveredStatements) / float64(totalStatements) * 100
	}
	coverage.Covered = coveredStatements
	coverage.Total = totalStatements

	// Calculate per-file coverage
	for filename, stats := range fileStats {
		var percentage float64
		if stats.Total > 0 {
			percentage = float64(stats.Covered) / float64(stats.Total) * 100
		}

		coverage.Details[filename] = runner.FileCoverage{
			Percentage: percentage,
			Covered:    stats.Covered,
			Total:      stats.Total,
		}
	}

	return coverage, nil
}

type fileCoverageStats struct {
	Covered int
	Total   int
}
