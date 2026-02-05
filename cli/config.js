/**
 * CLI Configuration
 * Scripts and Workflows definitions
 */

const { CATEGORIES } = require('./constants');

// ============================================================================
// SCRIPTS CONFIGURATION
// ============================================================================

const SCRIPTS = {
  // Client Operations
  CREATE_CLIENT: {
    name: 'Criar Cliente',
    description: 'Fase 01: Firebase, Firestore, admin user, commit para main (sem build)',
    category: CATEGORIES.CLIENT_OPS,
    script: '01-client-setup/cli/create-client.js',
  },
  UPDATE_CLIENT: {
    name: 'Atualizar Cliente',
    description: 'Rebuild completo e redeploy de cliente existente com novas configurações',
    category: CATEGORIES.CLIENT_OPS,
    script: '01-client-setup/cli/update-client.js',
  },
  VERIFY_CLIENT: {
    name: 'Verificar Cliente',
    description: 'Health check: valida config, Firebase, assets, Git, metadata e dados Firestore',
    category: CATEGORIES.CLIENT_OPS,
    script: '01-client-setup/cli/verify-client.js',
  },
  ROLLBACK_CLIENT: {
    name: 'Reverter Cliente',
    description: 'Rollback seguro para versão anterior (config, assets e código)',
    category: CATEGORIES.CLIENT_OPS,
    script: '01-client-setup/cli/rollback-client.js',
  },
  UPDATE_METADATA: {
    name: 'Atualizar Metadados',
    description: 'Atualizar título, descrição e keywords das lojas Android/iOS',
    category: CATEGORIES.CLIENT_OPS,
    script: '01-client-setup/cli/update-metadata.js',
  },
  SETUP_WHITE_LABEL: {
    name: 'Configurar White Label',
    description: 'Aplicar configuração do cliente: cores, logos, nome e bundleId no app',
    category: CATEGORIES.CLIENT_OPS,
    script: '01-client-setup/steps/setup-white-label.js',
  },
  RESET_TO_DEV: {
    name: 'Resetar para Dev',
    description: 'Voltar app para configuração demo/desenvolvimento (desfaz white label)',
    category: CATEGORIES.CLIENT_OPS,
    script: '01-client-setup/steps/setup-white-label.js',
    args: ['demo'],
  },

  // Security & Authentication
  SETUP_MASTER_USER: {
    name: 'Criar Usuário Master',
    description: 'Criar usuário master no Firebase Authentication e Firestore',
    category: CATEGORIES.SECURITY,
    script: '01-client-setup/cli/setup-master-user.js',
  },
  DEPLOY_MASTER_RULES: {
    name: 'Deploy Rules Master Firebase',
    description: 'Deploy das regras de segurança do Firestore no Master Firebase',
    category: CATEGORIES.SECURITY,
    script: '01-client-setup/cli/deploy-master-rules.js',
  },
  COMPLETE_SECURITY_SETUP: {
    name: 'Setup Completo de Segurança',
    description: 'Criar usuário master + deploy de rules (tudo automatizado)',
    category: CATEGORIES.SECURITY,
    script: '01-client-setup/cli/complete-security-setup.js',
  },
  SETUP_IOS_CERTIFICATES: {
    name: 'Setup Certificados iOS',
    description: 'Configurar certificados e perfis de provisionamento iOS para um cliente',
    category: CATEGORIES.SECURITY,
    script: '01-client-setup/cli/setup-ios-certificates.js',
  },
  SETUP_ANDROID_CREDENTIALS: {
    name: 'Setup Credenciais Android',
    description: 'Configurar keystores e credenciais Google Play para um cliente',
    category: CATEGORIES.SECURITY,
    script: '01-client-setup/cli/setup-android-credentials.js',
  },

  // Assets & Business Types
  CREATE_BUSINESS_TYPE: {
    name: 'Criar/Deletar Tipo de Negócio',
    description: 'Gerenciar templates com assets compartilhados (restaurante, café, etc)',
    category: CATEGORIES.ASSETS,
    script: '01-client-setup/shared/business-type-manager.js',
  },
  VALIDATE_ASSETS: {
    name: 'Validar Assets',
    description: 'Verificar presença e formato de logos, ícones e imagens obrigatórias',
    category: CATEGORIES.ASSETS,
    script: 'shared/validators/asset-validator.js',
  },

  // Validation
  PREFLIGHT_CHECK: {
    name: 'Verificação Pré-voo',
    description: 'Validar ambiente: Node, Dart, Flutter, Firebase CLI e dependências',
    category: CATEGORIES.VALIDATION,
    script: 'shared/utils/preflight-check.js',
  },
  CHECK_UNUSED_FILES: {
    name: 'Verificar Arquivos Não Usados',
    description: 'Escanear projeto e identificar arquivos/assets não referenciados',
    category: CATEGORIES.VALIDATION,
    script: 'shared/validators/check-unused-files.js',
  },

  // Build & Deploy
  DEPLOY_CLIENT: {
    name: 'Deploy para Stores',
    description: 'Build completo + screenshots + deploy automático (Play Store + App Store)',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/deploy-client.js',
  },
  GENERATE_SCREENSHOTS: {
    name: 'Gerar Screenshots',
    description: 'Capturar screenshots via testes de integração para todas as stores',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/generate-screenshots.js',
  },
  BUILD_ONLY: {
    name: 'Build Apenas (sem Deploy)',
    description: 'Compilar app Android/iOS sem enviar para lojas',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/build-client.js',
    args: ['--no-deploy'],
  },

  // Shorebird OTA Updates
  SHOREBIRD_MENU: {
    name: 'Shorebird OTA Updates',
    description: 'Gerenciar releases e patches para atualizações OTA (sem passar pela store)',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/shorebird.js',
  },
  SHOREBIRD_RELEASE: {
    name: 'Shorebird: Criar Release',
    description: 'Criar novo release para submissão na store (habilita OTA futuro)',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/shorebird.js',
    args: ['release'],
  },
  SHOREBIRD_PATCH: {
    name: 'Shorebird: Criar Patch',
    description: 'Criar patch OTA - correção instantânea sem passar pela store',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/shorebird.js',
    args: ['patch'],
  },
  SHOREBIRD_CONSOLE: {
    name: 'Shorebird: Abrir Console',
    description: 'Abrir Console Shorebird no navegador (ver releases/patches)',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/shorebird.js',
    args: ['console'],
  },
  SHOREBIRD_DOCTOR: {
    name: 'Shorebird: Verificar Instalação',
    description: 'Executar shorebird doctor para verificar configuração',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/shorebird.js',
    args: ['doctor'],
  },

  // Admin Deploy (Web only)
  DEPLOY_ADMIN: {
    name: 'Deploy Admin',
    description: 'Build Flutter Web e deploy para GitHub Pages (devloyaltyhub.github.io)',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/deploy-admin-web.js',
  },
  BUILD_ADMIN: {
    name: 'Build Admin (sem deploy)',
    description: 'Compilar Flutter Web sem enviar para GitHub Pages',
    category: CATEGORIES.BUILD_DEPLOY,
    script: '02-build-deploy/cli/deploy-admin-web.js',
    args: ['--build-only'],
  },

  // Data Management
  EXPORT_DEMO_DATA: {
    name: 'Exportar Dados Demo',
    description: 'Exportar dados Firestore/Storage para template de demonstração',
    category: CATEGORIES.CLIENT_OPS,
    script: '03-data-management/cli/export-demo-data.js',
  },

  // Backup & Restore
  BACKUP_ONCE: {
    name: 'Executar Backup Agora',
    description: 'Backup imediato de todos os clientes (Firestore + Storage) para GitHub',
    category: CATEGORIES.BACKUP,
    script: '04-backup/daemon.js',
    args: ['--once'],
  },
  BACKUP_CLI: {
    name: 'Menu de Backup',
    description: 'Menu interativo para listar e restaurar backups',
    category: CATEGORIES.BACKUP,
    script: '04-backup/cli-menu.js',
  },
  BACKUP_LIST: {
    name: 'Listar Backups',
    description: 'Ver todos os backups disponíveis no GitHub',
    category: CATEGORIES.BACKUP,
    script: '04-backup/list-backups.js',
  },
  BACKUP_RESTORE: {
    name: 'Restaurar Backup',
    description: 'Restaurar Firestore/Storage de um backup específico',
    category: CATEGORIES.BACKUP,
    script: '04-backup/restore-backup/index.js',
  },
};

// ============================================================================
// WORKFLOWS CONFIGURATION
// ============================================================================

const WORKFLOWS = {
  COMPLETE_SETUP: {
    name: 'Configuração Completa de Cliente',
    description: 'Setup completo: valida ambiente → cria cliente → verifica saúde',
    category: CATEGORIES.WORKFLOWS,
    steps: [
      { action: 'preflight', script: SCRIPTS.PREFLIGHT_CHECK },
      { action: 'create', script: SCRIPTS.CREATE_CLIENT },
      { action: 'verify', script: SCRIPTS.VERIFY_CLIENT },
    ],
  },
  QUICK_UPDATE: {
    name: 'Setup White Label App',
    description: 'Atualização express: aplica white label → valida assets',
    category: CATEGORIES.WORKFLOWS,
    steps: [
      { action: 'setup', script: SCRIPTS.SETUP_WHITE_LABEL },
      { action: 'validate', script: SCRIPTS.VALIDATE_ASSETS },
    ],
  },
  PRE_BUILD_CHECK: {
    name: 'Checklist Pré-Build',
    description: 'Validação completa antes de build: ambiente, cliente, assets e código',
    category: CATEGORIES.WORKFLOWS,
    steps: [
      { action: 'preflight', script: SCRIPTS.PREFLIGHT_CHECK },
      { action: 'verify', script: SCRIPTS.VERIFY_CLIENT },
      { action: 'validate-assets', script: SCRIPTS.VALIDATE_ASSETS },
      { action: 'check-unused', script: SCRIPTS.CHECK_UNUSED_FILES },
    ],
  },
  EMERGENCY_ROLLBACK: {
    name: 'Rollback de Emergência',
    description: 'Reverter rapidamente para última versão estável (com confirmação)',
    category: CATEGORIES.WORKFLOWS,
    confirmStart: true,
    steps: [
      { action: 'rollback', script: SCRIPTS.ROLLBACK_CLIENT },
      { action: 'verify', script: SCRIPTS.VERIFY_CLIENT },
    ],
  },
  METADATA_UPDATE: {
    name: 'Atualização de Metadados',
    description: 'Alterar informações das lojas (título, descrição) e reaplicar white label',
    category: CATEGORIES.WORKFLOWS,
    steps: [
      { action: 'update-meta', script: SCRIPTS.UPDATE_METADATA },
      { action: 'setup', script: SCRIPTS.SETUP_WHITE_LABEL, optional: true },
    ],
  },
  MASTER_FIREBASE_SECURITY: {
    name: '🔐 Setup Segurança Master Firebase',
    description: 'Configuração completa de segurança: criar master user + deploy rules',
    category: CATEGORIES.WORKFLOWS,
    steps: [
      { action: 'setup-user', script: SCRIPTS.SETUP_MASTER_USER },
      { action: 'deploy-rules', script: SCRIPTS.DEPLOY_MASTER_RULES },
    ],
  },
  DEPLOY_TO_STORES: {
    name: '🚀 Deploy Mobile apps',
    description: 'Validação → Screenshots → Build → Deploy automático (Play Store + App Store)',
    category: CATEGORIES.WORKFLOWS,
    confirmStart: true,
    steps: [
      { action: 'preflight', script: SCRIPTS.PREFLIGHT_CHECK },
      { action: 'verify', script: SCRIPTS.VERIFY_CLIENT },
      { action: 'validate-assets', script: SCRIPTS.VALIDATE_ASSETS },
      { action: 'deploy', script: SCRIPTS.DEPLOY_CLIENT },
    ],
  },
  DEPLOY_ADMIN: {
    name: '🚀 Deploy Admin',
    description: 'Build e deploy do Admin Web para GitHub Pages',
    category: CATEGORIES.WORKFLOWS,
    confirmStart: true,
    steps: [
      { action: 'deploy', script: SCRIPTS.DEPLOY_ADMIN },
    ],
  },
};

module.exports = {
  SCRIPTS,
  WORKFLOWS,
};
