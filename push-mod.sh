#!/bin/bash
# Unified script to push mods using local ducky CLI
# Usage: ./push-mod.sh <mod-name> <command> [options]
#   mod-name: Name of the mod directory (e.g., DisplayItemValue, Newbe.HurtToWarm)
#   command: nuget or steam
#   options: Additional options to pass to the CLI
#   --prod: Use npm version instead of local build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <mod-name> <command> [options]"
    echo ""
    echo "Arguments:"
    echo "  mod-name    Name of the mod directory (e.g., DisplayItemValue, Newbe.HurtToWarm)"
    echo "  command     Command to run: nuget or steam"
    echo "  options     Additional options to pass to the CLI"
    echo ""
    echo "Options:"
    echo "  --prod      Use @ducky7go/ducky-cli@dev from npm instead of local build"
    echo ""
    echo "Examples:"
    echo "  $0 DisplayItemValue nuget"
    echo "  $0 Newbe.HurtToWarm steam"
    echo "  $0 Newbe.HurtToWarm steam --prod"
    exit 1
fi

MOD_NAME="$1"
COMMAND="$2"
shift 2

MOD_DIR="${SCRIPT_DIR}/mods/${MOD_NAME}"

# Parse --prod flag
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

echo "Pushing ${MOD_NAME} mod..."
echo "Mod directory: ${MOD_DIR}"
echo "Command: ${COMMAND}"
echo ""

# Check if mod directory exists
if [ ! -d "${MOD_DIR}" ]; then
    echo "Error: Mod directory not found: ${MOD_DIR}"
    exit 1
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
    if [ "$COMMAND" == "nuget" ]; then
        ducky nuget push "${MOD_DIR}" --pack "$@"
    elif [ "$COMMAND" == "steam" ]; then
        ducky steam push "${MOD_DIR}" "$@"
    else
        echo "Error: Unknown command '${COMMAND}'. Use 'nuget' or 'steam'."
        exit 1
    fi
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

    # Use local ducky to push
    if [ "$COMMAND" == "nuget" ]; then
        node "${SCRIPT_DIR}/dist/cli.js" nuget push "${MOD_DIR}" --pack "$@"
    elif [ "$COMMAND" == "steam" ]; then
        node "${SCRIPT_DIR}/dist/cli.js" steam push "${MOD_DIR}" "$@"
    else
        echo "Error: Unknown command '${COMMAND}'. Use 'nuget' or 'steam'."
        exit 1
    fi
fi

echo ""
echo "Done!"
