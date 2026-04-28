#!/bin/bash
set -euo pipefail

# StrategyForge Contract Deployment Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
print_error() {
  echo -e "${RED}❌ $1${NC}" >&2
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check environment variables
if [[ -z "${PRIVATE_KEY:-}" ]]; then
  print_error "PRIVATE_KEY environment variable not set"
  exit 1
fi

if [[ -z "${RPC_URL:-}" ]]; then
  print_error "RPC_URL environment variable not set"
  exit 1
fi

# Optional: load from .env if exists
if [[ -f ".env" ]]; then
  print_info "Loading environment from .env"
  export $(grep -v '^#' .env | xargs)
fi

# Get network info
NETWORK="${NETWORK:-unknown}"
print_info "Deploying to: $NETWORK"
print_info "RPC URL: $RPC_URL"

# Determine broadcast flag
BROADCAST_FLAG="--broadcast"
if [[ "${DRY_RUN:-false}" == "true" ]]; then
  print_info "DRY RUN mode - no transactions will be sent"
  BROADCAST_FLAG=""
fi

# Run deployment
print_info "Starting deployment..."
echo ""

forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" \
  $BROADCAST_FLAG \
  --slow \
  --legacy

echo ""
print_success "Deployment complete!"
print_info "Check the output above for deployed contract addresses"
