#!/bin/bash
# Sync Storage rules from template to all client projects.
# Source of truth: loyalty-composer/shared/templates/storage-client.rules
#
# Usage:
#   ./sync-storage-rules.sh           # Sync only
#   ./sync-storage-rules.sh --deploy  # Sync + deploy to Firebase

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/../templates/storage-client.rules"
CLIENTS_DIR="$SCRIPT_DIR/../../../loyalty-app/clients"
WHITE_LABEL="$SCRIPT_DIR/../../../loyalty-app/white_label_app/storage.rules"
HEADER="// AUTO-GENERATED — Do not edit directly.
// Source of truth: loyalty-composer/shared/templates/storage-client.rules"
DEPLOY=false

if [[ "${1:-}" == "--deploy" ]]; then
  DEPLOY=true
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: Template not found: $TEMPLATE"
  exit 1
fi

echo "=== Storage Rules Sync ==="
echo "Template: $TEMPLATE"
echo ""

sync_file() {
  local target="$1"
  local label="$2"
  printf "%s\n%s\n" "$HEADER" "$(cat "$TEMPLATE")" > "$target"
  echo "  [OK] $label"
}

# Sync white_label_app
sync_file "$WHITE_LABEL" "white_label_app/storage.rules"

# Sync each client
for client_dir in "$CLIENTS_DIR"/*/; do
  client_name=$(basename "$client_dir")
  target="$client_dir/storage.rules"
  if [[ -f "$target" ]]; then
    sync_file "$target" "clients/$client_name/storage.rules"
  fi
done

echo ""
echo "All files synced from template."

# Deploy if requested
if [[ "$DEPLOY" == true ]]; then
  echo ""
  echo "=== Deploying Storage Rules ==="
  for client_dir in "$CLIENTS_DIR"/*/; do
    client_name=$(basename "$client_dir")
    firebase_json="$client_dir/firebase.json"
    if [[ -f "$firebase_json" ]] && [[ -f "$client_dir/storage.rules" ]]; then
      project_id=$(grep -o '"projectId": "[^"]*"' "$firebase_json" | head -1 | cut -d'"' -f4)
      if [[ -n "$project_id" ]]; then
        echo ""
        echo "  Deploying $client_name ($project_id)..."
        (cd "$client_dir" && firebase deploy --only storage --project "$project_id" 2>&1) || {
          echo "  [FAIL] $client_name deploy failed!"
          continue
        }
        echo "  [OK] $client_name deployed"
      fi
    fi
  done
  echo ""
  echo "Deploy complete."
fi
