const fs = require('fs');
const path = require('path');
const logger = require('../../../shared/utils/logger');

function expandEnvVars(pathStr) {
  if (!pathStr) return pathStr;
  return pathStr.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (match, varName) => {
    return process.env[varName] || match;
  });
}

class CertificateChecker {
  constructor(config, checkResult) {
    this.config = config;
    this.checkResult = checkResult;
    this.loyaltyAppRoot = path.join(__dirname, '..', '..', '..', '..');
    this.credentialsDir = path.join(this.loyaltyAppRoot, '..', 'loyalty-credentials');
  }

  checkAndroid() {
    logger.info('Checking Android certificates...');

    if (!this.config || !this.config.clientCode) {
      this.checkResult.warn('Client code not in config, skipping Android certificates check');
      return true;
    }

    if (!fs.existsSync(this.credentialsDir)) {
      this.checkResult.warn('loyalty-credentials directory not found');
      logger.info('   Run the setup wizard to generate Android keystores');
      return true;
    }

    const androidDir = path.join(this.credentialsDir, 'clients', this.config.clientCode, 'android');

    if (!fs.existsSync(androidDir)) {
      this.checkResult.fail('Android certificates directory not found');
      logger.info('   Run: npm run setup:keystore');
      return false;
    }

    const keystoreDebug = path.join(androidDir, 'keystore-debug.jks');
    const keystoreRelease = path.join(androidDir, 'keystore-release.jks');
    const keystoreProps = path.join(androidDir, 'keystore.properties');

    let allPresent = true;

    if (!fs.existsSync(keystoreDebug)) {
      this.checkResult.fail('Android debug keystore not found');
      allPresent = false;
    } else {
      this.checkResult.pass('Android debug keystore exists');
    }

    if (!fs.existsSync(keystoreRelease)) {
      this.checkResult.fail('Android release keystore not found');
      allPresent = false;
    } else {
      this.checkResult.pass('Android release keystore exists');
    }

    if (!fs.existsSync(keystoreProps)) {
      this.checkResult.fail('Android keystore.properties not found');
      allPresent = false;
    } else {
      this.checkResult.pass('Android keystore.properties exists');

      try {
        const propsContent = fs.readFileSync(keystoreProps, 'utf8');
        const requiredProps = [
          'debug.storeFile',
          'debug.storePassword',
          'debug.keyAlias',
          'release.storeFile',
          'release.storePassword',
          'release.keyAlias',
        ];

        const missingProps = requiredProps.filter((prop) => !propsContent.includes(prop));

        if (missingProps.length > 0) {
          this.checkResult.warn(`keystore.properties missing fields: ${missingProps.join(', ')}`);
        }
      } catch (error) {
        this.checkResult.warn(`Could not validate keystore.properties: ${error.message}`);
      }
    }

    if (!allPresent) {
      logger.info('   Run: npm run setup:keystore');
    }

    return allPresent;
  }

  checkIos() {
    logger.info('Checking iOS certificates...');

    if (!this.config || !this.config.clientCode) {
      this.checkResult.warn('Client code not in config, skipping iOS certificates check');
      return true;
    }

    if (!fs.existsSync(this.credentialsDir)) {
      this.checkResult.warn('loyalty-credentials directory not found');
      logger.info('   iOS certificates are stored in loyalty-credentials repository');
      return true;
    }

    const iosClientDir = path.join(this.credentialsDir, 'clients', this.config.clientCode, 'ios');
    const iosSharedDir = path.join(this.credentialsDir, 'certs', 'distribution');

    const requiredEnvVars = [
      'MATCH_GIT_URL',
      'MATCH_PASSWORD',
      'APPLE_TEAM_ID',
      'APP_STORE_CONNECT_API_KEY_ID',
      'APP_STORE_CONNECT_API_ISSUER_ID',
      'APP_STORE_CONNECT_API_KEY',
    ];

    const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      this.checkResult.warn(`iOS certificate environment variables not set: ${missingEnvVars.join(', ')}`);
      logger.info('   Set these variables to enable iOS certificate generation');
    }

    if (!fs.existsSync(iosClientDir)) {
      this.checkResult.fail('iOS certificates directory not found');
      logger.info('   Run: npm run setup:ios');
      return false;
    }

    const profiles = fs.readdirSync(iosClientDir).filter((f) => f.endsWith('.mobileprovision'));

    if (profiles.length === 0) {
      this.checkResult.fail('No iOS provisioning profiles found');
      logger.info('   Run: npm run setup:ios');
      return false;
    }

    this.checkResult.pass(
      `iOS provisioning profiles found (${profiles.length} profile${profiles.length > 1 ? 's' : ''})`
    );

    if (fs.existsSync(iosSharedDir)) {
      const certs = fs
        .readdirSync(iosSharedDir)
        .filter((f) => f.endsWith('.cer') || f.endsWith('.p12'));
      if (certs.length > 0) {
        this.checkResult.pass(
          `iOS distribution certificates found (${certs.length} certificate${certs.length > 1 ? 's' : ''})`
        );
      } else {
        this.checkResult.warn('No iOS distribution certificates found in shared directory');
      }
    }

    return true;
  }

  checkDeployment() {
    logger.info('Checking deployment credentials...');

    let hasIssues = false;

    const googlePlayKey = expandEnvVars(process.env.GOOGLE_PLAY_JSON_KEY);
    if (!googlePlayKey) {
      this.checkResult.info('Google Play API not configured (manual upload required for first release)');
    } else if (!fs.existsSync(path.resolve(googlePlayKey))) {
      this.checkResult.info('Google Play JSON key file not found (configure after first app upload)');
    } else {
      this.checkResult.pass('Google Play credentials configured');
    }

    const appStoreKeyId = process.env.APP_STORE_CONNECT_API_KEY_ID;
    const appStoreIssuerId = process.env.APP_STORE_CONNECT_API_ISSUER_ID;
    const appStoreKeyPath = expandEnvVars(process.env.APP_STORE_CONNECT_API_KEY);

    if (!appStoreKeyId || !appStoreIssuerId) {
      this.checkResult.warn('App Store Connect API credentials not configured (iOS deploy disabled)');
      hasIssues = true;
    } else if (appStoreKeyPath && !fs.existsSync(path.resolve(appStoreKeyPath))) {
      this.checkResult.warn(`App Store Connect API key file not found: ${appStoreKeyPath}`);
      hasIssues = true;
    } else if (appStoreKeyId && appStoreIssuerId) {
      this.checkResult.pass('App Store Connect credentials configured');
    }

    if (!hasIssues) {
      this.checkResult.pass('All deployment credentials configured');
    }

    return !hasIssues;
  }
}

module.exports = CertificateChecker;
