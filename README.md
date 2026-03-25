# Loyalty Composer

Hub de automação centralizado do ecossistema Loyalty Hub.

## Sobre

CLI interativo em Node.js que centraliza toda a automação do ecossistema: criação de clientes white-label, build e deploy para lojas de aplicativos, gerenciamento de dados, backups e sincronização de regras Firestore.

## Tech Stack

- **Runtime**: Node.js
- **Integração**: Firebase Admin SDK, Fastlane, Shorebird
- **Utilitários**: simple-git, sharp, node-telegram-bot-api

## Estrutura

```
loyalty-composer/
├── 01-client-setup/       # Criação e configuração de clientes
├── 02-build-deploy/       # Fastlane, deploy para stores, screenshots, Shorebird OTA
├── 03-data-management/    # Ferramentas de exportação/importação de dados
├── 04-backup/             # Daemon de backup automatizado
├── 05-raspberry/          # Sincronização PDV para integrações em loja
└── shared/                # Templates, validadores, utilitários compartilhados
    ├── templates/         # Templates de configuração (incl. firestore.rules)
    ├── validators/        # Validação de setup de clientes
    └── utils/             # Scripts utilitários (sync-firestore-rules.sh, etc.)
```

## Funcionalidades

- **Criação de clientes**: Setup completo de projeto Firebase, configurações e assets
- **Build e deploy**: Integração com Fastlane para Play Store e App Store
- **Screenshots**: Geração automatizada de screenshots para lojas
- **Shorebird OTA**: Atualizações over-the-air sem revisão das stores
- **Regras Firestore**: Template centralizado com sync e deploy automáticos
- **Backups**: Daemon para backup periódico de dados
- **PDV**: Sincronização com sistemas de ponto de venda via Raspberry Pi

## Primeiros Passos

```bash
npm install

# CLI interativo principal
npm run loyalty
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run loyalty` | CLI interativo principal |
| `npm run create-client` | Criar novo cliente white-label |
| `npm run verify-client` | Verificar setup de um cliente |
| `npm run deploy` | Build e deploy para stores |
| `npm run screenshots` | Gerar screenshots para stores |
| `npm run shorebird:patch` | Atualização OTA via Shorebird |
| `npm run deploy-admin` | Deploy do Admin para Google Play |

## Regras Firestore

O template centralizado de regras fica em `shared/templates/firestore-client.rules`. Para sincronizar e deployar:

```bash
# Apenas sincronizar
./shared/utils/sync-firestore-rules.sh

# Sincronizar e deployar
./shared/utils/sync-firestore-rules.sh --deploy
```
