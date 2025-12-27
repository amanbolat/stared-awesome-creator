Common dev commands:
- `go test ./...` (run tests)
- `gofmt -w .` (format code)
- `go mod tidy` or `make mod` (sync deps)
- `make build` (build Linux Lambda binary to `bin/app`)
- `make clean` (remove `bin/`)
- `make deploy` (build + deploy via Serverless)
- `sls deploy --verbose` (direct deploy if needed)
- `go run function/main.go` (run entrypoint locally, if desired)

System utilities on Darwin:
- `git status`, `git diff` (VCS)
- `ls`, `find`, `rg` (navigation/search)
- `cd`, `pwd` (shell navigation)