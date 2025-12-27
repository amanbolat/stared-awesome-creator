Top-level structure:
- `function/`: Lambda entrypoint (`main.go`).
- `awesome/`: awesome list download + list model (`donwloader.go`, `awesome_list.go`).
- `star/`: star fetching/management logic (`manager.go`, `star.go`).
- `markdown/`: markdown parsing/rendering/writing helpers (includes tests).
- `bin/`: build output (`bin/app`).
- `serverless.yml`: deployment config and schedule.
- `Makefile`, `go.mod`, `go.sum`, `README.md`.