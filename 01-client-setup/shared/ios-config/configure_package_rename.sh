#!/bin/bash

# Check parameters
if [ $# -ne 4 ]; then
    echo "Usage: $0 <yaml-file> <app_name> <app_package> <ios_bundle>"
    echo "Example: $0 config.yaml \"New App\" com.example.newapp newexample"
    exit 1
fi

YAML_FILE="$1"
APP_NAME="$2"
APP_PACKAGE="$3"
IOS_BUNDLE="$4"

# Validate file exists
if [ ! -f "$YAML_FILE" ]; then
    echo "Error: File $YAML_FILE does not exist" >&2
    exit 1
fi

# Escape special characters for sed
escape_sed() {
    echo "$1" | sed -e 's/[\/&]/\\&/g'
}

ANDROID_APP_NAME_ESC=$(escape_sed "$APP_NAME")
ANDROID_PACKAGE_ESC=$(escape_sed "$APP_PACKAGE")
IOS_APP_NAME_ESC=$(escape_sed "$APP_NAME")
IOS_BUNDLE_ESC=$(escape_sed "$IOS_BUNDLE")
IOS_PACKAGE_ESC=$(escape_sed "$APP_PACKAGE")

# Perform replacements
sed -i '' -E "
    # Android app_name
    s/^( *android: *$)/\1/
    t android_section
    b
    :android_section
    n
    s/^( *app_name:).*/\1 $ANDROID_APP_NAME_ESC/
    
    # Android package_name
    n
    s/^( *package_name:).*/\1 $ANDROID_PACKAGE_ESC/
    
    # iOS section
    :find_ios
    n
    s/^( *ios: *$)/\1/
    t ios_section
    b find_ios
    
    :ios_section
    # iOS app_name
    n
    s/^( *app_name:).*/\1 $IOS_APP_NAME_ESC/
    
    # iOS bundle_name
    n
    s/^( *bundle_name:).*/\1 $IOS_BUNDLE_ESC/
    
    # iOS package_name
    n
    s/^( *package_name:).*/\1 $IOS_PACKAGE_ESC/
" "$YAML_FILE"

# Verify changes
echo ""
echo "Updated configuration:"
echo "Android:"
echo "  app_name: $(grep -A1 'android:' "$YAML_FILE" | grep 'app_name:' | cut -d: -f2- | xargs)"
echo "  package_name: $(grep -A1 'android:' "$YAML_FILE" | grep 'package_name:' | cut -d: -f2- | xargs)"
echo "iOS:"
echo "  app_name: $(grep -A1 'ios:' "$YAML_FILE" | grep 'app_name:' | cut -d: -f2- | xargs)"
echo "  bundle_name: $(grep -A1 'ios:' "$YAML_FILE" | grep 'bundle_name:' | cut -d: -f2- | xargs)"
echo "  package_name: $(grep -A1 'ios:' "$YAML_FILE" | grep 'package_name:' | cut -d: -f2- | xargs)"