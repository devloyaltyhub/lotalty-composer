# Loyalty Composer

Hub de automacao centralizado do ecossistema Loyalty Hub.

## Sobre

CLI interativo em Node.js que centraliza toda a automacao do ecossistema: criacao de clientes white-label, build e deploy para lojas de aplicativos, gerenciamento de dados, backups e sincronizacao de regras Firestore.

## Tech Stack

- **Runtime**: Node.js
- **Integracao**: Firebase Admin SDK, Fastlane, Shorebird
- **Utilitarios**: simple-git, sharp, node-telegram-bot-api

## Estrutura

```
loyalty-composer/
├── 01-client-setup/       # Criacao e configuracao de clientes
├── 02-build-deploy/       # Fastlane, deploy para stores, screenshots, Shorebird OTA
├── 03-data-management/    # Ferramentas de exportacao/importacao de dados
├── 04-backup/             # Daemon de backup automatizado
├── 05-raspberry/          # Sincronizacao PDV para integracoes em loja
└── shared/                # Templates, validadores, utilitarios compartilhados
    ├── templates/         # Templates de configuracao (incl. firestore.rules)
    ├── validators/        # Validacao de setup de clientes
    └── utils/             # Scripts utilitarios (sync-firestore-rules.sh, etc.)
```

## Funcionalidades

- **Criacao de clientes**: Setup completo de projeto Firebase, configuracoes e assets
- **Build e deploy**: Integracao com Fastlane para Play Store e App Store
- **Screenshots**: Geracao automatizada de screenshots para lojas
- **Shorebird OTA**: Atualizacoes over-the-air sem revisao das stores
- **Regras Firestore**: Template centralizado com sync e deploy automaticos
- **Backups**: Daemon para backup periodico de dados
- **PDV**: Sincronizacao com sistemas de ponto de venda via Raspberry Pi

## Primeiros Passos

```bash
npm install

# CLI interativo principal
npm run loyalty
```

## Comandos

| Comando | Descricao |
|---------|-----------|
| `npm run loyalty` | CLI interativo principal |
| `npm run create-client` | Criar novo cliente white-label |
| `npm run verify-client` | Verificar setup de um cliente |
| `npm run deploy` | Build e deploy para stores |
| `npm run screenshots` | Gerar screenshots para stores |
| `npm run shorebird:patch` | Atualizacao OTA via Shorebird |
| `npm run deploy-admin` | Deploy do Admin para Google Play |

## Regras Firestore

O template centralizado de regras fica em `shared/templates/firestore-client.rules`. Para sincronizar e deployar:

```bash
# Apenas sincronizar
./shared/utils/sync-firestore-rules.sh

# Sincronizar e deployar
./shared/utils/sync-firestore-rules.sh --deploy
```
