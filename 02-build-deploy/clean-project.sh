#!/bin/bash

# Usage: ./clean_project.sh [PROJECT_DIRECTORY]
# If no directory is specified, uses current directory

# Parse command-line argument
TARGET_DIR="${1:-.}"

# Validate target directory
if [[ ! -d "$TARGET_DIR" ]]; then
    echo "Error: Directory '$TARGET_DIR' does not exist" >&2
    exit 1
fi

# Convert to absolute path
TARGET_DIR=$(realpath "$TARGET_DIR")

# Files to preserve (relative to project root)
declare -a KEEP_FILES=(
    "android/app/google-services.json"
    "android/app/build.gradle"
    "ios/Runner/GoogleService-Info.plist"
    "ios/Runner/Info.plist"
    "lib/firebase_options.dart"
    "firebase.json"
    ".firebaserc"
    "firestore.indexes.json"
    "firestore.rules"
)

# Confirm with the user before proceeding
echo "WARNING: This will delete all files/directories in:"
echo "  $TARGET_DIR"
echo "Except these critical files:"
for file in "${KEEP_FILES[@]}"; do
    echo "  - $file"
done

# Create temporary directory
TMP_DIR=$(mktemp -d)

# Copy preserved files to temp location
cd "$TARGET_DIR" || exit 1
for file in "${KEEP_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        mkdir -p "$TMP_DIR/$(dirname "$file")"
        cp "$file" "$TMP_DIR/$file"
        echo "✓ Preserved: $file"
    else
        echo "⚠️ Warning: $file not found - skipping"
    fi
done

# Remove all project content
echo "Cleaning project directory..."
find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +

# Restore preserved files
if [[ -d "$TMP_DIR" ]]; then
    cp -r "$TMP_DIR"/. .
    rm -rf "$TMP_DIR"
fi

# Final status report
echo ""
echo "Project cleaned successfully in: $TARGET_DIR"
echo "Remaining files:"
for file in "${KEEP_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (not present)"
    fi
done