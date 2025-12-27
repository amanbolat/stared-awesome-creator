# Refactor Plan (TypeScript, VM, Config-Driven)

## Summary
Rewrite the current Go Lambda into a Node 24 TypeScript app that runs daily on a
Debian arm64 VM via systemd. Replace AWS/DynamoDB with a SQLite cache, use GitHub
GraphQL batching to minimize rate usage, add pluggable parsers for multiple awesome
lists, and output a Markdown table per category. Tests must be mock-only and use
fixtures, with no real GitHub API calls.

## Scope
- In: Node 24 TS rewrite, systemd timer, PAT auth, SQLite cache with env override,
  `config/lists.yml`, code-registered parser plugins, per-category tables with
  `stars | name | description`, dry-run mode, mock/fixture-only tests.
- Out: AWS/serverless/DynamoDB, real GitHub API in tests, preserving old output format.

## Tasks
### Phase 1: Architecture and scaffolding
- [ ] Define repo layout and core modules: downloader, parser, renderer, star fetcher,
      publisher, cache.
- [ ] Select TS tooling and libraries (tsconfig, lint/format, Node test runner).
- [ ] Create `config/lists.yml` schema (source repo, output repo, parser profile,
      table options) with default output naming `<source>-with-stars`.
- [ ] Add config loader and validation with clear error messages.

### Phase 2: Core pipeline and cache
- [ ] Implement pipeline skeleton and parser registry (code-based registration only).
- [ ] Build GitHub GraphQL client with batching, concurrency caps, retry/backoff, and
      rate-limit telemetry.
- [ ] Implement SQLite cache with TTL and safe locking/fallback behavior; default
      path in `/var/lib/<app>/cache.db` and env override.

### Phase 3: Markdown parsing and rendering
- [ ] Implement parsing/rendering to produce a Markdown table per category.
- [ ] Define sorting: stars descending.
- [ ] Add parser profiles for awesome-rust, awesome-zig, awesome-postgres.
- [ ] Build fixtures for each list format to validate parsing and output.

### Phase 4: Publishing and dry-run
- [ ] Implement GitHub README update via API with per-list output repo.
- [ ] Add dry-run mode to write outputs locally instead of pushing.

### Phase 5: Tests
- [ ] Add unit tests for parsing, link extraction, sorting, and table rendering.
- [ ] Add integration tests with mocked GraphQL responses and fixture markdown.
- [ ] Ensure no tests call real GitHub APIs.

### Phase 6: VM deployment
- [ ] Add systemd service and timer for daily runs on Debian arm64.
- [ ] Document PAT secret handling and log rotation.
- [ ] Provide an operational runbook (start/stop, troubleshoot, rerun).

## Acceptance Criteria
- Daily systemd runs on Debian arm64 complete without AWS dependencies.
- Per-category markdown tables with `stars | name | description` are generated.
- New lists can be added by updating `config/lists.yml` and registering a parser.
- All tests run locally using fixtures and mocks only.
