Purpose: scheduled AWS Lambda that downloads awesome lists, extracts GitHub repo links, fetches star counts, rewrites markdown with star data, and updates the target awesome repo (per README).

Tech stack:
- Go 1.21.6 (`go.mod`).
- AWS Lambda + Serverless Framework (`serverless.yml`).
- AWS SDK + DynamoDB via `github.com/guregu/dynamo` (table `awesome_list_stars`).
- GitHub APIs via `go-github` REST and `githubv4` GraphQL with OAuth2 token.
- Markdown processing via `goldmark`; logging via `logrus`.

Entrypoint: `function/main.go` built to `bin/app` for Lambda (`make build`).

Environment:
- Requires `GITHUB_TOKEN` in env (configured in `serverless.yml`; `.envrc` sets it for local dev).