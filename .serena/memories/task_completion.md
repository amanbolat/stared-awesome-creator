When completing a change:
- Run `gofmt -w .` and `go test ./...`.
- If dependencies changed, run `go mod tidy` (or `make mod`).
- For deployment changes, ensure `make build` succeeds before `make deploy`.
- Update `README.md` if behavior or config changes.