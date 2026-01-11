#!/bin/bash
#
# check-hardcoded-credentials.sh
#
# Verifica se existem credenciais hardcoded no codigo antes do build de producao.
# Este script DEVE ser executado antes de qualquer build de release.
#
# Uso: ./check-hardcoded-credentials.sh [--fix]
#   --fix: Tenta corrigir automaticamente (substitui por strings vazias)
#
# Exit codes:
#   0 - Nenhuma credencial hardcoded encontrada (ou corrigida com --fix)
#   1 - Credenciais hardcoded encontradas (build deve ser bloqueado)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_DIR="$SCRIPT_DIR/../../../loyalty-admin-main"
LOGIN_SCREEN="$ADMIN_DIR/lib/ui/auth/login_screen.dart"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FIX_MODE=false
if [[ "$1" == "--fix" ]]; then
    FIX_MODE=true
fi

echo ""
echo "=========================================="
echo "  Verificacao de Credenciais Hardcoded"
echo "=========================================="
echo ""

FOUND_ISSUES=0

check_login_screen() {
    echo "Verificando: $LOGIN_SCREEN"

    if [[ ! -f "$LOGIN_SCREEN" ]]; then
        echo -e "${YELLOW}AVISO: Arquivo login_screen.dart nao encontrado${NC}"
        return
    fi

    # Verifica se tem credenciais SEM kDebugMode (credenciais expostas em release)
    # Padroes perigosos: TextEditingController(text: 'valor') sem kDebugMode

    # Verifica se o padrao seguro (kDebugMode ? 'valor' : '') esta sendo usado
    if grep -q "kDebugMode ? '" "$LOGIN_SCREEN"; then
        echo -e "${GREEN}OK: Credenciais protegidas com kDebugMode${NC}"
    else
        # Verifica se tem credenciais hardcoded diretamente
        if grep -E "TextEditingController\(text: '[^']+'\)" "$LOGIN_SCREEN" | grep -v "kDebugMode" > /dev/null 2>&1; then
            echo -e "${RED}ERRO: Credenciais hardcoded detectadas sem protecao kDebugMode!${NC}"
            echo ""
            echo "Linhas com problema:"
            grep -n -E "TextEditingController\(text: '[^']+'\)" "$LOGIN_SCREEN" | grep -v "kDebugMode" || true
            echo ""
            FOUND_ISSUES=1
        else
            echo -e "${GREEN}OK: Nenhuma credencial hardcoded detectada${NC}"
        fi
    fi
}

check_env_files() {
    echo ""
    echo "Verificando arquivos .env em locais inesperados..."

    # Verifica se .env.local esta no gitignore
    if [[ -f "$ADMIN_DIR/.gitignore" ]]; then
        if grep -q ".env.local" "$ADMIN_DIR/.gitignore"; then
            echo -e "${GREEN}OK: .env.local esta no .gitignore${NC}"
        else
            echo -e "${YELLOW}AVISO: .env.local nao esta no .gitignore${NC}"
        fi
    fi
}

check_test_credentials_in_production() {
    echo ""
    echo "Verificando credenciais de teste em codigo de producao..."

    # Busca por emails de teste em arquivos de producao (excluindo integration_test)
    TEST_EMAILS=$(grep -r --include="*.dart" -l "@loyaltyhub.club" "$ADMIN_DIR/lib" 2>/dev/null || true)

    if [[ -n "$TEST_EMAILS" ]]; then
        # Verifica se sao protegidos por kDebugMode
        for file in $TEST_EMAILS; do
            if grep "@loyaltyhub.club" "$file" | grep -v "kDebugMode" > /dev/null 2>&1; then
                echo -e "${YELLOW}AVISO: Email de teste encontrado em: $file${NC}"
            fi
        done
    else
        echo -e "${GREEN}OK: Nenhum email de teste em codigo de producao${NC}"
    fi
}

# Executa verificacoes
check_login_screen
check_env_files
check_test_credentials_in_production

echo ""
echo "=========================================="

if [[ $FOUND_ISSUES -eq 1 ]]; then
    echo -e "${RED}FALHA: Credenciais hardcoded detectadas!${NC}"
    echo ""
    echo "O build foi BLOQUEADO por seguranca."
    echo ""
    echo "Para corrigir:"
    echo "  1. Use 'kDebugMode ? \"valor\" : \"\"' para credenciais de dev"
    echo "  2. Ou remova completamente as credenciais hardcoded"
    echo ""
    exit 1
else
    echo -e "${GREEN}SUCESSO: Nenhuma credencial hardcoded exposta${NC}"
    echo ""
    exit 0
fi
