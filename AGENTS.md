# Repository Guidelines

## Project Structure and Module Organization
- `function/` contains the AWS Lambda entrypoint (`main.go`).
- `star/` holds the star retrieval and orchestration logic.
- `awesome/` manages downloading and parsing awesome lists.
- `markdown/` contains Markdown parsing/rendering utilities and tests.
- `git/` wraps GitHub client interactions.
- `bin/` is the build output (Lambda binary). `.serverless/` holds deployment artifacts.

## Build, Test, and Development Commands
```sh
make mod        # Run go mod tidy to sync dependencies
make build      # Build Linux Lambda binary into bin/app
make clean      # Remove build output in bin/
make deploy     # Build + deploy with Serverless (sls deploy)
go test ./...   # Run all Go tests
go fmt ./...    # Format code with gofmt
```

## Coding Style and Naming Conventions
- Go code is expected to be formatted with `gofmt`.
- Package names are short and lower-case (e.g., `markdown`, `star`).
- File names use lower snake case (e.g., `awesome_list.go`).
- Keep functions small and focused; follow standard Go error handling.

## Testing Guidelines
- Tests live alongside source files and use `_test.go` naming.
- Current tests are in `markdown/` and use `testify`.
- Run all tests with `go test ./...` before deploying.

## Commit and Pull Request Guidelines
- Recent commits use short, imperative summaries; some follow conventional prefixes (e.g., `chore:`).
- Use concise commit messages that explain intent (e.g., `fix: handle empty list`).
- Commit changes frequently, keeping each commit focused and incremental.
- PRs should include a clear description, testing notes, and any relevant logs/screenshots for behavior changes.

## Configuration and Secrets
- The Lambda expects `GITHUB_TOKEN` (see `serverless.yml`).
- Use local env management (`.envrc` or shell exports); do not commit secrets.
