#!/bin/bash
# Script to push Newbe.HurtToWarm mod using local ducky CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD_DIR="${SCRIPT_DIR}/mods/Newbe.HurtToWarm"

# Load .env file if it exists
if [ -f "${SCRIPT_DIR}/.env" ]; then
    echo "Loading .env file..."
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
fi

# Build ducky CLI
echo "Building ducky CLI..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error: Build failed"
    exit 1
fi
echo "Build successful"
echo ""

# Verify build output exists
if [ ! -f "${SCRIPT_DIR}/dist/cli.js" ]; then
    echo "Error: ducky CLI not built. Run 'npm run build' first."
    exit 1
fi

# Use local ducky to push with pack
node "${SCRIPT_DIR}/dist/cli.js" nuget push "${MOD_DIR}" --pack "$@"

echo "Done!"
