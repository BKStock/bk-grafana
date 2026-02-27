# Git Repository Files Integration Tests

This directory contains integration tests for the Grafana provisioning git repository files endpoints.

## Overview

These tests use [nanogit/gittest](https://github.com/grafana/nanogit/tree/main/gittest) to spin up a real Gitea server in a Docker container and perform end-to-end testing of the git repository files API.

## Test Coverage

The tests cover the following scenarios:

### Create Operations
- **Create file on default branch**: Tests creating dashboard files directly on the main branch with proper commit messages
- **Create file on new branch**: Tests creating files on a new branch that doesn't exist yet, verifying files are accessible via the `ref` query parameter

### Update Operations
- **Update file on default branch**: Tests updating existing files on the main branch and verifying changes are synced to Grafana dashboards
- **Update file on branch**: Tests updating files on a different branch using the `ref` parameter

### Delete Operations
- **Delete file on default branch**: Tests deleting files from the main branch and verifying they're removed from Grafana after sync
- **Delete file on branch**: Tests deleting files from a branch while preserving them on the main branch, using `ref` parameter to verify deletion

### Move Operations
- **Move file on default branch**: Tests moving/renaming files on the main branch using the `originalPath` parameter

### List Operations
- **List all files**: Tests listing all files in a repository root, verifying expected files are present
- **List files in subdirectory**: Tests accessing files within specific subdirectories

### Branch Operations
- **Create multiple files on same branch**: Tests creating multiple files on the same new branch and verifying they exist on that branch but not on main
- **Update file independently on different branches**: Tests that files can be updated differently on separate branches, verifying content differs by hash

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
