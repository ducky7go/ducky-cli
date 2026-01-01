#!/bin/bash
# Script to pack and extract all mods for testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODS_DIR="${SCRIPT_DIR}/mods"
OUTPUT_DIR="${SCRIPT_DIR}/mods_unzip"

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

echo "=== Pack and Test All Mods ==="
echo ""

# Clean previous output
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

# Counters
SUCCESS_COUNT=0
SKIP_COUNT=0
TOTAL_COUNT=0

# Find all mod directories (directories containing info.ini)
for MOD_PATH in "${MODS_DIR}"/*/; do
    if [ ! -d "${MOD_PATH}" ]; then
        continue
    fi

    # Check if info.ini exists
    if [ ! -f "${MOD_PATH}/info.ini" ]; then
        continue
    fi

    MOD_NAME=$(basename "${MOD_PATH}")
    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    echo "========================================="
    echo "Processing: ${MOD_NAME}"
    echo "========================================="

    # Try to pack and extract, continue on error
    if (
        # Pack
        echo "1. Packing mod..."
        node "${SCRIPT_DIR}/dist/cli.js" nuget pack "${MOD_PATH}" >/dev/null 2>&1

        # Find the created .nupkg file (in pkg directory at project root)
        # Match the .nupkg file that starts with the mod name
        NUPKG_FILE=$(find "${SCRIPT_DIR}/pkg" -maxdepth 1 -name "${MOD_NAME}*.nupkg" -type f 2>/dev/null | head -1)

        if [ -z "${NUPKG_FILE}" ]; then
            echo "   Error: .nupkg file not found after packing"
            exit 1
        fi

        echo "   Created: ${NUPKG_FILE}"
        echo ""

        # Extract .nupkg (it's a ZIP file)
        MOD_OUTPUT_DIR="${OUTPUT_DIR}/${MOD_NAME}"
        mkdir -p "${MOD_OUTPUT_DIR}"
        echo "2. Extracting package to ${MOD_OUTPUT_DIR}..."
        unzip -q "${NUPKG_FILE}" -d "${MOD_OUTPUT_DIR}"

        echo ""
        echo "=== Package Structure ==="
        ls -la "${MOD_OUTPUT_DIR}"
        echo ""

        if [ -d "${MOD_OUTPUT_DIR}/content" ]; then
            echo "=== Content Files ==="
            ls -la "${MOD_OUTPUT_DIR}/content"
        else
            echo "Warning: content/ directory not found in package!"
        fi

        echo ""
        echo "Done! Package extracted to ${MOD_OUTPUT_DIR}"
    ); then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "   ✗ Failed to process ${MOD_NAME}"
        SKIP_COUNT=$((SKIP_COUNT + 1))
    fi
    echo ""
done

echo "========================================="
echo "Summary:"
echo "  Total mods: ${TOTAL_COUNT}"
echo "  Successful: ${SUCCESS_COUNT}"
echo "  Failed: ${SKIP_COUNT}"
echo ""
echo "Output directory: ${OUTPUT_DIR}"
