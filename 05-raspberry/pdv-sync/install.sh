#!/usr/bin/env bash
# PDV Sync - Instalacao no Raspberry Pi
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYNC_SCRIPT="$SCRIPT_DIR/pdv-sync.sh"
ENV_FILE="$SCRIPT_DIR/.env"
CRON_COMMENT="# pdv-sync-loyaltyhub"

echo "========================================"
echo " PDV Sync - Instalacao Raspberry Pi"
echo "========================================"
echo ""

# --- Pre-requisitos ---
for cmd in curl crontab; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "[ERRO] '$cmd' nao encontrado. Instale antes de continuar."
    exit 1
  fi
done
echo "[OK] Pre-requisitos verificados (curl, cron)"

# --- Configuracao ---
if [ ! -f "$ENV_FILE" ]; then
  cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
  echo ""
  echo "Arquivo .env criado a partir do template."
  echo "Preencha as configuracoes abaixo:"
  echo ""

  read -rp "URL da API [https://loyalty-cloud.vercel.app]: " INPUT_URL
  API_URL="${INPUT_URL:-https://loyalty-cloud.vercel.app}"
  sed -i.bak "s|^API_URL=.*|API_URL=${API_URL}|" "$ENV_FILE"

  read -rp "API Key (API_SECRET_KEY do cloud-service): " INPUT_KEY
  if [ -z "$INPUT_KEY" ]; then
    echo "[ERRO] API_KEY e obrigatoria."
    exit 1
  fi
  sed -i.bak "s|^API_KEY=.*|API_KEY=${INPUT_KEY}|" "$ENV_FILE"

  read -rp "Tenant ID (Firebase Project ID do cliente): " INPUT_TENANT
  if [ -z "$INPUT_TENANT" ]; then
    echo "[ERRO] TENANT_ID e obrigatorio."
    exit 1
  fi
  sed -i.bak "s|^TENANT_ID=.*|TENANT_ID=${INPUT_TENANT}|" "$ENV_FILE"

  read -rp "Telegram Bot Token (Enter para pular): " INPUT_TG_TOKEN
  if [ -n "$INPUT_TG_TOKEN" ]; then
    sed -i.bak "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=${INPUT_TG_TOKEN}|" "$ENV_FILE"
    read -rp "Telegram Chat ID: " INPUT_TG_CHAT
    sed -i.bak "s|^TELEGRAM_CHAT_ID=.*|TELEGRAM_CHAT_ID=${INPUT_TG_CHAT}|" "$ENV_FILE"
  fi

  rm -f "$ENV_FILE.bak"
  echo ""
  echo "[OK] Configuracao salva em .env"
else
  echo "[OK] Arquivo .env ja existe"
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

# --- Permissao ---
chmod +x "$SYNC_SCRIPT"

# --- Teste de conectividade ---
echo ""
echo "Testando conexao com a API..."
HEALTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  --connect-timeout 5 "${API_URL}/api/health" 2>/dev/null || echo "000")

if [ "$HEALTH_HTTP" = "200" ]; then
  echo "[OK] API acessivel (health check: HTTP $HEALTH_HTTP)"
else
  echo "[WARN] Health check retornou HTTP $HEALTH_HTTP"
  echo "       Verifique se a URL esta correta: $API_URL"
  read -rp "Continuar mesmo assim? (s/N): " CONTINUE
  if [ "${CONTINUE,,}" != "s" ]; then
    exit 1
  fi
fi

# --- Teste de sync ---
echo ""
echo "Testando sync..."
SYNC_RESPONSE=$(curl -s --max-time 30 --connect-timeout 10 \
  -X POST "${API_URL}/api/pdv/sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{\"tenantId\":\"${TENANT_ID}\"}" 2>/dev/null || echo '{"success":false,"message":"Sem resposta"}')

SYNC_SUCCESS=$(echo "$SYNC_RESPONSE" | grep -o '"success":[a-z]*' | head -1 || echo "")
SYNC_MSG=$(echo "$SYNC_RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | sed 's/"message":"//;s/"$//' || echo "Sem mensagem")

if echo "$SYNC_SUCCESS" | grep -q "true"; then
  echo "[OK] Sync funcionando: $SYNC_MSG"
else
  echo "[WARN] Sync retornou: $SYNC_MSG"
  echo "       Resposta: $SYNC_RESPONSE"
  read -rp "Continuar instalacao? (s/N): " CONTINUE
  if [ "${CONTINUE,,}" != "s" ]; then
    exit 1
  fi
fi

# --- Crontab ---
echo ""
CRON_ENTRY="* * * * * $SYNC_SCRIPT $CRON_COMMENT"

EXISTING=$(crontab -l 2>/dev/null | grep -c "pdv-sync-loyaltyhub" || true)
if [ "$EXISTING" -gt 0 ]; then
  echo "[OK] Entrada no crontab ja existe"
else
  (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
  echo "[OK] Crontab configurado (a cada 1 minuto)"
fi

# --- Resumo ---
echo ""
echo "========================================"
echo " Instalacao concluida!"
echo "========================================"
echo ""
echo " Script:   $SYNC_SCRIPT"
echo " Config:   $ENV_FILE"
echo " Logs:     $SCRIPT_DIR/logs/pdv-sync.log"
echo " Cron:     * * * * * (a cada 1 minuto)"
echo ""
echo " Comandos uteis:"
echo "   tail -f $SCRIPT_DIR/logs/pdv-sync.log   # Acompanhar logs"
echo "   crontab -l                                # Ver crontab"
echo "   bash $SCRIPT_DIR/uninstall.sh             # Desinstalar"
echo ""
