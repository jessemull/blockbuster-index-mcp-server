.PHONY: help lint format format-check test test-watch coverage build clean commit \
	signal signal-container ecs-run ecs-run-all bastion preflight ci

SIGNAL ?=

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: ## Run ESLint
	npm run lint

format: ## Format with Prettier
	npm run format

format-check: ## Check Prettier formatting
	npm run format:check

test: ## Run Jest tests
	npm test

test-watch: ## Run Jest in watch mode
	npm run test:watch

coverage: ## Run tests with coverage and open report
	npm test -- --coverage
	npm run coverage:open

build: ## Webpack production build (set SIGNAL_TYPE for a specific signal)
	npm run build

clean: ## Remove dist/
	npm run clean

commit: ## Interactive Commitizen commit
	npm run commit

signal: ## Run a signal locally (make signal SIGNAL=amazon)
	@if [ -z "$(SIGNAL)" ]; then echo "Usage: make signal SIGNAL=<name>"; exit 1; fi
	npm run signal -- $(SIGNAL)

signal-container: ## Build and run a signal in Docker (make signal-container SIGNAL=amazon)
	@if [ -z "$(SIGNAL)" ]; then echo "Usage: make signal-container SIGNAL=<name>"; exit 1; fi
	npm run signal:container -- $(SIGNAL)

ecs-run: ## Run a single ECS task (make ecs-run SIGNAL=amazon)
	@if [ -z "$(SIGNAL)" ]; then echo "Usage: make ecs-run SIGNAL=<name>"; exit 1; fi
	npm run ecs:run -- $(SIGNAL)

ecs-run-all: ## Run all ECS signal tasks
	npm run ecs:run:all

bastion: ## SSH to bastion host
	npm run bastion

preflight: ## lint + format-check + test + build
	npm run lint
	npm run format:check
	npm test
	npm run build

ci: preflight ## Alias for preflight (CI-grade local check)
