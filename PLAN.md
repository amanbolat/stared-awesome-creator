# Refactor Plan (TypeScript, VM, Config-Driven)

## Summary
Rewrite the current Go Lambda into a Node 24 TypeScript app that runs daily on a
Debian arm64 VM via systemd. Replace AWS/DynamoDB with a SQLite cache, use GitHub
GraphQL batching to minimize rate usage, add pluggable parsers for multiple awesome
lists, and output a Markdown table per category. Tests must be mock-only and use
fixtures, with no real GitHub API calls.

## Scope
- In: Node 24 TS rewrite, systemd timer, PAT auth, SQLite cache with env override,
  per-source config via `configs/*.yml` (one list per instance), code-registered
  parser plugins, per-category tables with `stars | name | description`, dry-run
  mode, mock/fixture-only tests.
- Out: AWS/serverless/DynamoDB, real GitHub API in tests, preserving old output format.

## Tasks
### Phase 1: Architecture and scaffolding
- [x] Define repo layout and core modules: downloader, parser, renderer, star fetcher,
      publisher, cache.
- [x] Select TS tooling and libraries (tsconfig, lint/format, Node test runner).
- [x] Create config schema (source repo, output repo, parser profile,
      table options) with default output naming `<source>-with-stars`.
- [x] Add config loader/validation and support selecting config path per instance.

### Phase 2: Core pipeline and cache
- [x] Implement pipeline skeleton and parser registry (code-based registration only).
- [x] Build GitHub GraphQL client with batching, concurrency caps, retry/backoff, and
      rate-limit telemetry.
- [x] Implement SQLite cache without TTL and safe locking/fallback behavior;
      default path in `/var/lib/<app>/cache.db` and env override.

### Phase 3: Markdown parsing and rendering
- [x] Implement parsing/rendering to produce a Markdown table per category.
- [x] Define sorting: stars descending.
- [x] Add parser profiles for awesome-rust, awesome-zig, awesome-postgres.
- [x] Build fixtures for each list format to validate parsing and output.

### Phase 4: Publishing and dry-run
- [x] Implement GitHub README update via API with per-list output repo.
- [x] Add dry-run mode to write outputs locally instead of pushing.

### Phase 5: Tests
- [x] Add unit tests for parsing, link extraction, sorting, and table rendering.
- [x] Add integration tests with mocked GraphQL responses and fixture markdown.
- [x] Ensure no tests call real GitHub APIs (use Node's built-in test runner).

### Phase 6: VM deployment
- [x] Add systemd service and timer for daily runs on Debian arm64.
- [x] Document PAT secret handling and log rotation.
- [x] Provide an operational runbook (start/stop, troubleshoot, rerun).

## Acceptance Criteria
- Daily systemd runs on Debian arm64 complete without AWS dependencies.
- Per-category markdown tables with `stars | name | description` are generated.
- New list configs can be added by creating another `configs/*.yml` and passing
  the config path per instance.
- All tests run locally using fixtures and mocks only.
