#!/bin/bash

# Script de Validação de Metadados
# Usage: ./validate-metadata.sh <caminho_para_metadata>

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

METADATA_DIR="${1:-.}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Validador de Metadados${NC}"
echo -e "${BLUE}================================${NC}\n"

# Função para contar caracteres
count_chars() {
    if [ -f "$1" ]; then
        wc -c < "$1" | tr -d ' '
    else
        echo "0"
    fi
}

# Função para validar arquivo
validate_file() {
    local file=$1
    local limit=$2
    local name=$3

    if [ ! -f "$file" ]; then
        echo -e "${RED}✗${NC} $name: Arquivo não encontrado"
        return 1
    fi

    local count=$(count_chars "$file")
    local status=""

    if [ "$count" -gt "$limit" ]; then
        status="${RED}✗ EXCEDIDO${NC}"
    elif [ "$count" -eq 0 ]; then
        status="${YELLOW}⚠ VAZIO${NC}"
    else
        status="${GREEN}✓${NC}"
    fi

    echo -e "$status $name: $count / $limit caracteres"

    # Verificar placeholders
    if grep -q '\[.*\]' "$file" 2>/dev/null; then
        echo -e "  ${YELLOW}⚠ Contém placeholders: $(grep -o '\[.*\]' "$file" | head -3 | tr '\n' ' ')${NC}"
    fi
}

# Validar iOS
echo -e "${BLUE}iOS App Store:${NC}\n"

validate_file "$METADATA_DIR/ios/en-US/name.txt" 30 "Name"
validate_file "$METADATA_DIR/ios/en-US/subtitle.txt" 30 "Subtitle"
validate_file "$METADATA_DIR/ios/en-US/keywords.txt" 100 "Keywords"
validate_file "$METADATA_DIR/ios/en-US/promotional_text.txt" 170 "Promotional Text"
validate_file "$METADATA_DIR/ios/en-US/description.txt" 4000 "Description"

echo ""

# Validar Android
echo -e "${BLUE}Google Play Store:${NC}\n"

validate_file "$METADATA_DIR/android/en-US/title.txt" 50 "Title"
validate_file "$METADATA_DIR/android/en-US/short_description.txt" 80 "Short Description"
validate_file "$METADATA_DIR/android/en-US/full_description.txt" 4000 "Full Description"

echo ""

# Verificações adicionais
echo -e "${BLUE}Verificações Adicionais:${NC}\n"

# Verificar URLs
for file in "$METADATA_DIR/ios/en-US/support_url.txt" "$METADATA_DIR/ios/en-US/privacy_url.txt" "$METADATA_DIR/ios/en-US/marketing_url.txt"; do
    if [ -f "$file" ]; then
        url=$(cat "$file")
        if [[ $url =~ ^https?:// ]]; then
            echo -e "${GREEN}✓${NC} $(basename "$file"): URL válida"
        else
            echo -e "${RED}✗${NC} $(basename "$file"): URL inválida ou não é HTTPS"
        fi
    fi
done

# Verificar Rewards Hub
for file in "$METADATA_DIR/ios/en-US/description.txt" "$METADATA_DIR/android/en-US/full_description.txt"; do
    if [ -f "$file" ]; then
        if grep -q "clubcoins" "$file" && grep -q "111" "$file"; then
            echo -e "${GREEN}✓${NC} Programa de clubcoins presente (111 clubcoins/R$1)"
        else
            echo -e "${YELLOW}⚠${NC} Verificar programa de clubcoins (deve mencionar 111 clubcoins/R$1)"
        fi

        if grep -q -i "client score" "$file"; then
            echo -e "${GREEN}✓${NC} Client score mencionado"
        else
            echo -e "${YELLOW}⚠${NC} Client score não encontrado"
        fi
    fi
done

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Validação concluída!${NC}"
echo -e "${BLUE}================================${NC}"
