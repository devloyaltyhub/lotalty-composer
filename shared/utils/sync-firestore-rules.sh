#!/bin/bash
# Sync Firestore rules and indexes from templates to all client projects.
# Source of truth:
#   Rules:   loyalty-composer/shared/templates/firestore-client.rules
#   Indexes: loyalty-composer/shared/templates/firestore.indexes.json
#
# Usage:
#   ./sync-firestore-rules.sh           # Sync only (rules + indexes)
#   ./sync-firestore-rules.sh --deploy  # Sync + deploy to Firebase

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_RULES="$SCRIPT_DIR/../templates/firestore-client.rules"
TEMPLATE_INDEXES="$SCRIPT_DIR/../templates/firestore.indexes.json"
CLIENTS_DIR="$SCRIPT_DIR/../../../loyalty-app/clients"
WHITE_LABEL="$SCRIPT_DIR/../../../loyalty-app/white_label_app/firestore.rules"
HEADER="// AUTO-GENERATED — Do not edit directly.
// Source of truth: loyalty-composer/shared/templates/firestore-client.rules"
DEPLOY=false

if [[ "${1:-}" == "--deploy" ]]; then
  DEPLOY=true
fi

if [[ ! -f "$TEMPLATE_RULES" ]]; then
  echo "ERROR: Rules template not found: $TEMPLATE_RULES"
  exit 1
fi

if [[ ! -f "$TEMPLATE_INDEXES" ]]; then
  echo "ERROR: Indexes template not found: $TEMPLATE_INDEXES"
  exit 1
fi

echo "=== Firestore Rules Sync ==="
echo "Rules template: $TEMPLATE_RULES"
echo "Indexes template: $TEMPLATE_INDEXES"
echo ""

sync_rules() {
  local target="$1"
  local label="$2"
  printf "%s\n%s\n" "$HEADER" "$(cat "$TEMPLATE_RULES")" > "$target"
  echo "  [OK] $label"
}

sync_indexes() {
  local target="$1"
  local label="$2"
  cp "$TEMPLATE_INDEXES" "$target"
  echo "  [OK] $label"
}

# Sync white_label_app (rules only — indexes are per-client)
sync_rules "$WHITE_LABEL" "white_label_app/firestore.rules"

# Sync each client (rules + indexes)
for client_dir in "$CLIENTS_DIR"/*/; do
  client_name=$(basename "$client_dir")
  rules_target="$client_dir/firestore.rules"
  indexes_target="$client_dir/firestore.indexes.json"
  if [[ -f "$rules_target" ]]; then
    sync_rules "$rules_target" "clients/$client_name/firestore.rules"
  fi
  if [[ -f "$indexes_target" ]]; then
    sync_indexes "$indexes_target" "clients/$client_name/firestore.indexes.json"
  fi
done

echo ""
echo "All files synced from templates."

# Deploy if requested
if [[ "$DEPLOY" == true ]]; then
  echo ""
  echo "=== Deploying Firestore Rules + Indexes ==="
  for client_dir in "$CLIENTS_DIR"/*/; do
    client_name=$(basename "$client_dir")
    firebase_json="$client_dir/firebase.json"
    if [[ -f "$firebase_json" ]] && [[ -f "$client_dir/firestore.rules" ]]; then
      # Extract projectId from firebase.json
      project_id=$(grep -o '"projectId": "[^"]*"' "$firebase_json" | head -1 | cut -d'"' -f4)
      if [[ -n "$project_id" ]]; then
        echo ""
        echo "  Deploying $client_name ($project_id)..."
        (cd "$client_dir" && firebase deploy --only firestore:rules,firestore:indexes --project "$project_id" 2>&1) || {
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
