.PHONY: deps fmt lint build test
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
