#!/bin/bash
# Wrapper script to run shorebird with correct Ruby/CocoaPods environment

# Set UTF-8 encoding
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Use Homebrew Ruby - /usr/local/bin MUST come first to use our pod wrapper
export PATH="/usr/local/bin:/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/3.4.0/bin:$PATH"

# Debug: Log environment (remove this after fixing)
echo "[shorebird-wrapper] PATH first 3: $(echo $PATH | tr ':' '\n' | head -3 | tr '\n' ':')" >&2
echo "[shorebird-wrapper] which pod: $(which pod 2>&1)" >&2
echo "[shorebird-wrapper] pod version: $(pod --version 2>&1)" >&2
echo "[shorebird-wrapper] which ruby: $(which ruby 2>&1)" >&2

# Run shorebird with all arguments passed to this script
exec shorebird "$@"
