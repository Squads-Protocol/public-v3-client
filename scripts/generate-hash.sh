#!/bin/bash

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

# Define the directory to hash
DIST_DIR="dist"

# Check if the directory exists, if not, build it
if [ ! -d "$DIST_DIR" ]; then
    echo "⚠️  Directory '$DIST_DIR' not found. Running 'yarn build'..."
    yarn build
fi

# Compute hash based on contents of the dist folder
echo "🔍 Computing hash for '$DIST_DIR'..."
COMPUTED_HASH=$(cd "$DIST_DIR" && find . -type f -print0 | sort -z | xargs -0 cat | sha256sum | awk '{ print $1 }')

echo "✅ Computed Hash: $COMPUTED_HASH"