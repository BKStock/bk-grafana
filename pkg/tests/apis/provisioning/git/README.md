# Git Repository Files Integration Tests

This directory contains integration tests for the Grafana provisioning git repository files endpoints.

## Overview

These tests use [nanogit/gittest](https://github.com/grafana/nanogit/tree/main/gittest) to spin up a real Gitea server in a Docker container and perform end-to-end testing of the git repository files API.

## Test Coverage

The tests cover the following scenarios:

### Create Operations
- **Create file on default branch**: Tests creating dashboard files directly on the main branch
- **Create file on new branch**: Tests creating files on a new branch that doesn't exist yet

### Update Operations
- **Update file on default branch**: Tests updating existing files on the main branch
- **Update file on branch**: Tests updating files on a different branch

### Delete Operations
- **Delete file on default branch**: Tests deleting files from the main branch and verifying they're removed from Grafana
- **Delete file on branch**: Tests deleting files from a branch while preserving them on the main branch

### Move Operations
- **Move file on default branch**: Tests moving/renaming files on the main branch

### List Operations
- **List all files**: Tests listing all files in a repository
- **List files in subdirectory**: Tests listing files within a specific directory

### Branch Operations
- **Create multiple files on same branch**: Tests creating multiple files on the same branch
- **Update file independently on different branches**: Tests that files can be updated differently on separate branches without conflicts

## Running the Tests

### Prerequisites
- Docker must be running (required by testcontainers)
- Go 1.23 or later

### Run all tests
```bash
go test ./pkg/tests/apis/provisioning/git/...
```

### Run specific test
```bash
go test ./pkg/tests/apis/provisioning/git/... -run TestIntegrationGitFiles_CreateFile
```

### Run tests with verbose output
```bash
go test -v ./pkg/tests/apis/provisioning/git/...
```

### Skip integration tests
```bash
go test -short ./pkg/tests/apis/provisioning/git/...
```

## Test Infrastructure

### gitTestHelper
The `gitTestHelper` wraps the standard K8s test helper and adds:
- Git server management via gittest
- Repository creation and configuration
- Sync job orchestration
- Dashboard verification utilities

### Key Methods

- **`runGrafanaWithGitServer(t)`**: Sets up both Grafana and a Gitea server for testing
- **`createGitRepo(t, name, initialFiles)`**: Creates a git repository with optional initial content
- **`syncAndWait(t, repoName)`**: Triggers a sync job and waits for completion
- **`waitForHealthyRepository(t, repoName)`**: Waits for repository health check to pass

## Architecture

```
┌─────────────────┐
│   Test Code     │
└────────┬────────┘
         │
         ├───────────────────┐
         │                   │
┌────────▼────────┐   ┌─────▼──────────┐
│  Grafana API    │   │  Gitea Server  │
│   (Testinfra)   │   │  (gittest)     │
└────────┬────────┘   └─────┬──────────┘
         │                  │
         │    Pull/Sync     │
         └──────────────────┘
```

## Notes

- Tests create isolated temporary directories for each repository
- The Gitea server runs in a Docker container and is automatically cleaned up
- Each test creates its own repository to avoid conflicts
- Tests verify both the git repository state and the synced Grafana resources
