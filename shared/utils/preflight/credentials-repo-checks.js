const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { COMPOSE_ROOT } = require('../paths');

function createCredentialsRepoChecks(context) {
  const { execCommand, setFailed } = context;

  function cloneCredentialsRepo(loyaltyHubRoot, credentialsRepoPath) {
    logger.info('Attempting to clone loyalty-credentials repository...');

    const gitUrl =
      process.env.MATCH_GIT_URL || 'git@github.com:devloyaltyhub/loyalty-credentials.git';

    try {
      const cloneCommand = `cd "${loyaltyHubRoot}" && git clone ${gitUrl}`;
      execCommand(cloneCommand);

      if (fs.existsSync(credentialsRepoPath)) {
        logger.success('loyalty-credentials repository cloned successfully');
        logger.startSpinner('Verifying repository structure...');
        return true;
      }

      logCloneFailure(loyaltyHubRoot, gitUrl);
      return false;
    } catch (error) {
      logger.error('Failed to clone loyalty-credentials repository');
      logger.error(`Error: ${error.message}`);
      logger.blank();
      logger.info('Please verify:');
      logger.info('  1. You have SSH access to the repository');
      logger.info('  2. Your SSH key is added to GitHub');
      logger.info('  3. The repository URL is correct in .env (MATCH_GIT_URL)');
      logger.blank();
      logger.info('To clone manually, run:');
      logger.info(`  cd ${loyaltyHubRoot}`);
      logger.info(`  git clone ${gitUrl}`);
      return false;
    }
  }

  function logCloneFailure(parentDir, gitUrl) {
    logger.error('Failed to clone loyalty-credentials repository');
    logger.info('Structure should be:');
    logger.info('  loyaltyhub/');
    logger.info('    loyalty-credentials/  <- Must exist here');
    logger.info('    loyalty-compose/');
    logger.blank();
    logger.info('To clone manually, run:');
    logger.info(`  cd ${parentDir}`);
    logger.info(`  git clone ${gitUrl}`);
  }

  function createMissingFolders(missingFolders) {
    logger.stopSpinner();
    logger.warn('loyalty-credentials structure incomplete, creating folders...');

    missingFolders.forEach((folder) => {
      fs.mkdirSync(folder, { recursive: true });

      const gitkeepPath = path.join(folder, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '');
      }
    });

    logger.info('Created missing folders');
  }

  function initializeGitRepo(credentialsRepoPath) {
    const isGitInitialized = execCommand(
      `cd ${credentialsRepoPath} && git rev-parse --git-dir 2>/dev/null`
    );

    if (!isGitInitialized) {
      logger.info('Initializing git repository...');
      execCommand(`cd ${credentialsRepoPath} && git init && git branch -M main`);
    }
  }

  function createInitialCommit(credentialsRepoPath) {
    const hasCommits = execCommand(`cd ${credentialsRepoPath} && git log -1 2>/dev/null`);

    if (hasCommits) {
      return;
    }

    logger.info('Creating initial commit...');

    const readmePath = path.join(credentialsRepoPath, 'README.md');
    const readmeContent = generateReadmeContent();
    fs.writeFileSync(readmePath, readmeContent, 'utf8');

    execCommand(`cd ${credentialsRepoPath} && git add .`);

    const commitMessage = generateCommitMessage();
    execCommand(
      `cd ${credentialsRepoPath} && git commit -m "${commitMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
    );

    logger.info('Initial commit created');

    const hasRemote = execCommand(`cd ${credentialsRepoPath} && git remote 2>/dev/null`);
    if (!hasRemote) {
      logger.warn('No git remote configured for loyalty-credentials');
      logger.info('Add remote: cd loyalty-credentials && git remote add origin <url>');
    } else {
      logger.info('Push commits: cd loyalty-credentials && git push -u origin main');
    }
  }

  function generateReadmeContent() {
    return `# LoyaltyHub Credentials Repository

This repository stores all credentials for the LoyaltyHub white-label system.

## Structure

\`\`\`
loyalty-credentials/
├── shared/                   # Shared credentials (all clients)
│   ├── master-firebase-service-account.json
│   ├── master-gcloud-service-account.json
│   ├── google-play-service-account.json (optional)
│   ├── AuthKey_*.p8 (App Store Connect API)
│   └── ios/                  # Shared iOS certificates (via Match)
│       └── certs/
│           ├── development/
│           └── distribution/
├── profiles/                 # Match profiles (auto-organized by script)
│   ├── development/
│   └── appstore/
└── clients/                  # Per-client credentials
    └── {client-code}/
        ├── android/
        │   ├── keystore-debug.jks
        │   ├── keystore-release.jks
        │   └── keystore.properties
        └── ios/              # Client-specific iOS profiles (copied by script)
            ├── AppStore_*.mobileprovision
            └── Development_*.mobileprovision
\`\`\`

## Security

- **NEVER** commit this repository to a public repository
- Ensure repository is **PRIVATE**
- Limit access to trusted team members only
- Keep backups in secure locations

## Usage

Credentials are automatically managed by the LoyaltyHub automation system.

- Android keystores: Generated during client creation
- iOS certificates: Generated via Fastlane Match
- All credentials are automatically committed and pushed

See \`loyalty-compose/docs/credentials-and-signing.md\` for full documentation.
`;
  }

  function generateCommitMessage() {
    return `Initial commit: loyalty-credentials repository structure

Created folder structure:
- shared/ - Shared credentials (Firebase, App Store API, iOS certs)
- profiles/ - iOS provisioning profiles (via Match)
- clients/ - Client-specific credentials

Generated: ${new Date().toISOString()}`;
  }

  function checkLoyaltyCredentialsRepo() {
    logger.startSpinner('Checking loyalty-credentials repository...');

    const loyaltyHubRoot = path.resolve(COMPOSE_ROOT, '..');
    const credentialsRepoPath = path.join(loyaltyHubRoot, 'loyalty-credentials');

    if (!fs.existsSync(credentialsRepoPath)) {
      logger.stopSpinner();
      logger.warn('loyalty-credentials repository not found');
      logger.info(`Expected path: ${credentialsRepoPath}`);
      logger.blank();

      if (!cloneCredentialsRepo(loyaltyHubRoot, credentialsRepoPath)) {
        setFailed();
        return false;
      }
    }

    const requiredFolders = [
      path.join(credentialsRepoPath, 'shared'),
      path.join(credentialsRepoPath, 'shared', 'ios'),
      path.join(credentialsRepoPath, 'shared', 'ios', 'certs'),
      path.join(credentialsRepoPath, 'profiles'),
      path.join(credentialsRepoPath, 'profiles', 'development'),
      path.join(credentialsRepoPath, 'profiles', 'appstore'),
      path.join(credentialsRepoPath, 'clients'),
    ];

    const missingFolders = requiredFolders.filter((folder) => !fs.existsSync(folder));

    if (missingFolders.length > 0) {
      createMissingFolders(missingFolders);
    }

    initializeGitRepo(credentialsRepoPath);
    createInitialCommit(credentialsRepoPath);

    logger.succeedSpinner('loyalty-credentials repository ready');
    return true;
  }

  return {
    checkLoyaltyCredentialsRepo,
  };
}

module.exports = { createCredentialsRepoChecks };
