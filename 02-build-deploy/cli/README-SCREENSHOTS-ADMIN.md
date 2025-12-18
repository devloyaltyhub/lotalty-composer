# 📱 Screenshots Admin - Guia de Uso

## 🎯 Objetivo

Gerar screenshots do **loyalty-admin-main** para o **Google Play Store** usando dispositivos Android reais.

---

## ⚡ Uso Rápido

### Comando Básico
```bash
cd loyalty-composer
npm run screenshots-admin
```

Este comando irá:
1. Detectar emuladores/dispositivos Android disponíveis
2. Perguntar qual device usar (phone + tablet opcional)
3. Executar integration tests no Android
4. Capturar 8 screenshots automaticamente
5. Gerar mockups com gradiente roxo (#6366F1)
6. Copiar para `loyalty-admin-main/metadata/android/pt-BR/images/`

---

## 📋 Pré-requisitos

### 1. Emuladores Android
Você precisa de pelo menos 1 emulador Android rodando:

```bash
# Listar emuladores disponíveis
flutter emulators

# Iniciar phone emulator
flutter emulators --launch Pixel_7a

# Iniciar tablet emulator (opcional)
flutter emulators --launch Pixel_Tablet
```

### 2. Credenciais de Teste
O admin deve ter o usuário de teste configurado:
- Email: `admin@loyaltyhub.club`
- Senha: `123456`

Localização: `loyalty-admin-main/integration_test/test_config.dart`

### 3. Python 3
Para geração de mockups:
```bash
python3 --version  # Deve retornar 3.x
```

---

## 🎮 Opções de Uso

### Modo Interativo (Recomendado)
```bash
npm run screenshots-admin
```

### Modo Automatizado
```bash
# Usar device específico
npm run screenshots-admin -- --phone-device=<device_id>

# Pular integration tests (usar screenshots existentes)
npm run screenshots-admin -- --skip-tests

# Pular geração de mockups
npm run screenshots-admin -- --skip-mockups

# Combinar opções
npm run screenshots-admin -- --skip-tests --skip-mockups
```

### Via Loyalty CLI
```bash
npm run loyalty
# → Escolher "Build & Deploy"
# → Escolher "Gerar Screenshots Admin"
```

---

## 📸 Screenshots Capturados

O integration test captura automaticamente:

1. **01_consumo.png** - Dashboard principal (Consumo)
2. **02_clientes.png** - Gestão de clientes
3. **03_produtos.png** - Catálogo de produtos
4. **04_campanhas.png** - Campanhas de marketing
5. **05_happy_hours.png** - Happy Hours configurados
6. **06_relatorios.png** - Relatórios e analytics
7. **07_configuracoes.png** - Configurações do estabelecimento
8. **08_time.png** - Gestão da equipe

---

## 🎨 Mockups Gerados

O sistema gera automaticamente:

### Google Play Phone
- 8 mockups com frame de dispositivo
- Gradiente roxo (#6366F1)
- Perspectiva 3D
- Sombra realista
- Localização: `screenshots/mockups/gplay_phone/`

### Google Play Tablet
- 8 mockups formato tablet
- Mesmo estilo visual
- Localização: `screenshots/mockups/gplay_tablet/`

### Feature Graphic
- Banner 1024×500px
- Para listagem no Google Play
- Localização: `screenshots/mockups/feature_graphic/featureGraphic.png`

---

## 📁 Estrutura de Arquivos

```
loyalty-admin-main/
├── screenshots/
│   ├── 01_consumo.png              # Screenshots raw (Android)
│   ├── 02_clientes.png
│   ├── ...
│   └── mockups/
│       ├── gplay_phone/            # Mockups finais (phone)
│       ├── gplay_tablet/           # Mockups finais (tablet)
│       └── feature_graphic/        # Feature Graphic
└── metadata/android/pt-BR/images/
    ├── phoneScreenshots/           # Screenshots finais (Google Play)
    ├── tenInchScreenshots/         # Screenshots tablet (Google Play)
    └── featureGraphic.png          # Feature Graphic (Google Play)
```

---

## 🔧 Troubleshooting

### Nenhum dispositivo Android encontrado
```bash
# Verificar dispositivos conectados
flutter devices

# Listar emuladores disponíveis
flutter emulators

# Iniciar um emulador
flutter emulators --launch Pixel_7a
```

### Integration tests falhando
```bash
# Verificar se o app compila
cd loyalty-admin-main
flutter analyze

# Testar manualmente
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/all_screenshots_test.dart \
  -d <device_id>
```

### Python não encontrado
```bash
# macOS
brew install python3

# Verificar instalação
python3 --version
```

### Screenshots não aparecem
- Verificar se o usuário `admin@loyaltyhub.club` existe no Firebase
- Verificar se o app consegue fazer login
- Verificar logs do integration test

---

## 🚀 Deploy

Após gerar os screenshots, você pode fazer deploy:

```bash
cd loyalty-composer
npm run deploy-admin
```

Ou apenas build sem deploy:

```bash
npm run build-admin
```

---

## 📊 Configuração do Pipeline Python

A configuração já está pronta em:
`loyalty-composer/02-build-deploy/screenshots/config/project_config.py`

```python
class LoyaltyAdminConfig(ProjectConfig):
    # Cor primária fixa
    def get_primary_color(self):
        return "#6366F1"  # Roxo/Indigo
    
    # Feature flags
    generate_iphone = False        # ❌ Admin não está no iOS
    generate_ipad = False          # ❌ Admin não está no iOS
    generate_gplay_phone = True    # ✅ Google Play Phone
    generate_gplay_tablet = True   # ✅ Google Play Tablet
    generate_feature_graphic = True # ✅ Feature Graphic
```

---

## 💡 Dicas

1. **Screenshots de qualidade**: Execute em emuladores com alta resolução
2. **Dados reais**: Popule o Firebase com dados realistas antes de capturar
3. **UI consistente**: Certifique-se que todas as telas estão carregadas antes da captura
4. **Testar manualmente primeiro**: Execute o app manualmente antes de rodar o script
5. **Salvar versões antigas**: Faça backup dos screenshots antigos antes de regerar

---

## 📚 Documentação Relacionada

- [Integration Tests](../../loyalty-admin-main/integration_test/README.md)
- [Python Pipeline](../screenshots/README.md)
- [Deploy Admin](./deploy-admin.js)

---

**Versão**: 1.0.0  
**Última Atualização**: 2025-12-18
