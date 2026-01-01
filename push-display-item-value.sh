#!/bin/bash
# Script to push DisplayItemValue mod using local ducky CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD_DIR="${SCRIPT_DIR}/mods/DisplayItemValue"

# Load .env file if it exists
if [ -f "${SCRIPT_DIR}/.env" ]; then
    echo "Loading .env file..."
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
fi

echo "Pushing DisplayItemValue mod..."
echo "Mod directory: ${MOD_DIR}"

# Check if mod directory exists
if [ ! -d "${MOD_DIR}" ]; then
    echo "Error: Mod directory not found: ${MOD_DIR}"
    exit 1
fi

# Check if ducky CLI is built
if [ ! -f "${SCRIPT_DIR}/dist/cli.js" ]; then
    echo "Error: ducky CLI not built. Run 'npm run build' first."
    exit 1
fi

# Use local ducky to push with pack
node "${SCRIPT_DIR}/dist/cli.js" nuget push "${MOD_DIR}" --pack "$@"

echo "Done!"
