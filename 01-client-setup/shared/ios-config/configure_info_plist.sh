#!/bin/bash

# Check for required parameters
if [ $# -ne 1 ]; then
    echo "Usage: $0 <ios-runner-directory>"
    echo "Example: $0 /path/to/project/ios/Runner"
    exit 1
fi

RUNNER_DIR="$1"
INFO_PLIST="${RUNNER_DIR}/Info.plist"
GOOGLE_SERVICE_PLIST="${RUNNER_DIR}/GoogleService-Info.plist"
BACKUP_FILE="${INFO_PLIST}.backup"

# Validate files exist
if [ ! -f "$INFO_PLIST" ]; then
    echo "Error: Info.plist not found at $INFO_PLIST" >&2
    exit 1
fi

# Create backup before any modifications
echo "Creating backup of Info.plist..."
cp "$INFO_PLIST" "$BACKUP_FILE"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Failed to create backup" >&2
    exit 1
fi
echo "Backup created at: $BACKUP_FILE"

if [ ! -f "$GOOGLE_SERVICE_PLIST" ]; then
    echo "Error: GoogleService-Info.plist not found at $GOOGLE_SERVICE_PLIST" >&2
    exit 1
fi

# Extract values from GoogleService-Info.plist
REVERSED_CLIENT_ID=$(awk -F'[<>]' '
    /<key>REVERSED_CLIENT_ID<\/key>/ {
        getline
        if(/<string>/){
            gsub(/.*<string>|<\/string>.*/, "")
            print
            exit
        }
    }
' "$GOOGLE_SERVICE_PLIST")

CLIENT_ID=$(awk -F'[<>]' '
    /<key>CLIENT_ID<\/key>/ {
        getline
        if(/<string>/){
            gsub(/.*<string>|<\/string>.*/, "")
            print
            exit
        }
    }
' "$GOOGLE_SERVICE_PLIST")

# Validate extracted values
if [ -z "$REVERSED_CLIENT_ID" ]; then
    echo "Error: REVERSED_CLIENT_ID not found in GoogleService-Info.plist" >&2
    exit 1
fi

if [ -z "$CLIENT_ID" ]; then
    echo "Error: CLIENT_ID not found in GoogleService-Info.plist" >&2
    exit 1
fi

# Create backup of Info.plist before modification
BACKUP_FILE="${INFO_PLIST}.backup"
echo "Creating backup: $BACKUP_FILE"
cp "$INFO_PLIST" "$BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Failed to create backup file" >&2
    exit 1
fi
# Insert new entries into Info.plist
awk -v reversed="$REVERSED_CLIENT_ID" -v client_id="$CLIENT_ID" '
BEGIN {
    added_url_types = 0
    added_gid_client = 0
    indent = "  "
}

# Insert after opening <dict> tag
/<dict>/ && !dict_opened {
    print
    print indent "<key>CFBundleURLTypes</key>"
    print indent "<array>"
    print indent "  <dict>"
    print indent "    <key>CFBundleTypeRole</key>"
    print indent "    <string>Editor</string>"
    print indent "    <key>CFBundleURLSchemes</key>"
    print indent "    <array>"
    print indent "      <string>" reversed "</string>"
    print indent "    </array>"
    print indent "  </dict>"
    print indent "</array>"
    print indent "<key>GIDClientID</key>"
    print indent "<string>" client_id "</string>"
    dict_opened = 1
    next
}

{ print }
' "$INFO_PLIST" > "${INFO_PLIST}.tmp" && mv "${INFO_PLIST}.tmp" "$INFO_PLIST"

# Verify changes
if grep -q "<string>$REVERSED_CLIENT_ID</string>" "$INFO_PLIST" && \
   grep -q "<string>$CLIENT_ID</string>" "$INFO_PLIST"; then
    echo "Successfully updated Info.plist"
    echo "Added CFBundleURLTypes with REVERSED_CLIENT_ID: $REVERSED_CLIENT_ID"
    echo "Added GIDClientID: $CLIENT_ID"

    # Remove backup after successful update
    rm -f "$BACKUP_FILE"
    echo "Backup removed (update successful)"
else
    echo "Error: Failed to update Info.plist. Restoring backup..." >&2
    mv "$BACKUP_FILE" "$INFO_PLIST"
    exit 1
fi