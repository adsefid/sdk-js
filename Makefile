.PHONY: deps fmt lint build
deps:
	npm install
fmt:
	npm run format
lint:
	npm run lint && npx tsc --noEmit
build:
	npm run build
