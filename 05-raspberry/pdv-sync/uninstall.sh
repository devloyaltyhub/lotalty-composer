#!/usr/bin/env bash
# PDV Sync - Desinstalacao
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo " PDV Sync - Desinstalacao"
echo "========================================"
echo ""

# --- Remover do crontab ---
EXISTING=$(crontab -l 2>/dev/null | grep -c "pdv-sync-loyaltyhub" || true)
if [ "$EXISTING" -gt 0 ]; then
  crontab -l 2>/dev/null | grep -v "pdv-sync-loyaltyhub" | crontab -
  echo "[OK] Entrada removida do crontab"
else
  echo "[OK] Nenhuma entrada no crontab"
fi

# --- Remover logs ---
if [ -d "$SCRIPT_DIR/logs" ]; then
  read -rp "Remover logs? (s/N): " REMOVE_LOGS
  if [ "${REMOVE_LOGS,,}" = "s" ]; then
    rm -rf "$SCRIPT_DIR/logs"
    echo "[OK] Logs removidos"
  else
    echo "[OK] Logs mantidos em $SCRIPT_DIR/logs/"
  fi
fi

echo ""
echo "[OK] Desinstalacao concluida"
echo "     O arquivo .env foi mantido."
echo ""
