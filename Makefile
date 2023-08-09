.PHONY: mod
mod:
	go mod tidy


.PHONY: build
build:
	env GOOS=linux go build -ldflags="-s -w" -o bin/app function/main.go

.PHONY: clean
clean:
	rm -rf ./bin

.PHONY: deploy
deploy: clean build
	sls deploy --verbose
