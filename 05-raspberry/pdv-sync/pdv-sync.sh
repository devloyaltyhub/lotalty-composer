#!/usr/bin/env bash
# PDV Sync - Sincronizacao automatica de vendas
# Chamado por cron a cada 1 minuto
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Configuracao ---
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "[ERRO] Arquivo .env nao encontrado em $SCRIPT_DIR"
  echo "Execute install.sh primeiro ou copie .env.example para .env"
  exit 1
fi
# shellcheck source=/dev/null
source "$SCRIPT_DIR/.env"

if [ -z "${API_URL:-}" ] || [ -z "${API_KEY:-}" ]; then
  echo "[ERRO] API_URL e API_KEY sao obrigatorios no .env"
  exit 1
fi

HEALTH_CHECK_ENABLED="${HEALTH_CHECK_ENABLED:-true}"
ALERT_AFTER_FAILURES="${ALERT_AFTER_FAILURES:-5}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-7}"
MAX_LOG_SIZE_KB="${MAX_LOG_SIZE_KB:-5120}"

# --- Log setup ---
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pdv-sync.log"
FAIL_COUNTER_FILE="$LOG_DIR/.fail_count"
LOCK_FILE="$LOG_DIR/.pdv-sync.lock"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

# --- Lock (evitar execucao concorrente) ---
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || stat -f %m "$LOCK_FILE" 2>/dev/null) ))
  if [ "$LOCK_AGE" -lt 300 ]; then
    exit 0
  fi
  rm -f "$LOCK_FILE"
  log "[WARN] Lock stale removido (${LOCK_AGE}s)"
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

# --- Rotacao de logs ---
if [ -f "$LOG_FILE" ]; then
  LOG_SIZE_KB=$(du -k "$LOG_FILE" | cut -f1)
  if [ "$LOG_SIZE_KB" -gt "$MAX_LOG_SIZE_KB" ]; then
    tail -1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
    log "[INFO] Log rotacionado (era ${LOG_SIZE_KB}KB)"
  fi
fi
find "$LOG_DIR" -name "*.log.*" -mtime +"$LOG_RETENTION_DAYS" -delete 2>/dev/null || true

# --- Health check (opcional) ---
if [ "$HEALTH_CHECK_ENABLED" = "true" ]; then
  HEALTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    --connect-timeout 5 "${API_URL}/api/health" 2>/dev/null || echo "000")
  if [ "$HEALTH_HTTP" != "200" ]; then
    log "[WARN] Health check falhou (HTTP $HEALTH_HTTP)"
  fi
fi

# --- Sync ---
RESPONSE=$(curl -s -w "\n%{http_code}|%{time_total}" --max-time 120 \
  --connect-timeout 10 \
  -X POST "${API_URL}/api/pdv/sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{}' 2>/dev/null || echo -e "\n000|0")

BODY=$(echo "$RESPONSE" | sed '$d')
META=$(echo "$RESPONSE" | tail -1)
HTTP_CODE=$(echo "$META" | cut -d'|' -f1)
TIME_SEC=$(echo "$META" | cut -d'|' -f2)
TIME_MS=$(echo "$TIME_SEC" | awk '{printf "%.0f", $1 * 1000}')

# --- Leitura do contador de falhas ---
FAIL_COUNT=0
if [ -f "$FAIL_COUNTER_FILE" ]; then
  FAIL_COUNT=$(cat "$FAIL_COUNTER_FILE" 2>/dev/null || echo "0")
fi

# --- Resultado ---
SUCCESS=$(echo "$BODY" | grep -o '"success":[a-z]*' | head -1 | grep -c 'true' || true)
MESSAGE=$(echo "$BODY" | grep -o '"message":"[^"]*"' | head -1 | sed 's/"message":"//;s/"$//' || echo "")

if [ "$HTTP_CODE" = "200" ] && [ "$SUCCESS" = "1" ]; then
  log "[OK] ${MESSAGE:-Sync concluido} (HTTP $HTTP_CODE, ${TIME_MS}ms)"
  echo "0" > "$FAIL_COUNTER_FILE"
elif [ "$HTTP_CODE" = "200" ]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "$FAIL_COUNT" > "$FAIL_COUNTER_FILE"
  log "[WARN] ${MESSAGE:-Sync parcial} (HTTP $HTTP_CODE, ${TIME_MS}ms, falhas: $FAIL_COUNT)"
elif [ "$HTTP_CODE" = "429" ]; then
  log "[WARN] Rate limit excedido (HTTP 429)"
elif [ "$HTTP_CODE" = "401" ]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "$FAIL_COUNT" > "$FAIL_COUNTER_FILE"
  log "[ERRO] Autenticacao falhou - verificar API_KEY (HTTP 401)"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "$FAIL_COUNT" > "$FAIL_COUNTER_FILE"
  if [ "$HTTP_CODE" = "000" ]; then
    log "[ERRO] Sem conexao com a API (timeout/rede, falhas: $FAIL_COUNT)"
  else
    log "[ERRO] HTTP $HTTP_CODE - ${MESSAGE:-erro desconhecido} (falhas: $FAIL_COUNT)"
  fi
fi

# --- Alerta Telegram ---
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  if [ "$FAIL_COUNT" -ge "$ALERT_AFTER_FAILURES" ] && [ $((FAIL_COUNT % ALERT_AFTER_FAILURES)) -eq 0 ]; then
    ALERT_MSG="⚠️ *PDV Sync* - ${FAIL_COUNT} falhas consecutivas
HTTP: ${HTTP_CODE}
Msg: ${MESSAGE:-N/A}
Host: $(hostname)"
    curl -s --max-time 10 \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "parse_mode=Markdown" \
      -d "text=${ALERT_MSG}" > /dev/null 2>&1 || true
  fi
fi
