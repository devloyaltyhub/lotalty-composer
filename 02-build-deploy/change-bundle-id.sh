#!/bin/bash

# Check if both parameters are provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <build.gradle-file-path> <new-application-id>"
    echo "Example: $0 android/app/build.gradle club.loyaltyhub.newid"
    exit 1
fi

GRADLE_FILE="$1"
NEW_APP_ID="$2"

# Validate file exists
if [ ! -f "$GRADLE_FILE" ]; then
    echo "Error: File $GRADLE_FILE does not exist"
    exit 1
fi

# Validate application ID format
if [[ ! "$NEW_APP_ID" =~ ^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$ ]]; then
    echo "Error: Invalid application ID format. Must be in reverse domain format (e.g., 'club.loyaltyhub.newid')"
    exit 1
fi

# Perform replacements
sed -i '' -e "s/\(namespace = \)\"[^\"]*\"/\1\"$NEW_APP_ID\"/" \
          -e "s/\(applicationId = \)\"[^\"]*\"/\1\"$NEW_APP_ID\"/" "$GRADLE_FILE"

# Verify changes
if grep -q "namespace = \"$NEW_APP_ID\"" "$GRADLE_FILE" && \
   grep -q "applicationId = \"$NEW_APP_ID\"" "$GRADLE_FILE"; then
    echo "Successfully updated:"
    echo "  namespace = \"$NEW_APP_ID\""
    echo "  applicationId = \"$NEW_APP_ID\""
else
    echo "Error: Failed to update application ID. Restoring backup..."
    mv "$BACKUP_FILE" "$GRADLE_FILE"
    exit 1
fi