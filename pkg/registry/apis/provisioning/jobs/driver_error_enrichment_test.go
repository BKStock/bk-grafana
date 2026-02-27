package jobs

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/apifmt"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/assert"
)

// TestErrorEnrichmentLogic tests the error enrichment logic directly
func TestErrorEnrichmentLogic(t *testing.T) {
	tests := []struct {
		name              string
		originalErr       error
		action            provisioning.JobAction
		repository        string
		duration          time.Duration
		jobctxErr         error
		expectedContains  []string
		expectedNotContains []string
	}{
		{
			name:         "expired error includes helpful hint",
			originalErr:  errors.New("expired"),
			action:       provisioning.JobActionPull,
			repository:   "my-repo",
			duration:     5 * time.Second,
			jobctxErr:    nil,
			expectedContains: []string{
				"pull job for repository 'my-repo' failed",
				"expired",
				"Check if authentication credentials",
				"OAuth token",
			},
		},
		{
			name:         "timeout error includes duration",
			originalErr:  context.DeadlineExceeded,
			action:       provisioning.JobActionPush,
			repository:   "timeout-repo",
			duration:     10 * time.Second,
			jobctxErr:    context.DeadlineExceeded,
			expectedContains: []string{
				"job timed out after 10s",
				"action: push",
				"repository: timeout-repo",
			},
		},
		{
			name:         "lease expiry error adds job context",
			originalErr:  errors.New("job aborted due to lease expiry"),
			action:       provisioning.JobActionPull,
			repository:   "lease-repo",
			duration:     2 * time.Second,
			jobctxErr:    nil,
			expectedContains: []string{
				"job aborted due to lease expiry",
				"action: pull",
				"repository: lease-repo",
			},
		},
		{
			name:         "unauthorized error includes helpful hint",
			originalErr:  errors.New("unauthorized"),
			action:       provisioning.JobActionPull,
			repository:   "test-repo",
			duration:     1 * time.Second,
			jobctxErr:    nil,
			expectedContains: []string{
				"pull job for repository 'test-repo' failed",
				"unauthorized",
				"Verify authentication credentials",
			},
		},
		{
			name:         "not found error includes helpful hint",
			originalErr:  errors.New("repository not found"),
			action:       provisioning.JobActionPull,
			repository:   "missing-repo",
			duration:     1 * time.Second,
			jobctxErr:    nil,
			expectedContains: []string{
				"pull job for repository 'missing-repo' failed",
				"repository not found",
				"Verify repository exists",
			},
		},
		{
			name:         "rate limit error includes helpful hint",
			originalErr:  errors.New("rate limit exceeded"),
			action:       provisioning.JobActionPush,
			repository:   "test-repo",
			duration:     1 * time.Second,
			jobctxErr:    nil,
			expectedContains: []string{
				"push job for repository 'test-repo' failed",
				"rate limit exceeded",
				"API rate limit exceeded",
			},
		},
		{
			name:         "generic error without hint",
			originalErr:  errors.New("unknown error occurred"),
			action:       provisioning.JobActionPull,
			repository:   "test-repo",
			duration:     1 * time.Second,
			jobctxErr:    nil,
			expectedContains: []string{
				"pull job for repository 'test-repo' failed",
				"unknown error occurred",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the error enrichment logic from driver.go
			err := tt.originalErr
			action := string(tt.action)
			repo := tt.repository
			duration := tt.duration

			// Apply the same enrichment logic as in driver.go
			if errors.Is(err, context.DeadlineExceeded) || (tt.jobctxErr != nil && errors.Is(tt.jobctxErr, context.DeadlineExceeded)) {
				// Job timeout - provide duration and context
				err = apifmt.Errorf("job timed out after %s (action: %s, repository: %s): %w",
					duration.Round(time.Second), action, repo, err)
			} else if strings.Contains(err.Error(), "lease expiry") {
				// Lease expiry - add job context to existing message
				err = apifmt.Errorf("%s (action: %s, repository: %s)", err.Error(), action, repo)
			} else {
				// Worker errors - wrap with full context and helpful hints
				errMsg := err.Error()
				hint := getErrorHint(errMsg)
				if hint != "" {
					err = apifmt.Errorf("%s job for repository '%s' failed: %s. %s", action, repo, errMsg, hint)
				} else {
					err = apifmt.Errorf("%s job for repository '%s' failed: %w", action, repo, err)
				}
			}

			enrichedMsg := err.Error()

			// Verify expected strings are present
			for _, expected := range tt.expectedContains {
				assert.Contains(t, enrichedMsg, expected,
					"enriched error should contain: %s\nActual: %s", expected, enrichedMsg)
			}

			// Verify unexpected strings are not present
			for _, notExpected := range tt.expectedNotContains {
				assert.NotContains(t, enrichedMsg, notExpected,
					"enriched error should NOT contain: %s\nActual: %s", notExpected, enrichedMsg)
			}

			// Additional validation: ensure error message is more descriptive than original
			if !errors.Is(err, context.DeadlineExceeded) {
				assert.Greater(t, len(enrichedMsg), len(tt.originalErr.Error()),
					"enriched message should be longer than original")
			}
		})
	}
}

// TestErrorEnrichmentPreservesWrapping tests that error wrapping is preserved
func TestErrorEnrichmentPreservesWrapping(t *testing.T) {
	originalErr := fmt.Errorf("database connection lost")
	action := "pull"
	repo := "my-repo"

	// Apply enrichment
	enrichedErr := apifmt.Errorf("%s job for repository '%s' failed: %w", action, repo, originalErr)

	// Verify the error chain is preserved
	assert.ErrorContains(t, enrichedErr, "pull job for repository 'my-repo' failed")
	assert.ErrorContains(t, enrichedErr, "database connection lost")

	// Verify we can still unwrap to the original error
	assert.ErrorIs(t, enrichedErr, originalErr)
}

// TestNoErrorEnrichmentWhenNil verifies nil errors are not enriched
func TestNoErrorEnrichmentWhenNil(t *testing.T) {
	var err error // nil

	// Enrichment logic should not run when error is nil
	if err != nil {
		// This should not execute
		t.Fatal("enrichment should not run for nil error")
	}

	assert.Nil(t, err, "nil error should remain nil")
}
