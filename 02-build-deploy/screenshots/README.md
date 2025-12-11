# 📱 Screenshot Automation CLI v2.0

Sistema profissional de automação de screenshots para apps Flutter, construído com Python, OpenCV e ImageMagick.

## 🌟 Funcionalidades

- **📸 Captura Automatizada**: Executa testes de integração Flutter para capturar screenshots
- **🎨 Mockups 3D**: Cria mockups profissionais 3D com backgrounds gradientes
- **🔄 Pipeline Completo**: Workflow end-to-end da captura aos mockups finais
- **📱 Multi-Plataforma**: Suporte para dispositivos iOS e Android
- **⚙️ Configurável**: Modos interativo ou totalmente automatizado
- **🏗️ Arquitetura Limpa**: Design modular seguindo princípios SOLID

## 📂 Estrutura do Projeto

```
automation/screenshots/
├── main.py                      # CLI principal
├── README.md                    # Este arquivo
│
├── commands/                    # Implementação de comandos
│   ├── capture.py              # Captura de screenshots
│   ├── generate_mockups.py     # Geração de mockups
│   └── pipeline.py             # Workflow completo
│
├── services/                    # Serviços principais
│   ├── simulator.py            # Gerenciamento do simulador iOS
│   ├── flutter.py              # Execução de testes Flutter
│   └── imagemagick.py          # Operações ImageMagick
│
├── config/                      # Configuração
│   ├── constants.sh            # Constantes Bash
│   └── screenshot_config.py    # Constantes Python
│
├── core/                        # Utilitários compartilhados
│   └── bash_utils.sh           # Funções utilitárias Bash
│
├── apply_mockup.py              # Script Python/OpenCV para mockups flat
└── mockupgen_templates/         # Templates de dispositivos
    └── iphone15promax/
        ├── frame.png
        └── index.json
```

## 🚀 Início Rápido

### Pré-requisitos

1. **Python 3.7+** com dependências:
   ```bash
   pip3 install opencv-python numpy pillow
   ```

2. **ImageMagick 7+**:
   ```bash
   brew install imagemagick
   ```

3. **Flutter SDK** (para captura de screenshots):
   ```bash
   flutter --version
   ```

4. **Xcode & Command Line Tools** (para iOS):
   ```bash
   xcode-select --install
   ```

### Uso Básico

```bash
# Navegar para a raiz do projeto
cd /caminho/para/loyalty-compose

# Executar pipeline completo (interativo)
python3 02-build-deploy/screenshots/main.py pipeline

# Executar pipeline completo (automatizado)
python3 02-build-deploy/screenshots/main.py pipeline \
  --device-choice 1 \
  --gradient-choice 3 \
  --angle-choice 2
```

## 📖 Comandos do CLI

### 1️⃣ Capturar Screenshots

Captura screenshots do app usando testes de integração Flutter.

```bash
# Screenshots iOS
python3 automation/screenshots/main.py capture \
  --device "iPhone 15 Pro Max" \
  --platform ios

# Screenshots Android
python3 automation/screenshots/main.py capture \
  --platform android

# Pular testes (usar screenshots existentes)
python3 automation/screenshots/main.py capture --skip-tests
```

**Opções:**
- `--device <nome>`: Nome do dispositivo iOS (padrão: "iPhone 15 Pro Max")
- `--platform <ios|android>`: Plataforma (padrão: ios)
- `--skip-tests`: Pular execução de testes, usar screenshots existentes
- `--screenshots-dir <caminho>`: Diretório customizado de screenshots
- `--white-label-dir <caminho>`: Diretório customizado do projeto Flutter

### 2️⃣ Gerar Mockups

Gera mockups 3D com backgrounds gradientes.

```bash
# Modo interativo (pede escolhas)
python3 automation/screenshots/main.py mockups

# Modo automatizado
python3 automation/screenshots/main.py mockups \
  --device-choice 1 \
  --gradient-choice 3 \
  --angle-choice 2
```

**Escolhas de Dispositivo:**
- `1` - iPhone 15 Pro Max
- `2` - Pixel 8 Pro

**Estilos de Gradiente:**
- `1` - Premium Purple/Pink 🌟
- `2` - Ocean Blue 🌊
- `3` - Sunset Orange 🔥
- `4` - Fresh Green 🌿
- `5` - Dark Purple 🌙
- `6` - Bold Red/Pink 🎯

**Ângulos de Rotação:**
- `1` - Sutil (15°) - Discreto
- `2` - Moderado (20°) - Equilibrado ⭐ *Recomendado*
- `3` - Pronunciado (25°) - Impactante

**Opções:**
- `--device-choice <1-2>`: Escolha do dispositivo do mockup
- `--gradient-choice <1-6>`: Estilo de gradiente
- `--angle-choice <1-3>`: Ângulo de rotação
- `--screenshots-dir <caminho>`: Diretório de entrada de screenshots
- `--output-dir <caminho>`: Diretório de saída para mockups
- `--templates-dir <caminho>`: Diretório de templates de dispositivos

### 3️⃣ Pipeline Completo

Executa o workflow completo: captura + mockups.

```bash
# Modo interativo
python3 automation/screenshots/main.py pipeline

# Totalmente automatizado
python3 automation/screenshots/main.py pipeline \
  --device-choice 1 \
  --gradient-choice 3 \
  --angle-choice 2

# Pular testes + mockups automatizados
python3 automation/screenshots/main.py pipeline \
  --skip-tests \
  --device-choice 2 \
  --gradient-choice 1 \
  --angle-choice 2

# Workflow Android
python3 automation/screenshots/main.py pipeline \
  --platform android \
  --device-choice 2
```

**Todas as opções de captura e mockup são suportadas.**

## 🎨 Pipeline de Geração de Mockups

A geração de mockups usa um pipeline de duas etapas:

1. **Mockup Flat** (`apply_mockup.py`):
   - Carrega screenshot e moldura do dispositivo
   - Aplica cantos arredondados (180px de raio para iPhone 15 Pro Max)
   - Realiza transformação de perspectiva para encaixar screenshot na moldura
   - Compõe screenshot com moldura usando canal alpha

2. **Efeito 3D** (`ImageMagick`):
   - Aplica distorção de perspectiva 3D
   - Adiciona sombra realista (70x35 blur)
   - Compõe no background gradiente
   - Gera mockup final de 2000×3500px

### Detalhes Técnicos

**Cálculo do Raio de Canto:**
```
iPhone 15 Pro Max: 55pt × 3 (retina) × 1.0619 (escala mockup) ≈ 180px
```

**Coeficientes de Perspectiva:**
```python
offset_superior = angulo_rotacao × 3
offset_inferior = angulo_rotacao × 4
```

**Configurações de Sombra:**
```
Blur: 70px
Spread: 35px
Offset: (angulo_rotacao + 10, 40)
```

## 🏗️ Arquitetura

### Princípios de Design

- **Princípios SOLID**: Responsabilidade única, injeção de dependências
- **KISS**: Manter simples, evitar over-engineering
- **DRY**: Constantes compartilhadas, serviços reutilizáveis
- **Guard Clauses**: Retornos antecipados para validação
- **Type Hints**: Anotações de tipo completas para melhor suporte de IDE
- **Logging**: Logging estruturado para debugging

### Componentes-Chave

#### Camada de Serviços

**`SimulatorService`** ([services/simulator.py](services/simulator.py)):
- Gerenciamento do simulador iOS
- Operações de boot/shutdown
- Listagem de dispositivos e verificação de status

**`FlutterService`** ([services/flutter.py](services/flutter.py)):
- Execução de comandos Flutter
- Execução de testes de integração
- Gerenciamento de dispositivos

**`ImageMagickService`** ([services/imagemagick.py](services/imagemagick.py)):
- Wrapper de comandos ImageMagick
- Transformações de perspectiva 3D
- Operações de gradiente e composição

#### Camada de Comandos

**`ScreenshotCapture`** ([commands/capture.py](commands/capture.py)):
- Workflow de captura de screenshots
- Preparação de ambiente
- Validação de screenshots

**`MockupGenerator`** ([commands/generate_mockups.py](commands/generate_mockups.py)):
- Workflow de geração de mockups
- Interação com usuário (seleção de dispositivo/gradiente/ângulo)
- Processamento em lote

**`ScreenshotPipeline`** ([commands/pipeline.py](commands/pipeline.py)):
- Orquestração end-to-end
- Workflow Captura → Mockup
- Relatório de resumo

### Configuração

Todos os magic numbers foram eliminados e substituídos por constantes nomeadas:

**Python** ([config/screenshot_config.py](config/screenshot_config.py)):
```python
class MockupConfig:
    CANVAS_WIDTH = 2000
    CANVAS_HEIGHT = 3500
    SHADOW_BLUR = 70
    SHADOW_SPREAD = 35
    ROTATION_SUBTLE = 15
    ROTATION_MODERATE = 20
    ROTATION_PRONOUNCED = 25
```

**Bash** ([config/constants.sh](config/constants.sh)):
```bash
readonly CANVAS_WIDTH=2000
readonly CANVAS_HEIGHT=3500
readonly SHADOW_BLUR=70
```

## 📊 Saída

### Estrutura de Diretórios

```
white_label_app/screenshots/
├── 01_home.png                 # Screenshots originais
├── 02_product_details.png
├── 03_cart.png
├── 04_checkout.png
├── 05_loyalty_card.png
└── mockups/                 # Mockups gerados
    ├── 01_home_iphone_3d.png
    ├── 02_product_details_iphone_3d.png
    ├── 03_cart_iphone_3d.png
    ├── 04_checkout_iphone_3d.png
    └── 05_loyalty_card_iphone_3d.png
```

### Especificações dos Mockups

- **Resolução**: 2000×3500 pixels
- **Formato**: PNG com transparência
- **Tamanho do Arquivo**: ~2-5 MB por mockup
- **Espaço de Cor**: sRGB
- **Profundidade de Bits**: 8-bit RGBA

### Conformidade com App Stores

**iOS App Store:**
- ✅ Resolução máxima: Display 6.9" (1320×2868px) - *conforme*
- ✅ Formato: PNG ou JPEG
- ✅ Tamanho máximo: 8 MB
- ✅ Quantidade: 2-10 screenshots

**Google Play Store:**
- ✅ Resolução máxima: 3840×3840px - *conforme*
- ✅ Formato: PNG ou JPEG
- ✅ Tamanho máximo: 8 MB
- ✅ Quantidade: 2-8 screenshots

## 🔧 Solução de Problemas

### Problemas Comuns

**1. ImageMagick não encontrado**
```bash
# Instalar ImageMagick 7+
brew install imagemagick

# Verificar instalação
magick --version
```

**2. Erro de importação OpenCV/NumPy**
```bash
# Instalar dependências Python
pip3 install opencv-python numpy pillow
```

**3. Simulador não encontrado**
```bash
# Listar simuladores disponíveis
xcrun simctl list devices available | grep iPhone

# Criar novo simulador se necessário
xcrun simctl create "iPhone 15 Pro Max" \
  "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max" \
  "com.apple.CoreSimulator.SimRuntime.iOS-17-0"
```

**4. Teste Flutter falha**
```bash
# Limpar projeto Flutter
cd white_label_app
flutter clean
flutter pub get

# Executar testes manualmente para ver erro
flutter test integration_test/all_screenshots_test.dart
```

**5. Raio de canto incorreto**

Verificar se `index.json` tem corner_radius correto:
```json
{
  "slug": "iphone15promax",
  "corner_radius": 180
}
```

## 🚀 Performance

### Tempo de Execução

- **Captura de Screenshots**: ~45-120 segundos
  - Boot do simulador: ~5 segundos
  - Testes de integração: ~40-115 segundos

- **Geração de Mockups**: ~10-15 segundos (5 screenshots)
  - Mockup flat: ~1-2 segundos por screenshot
  - Efeito 3D: ~1-2 segundos por screenshot

- **Pipeline Total**: ~1-2 minutos

### Oportunidades de Otimização

1. **Cache de Screenshots** (Prioridade 1): 90% de economia de tempo
   - Cachear screenshots por versão do app/commit
   - Regenerar apenas se código do app mudou

2. **Feature Flag para Testes** (Prioridade 2): 40% mais rápido nos testes
   - Pular Firebase Remote Config em modo de teste
   - Reduzir operações de rede

3. **Processamento Paralelo** (Prioridade 3): 5-8 segundos de economia
   - Processar múltiplos screenshots em paralelo
   - Utilizar múltiplos núcleos de CPU

## 📝 Variáveis de Ambiente

O novo CLI suporta as mesmas variáveis de ambiente:

```bash
# Execução automatizada
export DEVICE_CHOICE=1
export GRADIENT_CHOICE=3
export ANGLE_CHOICE=2

python3 automation/screenshots/main.py pipeline
```

## 🤝 Contribuindo

### Estilo de Código

- **Python**: PEP 8, type hints, docstrings
- **Complexidade Ciclomática Máxima**: 10
- **Guard Clauses**: Usar retornos antecipados para validação
- **Tratamento de Erros**: Exceções específicas com mensagens claras

### Adicionando Novos Templates de Dispositivos

1. Criar imagem de moldura do dispositivo (`mockupgen_templates/<slug>/frame.png`)
2. Adicionar entrada ao `index.json`:
   ```json
   {
     "slug": "iphone16promax",
     "name": "iPhone 16 Pro Max",
     "corner_radius": 190,
     "screen_points": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
   }
   ```
3. Atualizar escolhas de dispositivo em `commands/generate_mockups.py`

### Adicionando Novos Estilos de Gradiente

Editar classe `GradientStyle` em [commands/generate_mockups.py](commands/generate_mockups.py):

```python
class GradientStyle:
    NOVO_ESTILO = ("Nome do Estilo", "#cor_inicio", "#cor_fim")
```

## ⚠️ Importante: Testes de Integração

A pasta `white_label_app/integration_test/` é **ESSENCIAL** e **NÃO PODE SER REMOVIDA**.

Ela contém:
- ✅ Testes Flutter que capturam os screenshots
- ✅ Helpers de autenticação e navegação
- ✅ Configuração de testes
- ✅ Test driver customizado

O CLI Python **DEPENDE** desses testes para funcionar. Veja [white_label_app/integration_test/README.md](../../white_label_app/integration_test/README.md) para mais detalhes.

## 📄 Licença

Parte do projeto de white-label app Loyalty Hub.

## 🙏 Agradecimentos

- **OpenCV**: Processamento de imagem e transformações de perspectiva
- **ImageMagick**: Efeitos 3D e composição
- **Flutter**: Framework de testes de integração
- Construído com ❤️ usando Python, seguindo melhores práticas e princípios SOLID

---

**Versão**: 2.0
**Última Atualização**: 2025-01-19
**Autor**: Screenshot Automation Team
**Status**: ✅ 100% Modernizado (Python)
