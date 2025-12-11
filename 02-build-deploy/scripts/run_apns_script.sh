#!/bin/bash
# Wrapper script to run create_apns_key.rb with correct Ruby environment
# This uses the same environment as fastlane

set -e

# Check if email is provided
if [ -z "$APPLE_DEVELOPER_EMAIL" ]; then
    echo "❌ Error: APPLE_DEVELOPER_EMAIL environment variable is required"
    echo ""
    echo "Usage: APPLE_DEVELOPER_EMAIL=your@email.com $0"
    exit 1
fi

# Set up environment like fastlane does
export PATH="/usr/local/opt/ruby/bin:/usr/local/Cellar/fastlane/2.229.0/libexec/bin:${HOME}/.local/share/fastlane/3.4.0/bin:$PATH"
export GEM_HOME="${FASTLANE_GEM_HOME:-${HOME}/.local/share/fastlane/3.4.0}"
export GEM_PATH="${FASTLANE_GEM_HOME:-${HOME}/.local/share/fastlane/3.4.0}:/usr/local/Cellar/fastlane/2.229.0/libexec"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the Ruby script
exec /usr/local/opt/ruby/bin/ruby "$SCRIPT_DIR/create_apns_key.rb"
