.PHONY: deps fmt lint build test test-bun test-deno smoke check-package runtimes
deps:
	npm install
fmt:
	npm run format
lint:
	npm run lint && npx tsc --noEmit && npx tsc -p tsconfig.test.json --noEmit
build:
	npm run build
test:
	npm test
test-bun:
	npm run test:bun
test-deno:
	npm run test:deno
smoke: build
	npm run smoke && npm run smoke:bun && npm run smoke:deno
check-package: build
	npm run check:package
runtimes: test test-bun test-deno smoke
