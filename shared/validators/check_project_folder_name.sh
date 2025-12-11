#!/bin/bash

# Check if folder name is valid according to Flutter project conventions
# Rules: 
#   - Must be a valid Dart identifier (no spaces, special characters, etc.)
#   - Should be all lowercase
#   - Uses underscores for separation (no hyphens)
#   - Must start with a letter
#   - Must not contain reserved words

if [ $# -ne 1 ]; then
    echo "Usage: $0 <folder-name>"
    exit 1
fi

FOLDER_NAME="$1"

# List of Dart reserved words
RESERVED_WORDS=(
    abstract as assert async await break case catch class const continue covariant default deferred do 
    dynamic else enum export extends extension external factory false final finally for Function get 
    hide if implements import in inferface is library mixin new null on operator part required rethrow 
    return set show static super switch sync this throw true try typedef var void while with yield
)

# Rule 1: Must start with a letter
if [[ ! "$FOLDER_NAME" =~ ^[a-z] ]]; then
    echo "❌ Must start with a lowercase letter"
    exit 1
fi

# Rule 2: Must contain only lowercase letters, numbers, and underscores
if [[ ! "$FOLDER_NAME" =~ ^[a-z0-9_]+$ ]]; then
    echo "❌ Must contain only lowercase letters, numbers, and underscores"
    exit 1
fi

# Rule 3: Must not contain consecutive underscores
if [[ "$FOLDER_NAME" == *"__"* ]]; then
    echo "❌ Must not contain consecutive underscores"
    exit 1
fi

# Rule 4: Must not end with an underscore
if [[ "$FOLDER_NAME" == *"_" ]]; then
    echo "❌ Must not end with an underscore"
    exit 1
fi

# Rule 5: Must not be a reserved Dart keyword
for word in "${RESERVED_WORDS[@]}"; do
    if [ "$FOLDER_NAME" == "$word" ]; then
        echo "❌ Cannot be a Dart reserved word: $word"
        exit 1
    fi
done

# Rule 6: Must not contain numbers only
if [[ "$FOLDER_NAME" =~ ^[0-9_]+$ ]]; then
    echo "❌ Must contain letters, not just numbers and underscores"
    exit 1
fi

# Rule 7: Must be between 1-64 characters
LEN=${#FOLDER_NAME}
if [ "$LEN" -lt 1 ] || [ "$LEN" -gt 64 ]; then
    echo "❌ Length must be between 1-64 characters (current: $LEN)"
    exit 1
fi

# All checks passed
echo "✅ Valid Flutter project folder name: $FOLDER_NAME"
exit 0