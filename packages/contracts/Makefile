.PHONY: help test deploy clean install

help:
	@echo "StrategyForge Smart Contracts"
	@echo "=============================="
	@echo ""
	@echo "Available targets:"
	@echo "  install          - Install dependencies (OpenZeppelin contracts)"
	@echo "  test             - Run Foundry tests"
	@echo "  test-coverage    - Run tests with coverage"
	@echo "  deploy           - Deploy contracts to 0G testnet"
	@echo "  clean            - Clean build artifacts"
	@echo "  format           - Format Solidity code"
	@echo "  lint             - Lint Solidity code"
	@echo "  gas-report       - Show gas usage report"

install:
	@echo "Installing dependencies..."
	forge install OpenZeppelin/openzeppelin-contracts

test:
	@echo "Running tests..."
	forge test -v

test-coverage:
	@echo "Running tests with coverage..."
	forge coverage --report lcov

deploy:
	@echo "Deploying contracts..."
	@if [ -z "$(PRIVATE_KEY)" ]; then \
		echo "Error: PRIVATE_KEY environment variable not set"; \
		exit 1; \
	fi
	bun scripts/deploy.ts

deploy-testnet:
	@echo "Deploying to 0G testnet..."
	@NETWORK=og_testnet \
	RPC_URL=https://evmrpc-testnet.0g.ai \
	PRIVATE_KEY=$(PRIVATE_KEY) \
	bun scripts/deploy.ts

clean:
	@echo "Cleaning artifacts..."
	rm -rf out/ cache/ deployments.json

format:
	@echo "Formatting code..."
	forge fmt

lint:
	@echo "Linting code..."
	solhint 'src/**/*.sol'

gas-report:
	@echo "Running gas report..."
	forge test --gas-report

verify:
	@echo "Verifying contracts on explorer..."
	@if [ -z "$(EXPLORER_API)" ]; then \
		echo "Error: EXPLORER_API environment variable not set"; \
		exit 1; \
	fi
	forge verify-contract --chain-id 16601 \
		--etherscan-api-key $(EXPLORER_API) \
		$(CONTRACT_ADDRESS) \
		src/StrategyForgeINFT.sol:StrategyForgeINFT

.DEFAULT_GOAL := help
