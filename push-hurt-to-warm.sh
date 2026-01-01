#!/bin/bash
# Script to push Newbe.HurtToWarm mod using local ducky CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD_DIR="${SCRIPT_DIR}/mods/Newbe.HurtToWarm"

# Parse arguments
USE_NPM_DEV=false
for arg in "$@"; do
    if [ "$arg" == "--prod" ]; then
        USE_NPM_DEV=true
        # Remove --prod from arguments so it's not passed to the CLI
        set -- "${@/$arg}"
    fi
done

# Load .env file if it exists
if [ -f "${SCRIPT_DIR}/.env" ]; then
    echo "Loading .env file..."
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
fi

# Check if we should use npm dev version or build locally
if [ "$USE_NPM_DEV" = true ]; then
    echo "Using latest @ducky7go/ducky-cli@dev from npm..."
    echo "Installing globally..."
    npm install -g @ducky7go/ducky-cli@dev

    echo ""
    echo "Using ducky CLI from npm (dev version):"
    ducky --version || echo "Version check not available"

    echo ""
    echo "Pushing mod..."
    ducky nuget push "${MOD_DIR}" --pack "$@"
else
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
fi

echo "Done!"

