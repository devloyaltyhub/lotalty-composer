const fs = require('fs-extra');
const path = require('path');
const logger = require('../../shared/utils/logger');

class AdminWebBuildOperations {
  constructor(adminRoot, buildOutput, execFn) {
    this.adminRoot = adminRoot;
    this.buildOutput = buildOutput;
    this.exec = execFn;
  }

  getVersionInfo() {
    const pubspecPath = path.join(this.adminRoot, 'pubspec.yaml');
    const pubspec = fs.readFileSync(pubspecPath, 'utf8');
    const match = pubspec.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/m);

    if (!match) {
      throw new Error('Version not found in pubspec.yaml');
    }

    return {
      version: match[1],
      buildNumber: match[2],
      full: `${match[1]}+${match[2]}`,
    };
  }

  incrementBuildNumber() {
    logger.info('Incrementing build number...');

    const pubspecPath = path.join(this.adminRoot, 'pubspec.yaml');
    let pubspec = fs.readFileSync(pubspecPath, 'utf8');
    const match = pubspec.match(/^(version:\s*[0-9]+\.[0-9]+\.[0-9]+\+)([0-9]+)/m);

    if (!match) {
      throw new Error('Version not found in pubspec.yaml');
    }

    const currentBuild = parseInt(match[2], 10);
    const newBuild = currentBuild + 1;

    pubspec = pubspec.replace(/^(version:\s*[0-9]+\.[0-9]+\.[0-9]+\+)[0-9]+/m, `$1${newBuild}`);

    fs.writeFileSync(pubspecPath, pubspec);
    logger.success(`Build number incremented: ${currentBuild} -> ${newBuild}`);

    return newBuild;
  }

  getDartDefines() {
    const defines = [];

    if (process.env.MASTER_FIREBASE_EMAIL) {
      defines.push(`--dart-define=MASTER_FIREBASE_EMAIL=${process.env.MASTER_FIREBASE_EMAIL}`);
      logger.info('MASTER_FIREBASE_EMAIL loaded from environment');
    } else {
      logger.warn('MASTER_FIREBASE_EMAIL not set - admin login may fail');
    }

    if (process.env.MASTER_FIREBASE_PASSWORD) {
      defines.push(`--dart-define=MASTER_FIREBASE_PASSWORD=${process.env.MASTER_FIREBASE_PASSWORD}`);
      logger.info('MASTER_FIREBASE_PASSWORD loaded from environment');
    } else {
      logger.warn('MASTER_FIREBASE_PASSWORD not set - admin login will fail');
    }

    return defines.length > 0 ? ' ' + defines.join(' ') : '';
  }

  buildWeb() {
    logger.info('Building Flutter Web...');

    const strayGit = path.join(this.buildOutput, '.git');
    if (fs.existsSync(strayGit)) {
      logger.warn('Found stray .git in build/web - removing to prevent build corruption');
      fs.removeSync(strayGit);
    }

    logger.info('Cleaning previous build...');
    this.exec('flutter clean');

    logger.info('Getting dependencies...');
    this.exec('flutter pub get');

    logger.info('Building web release...');
    const dartDefines = this.getDartDefines();
    this.exec(
      `flutter build web --release --base-href "/" --no-source-maps --pwa-strategy none${dartDefines}`
    );

    if (!fs.existsSync(this.buildOutput)) {
      throw new Error(`Build output not found at ${this.buildOutput}`);
    }

    const indexPath = path.join(this.buildOutput, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error('index.html not found in build output');
    }

    this.injectCacheBusting(indexPath);

    logger.success('Flutter Web build completed');
    return true;
  }

  injectCacheBusting(indexPath) {
    logger.info('Injecting cache-busting version...');

    const version = Date.now();
    let html = fs.readFileSync(indexPath, 'utf8');

    html = html.replace('src="flutter_bootstrap.js"', `src="flutter_bootstrap.js?v=${version}"`);

    html = html.replace('href="manifest.json"', `href="manifest.json?v=${version}"`);

    fs.writeFileSync(indexPath, html);
    logger.success(`Cache-busting version: ${version}`);
  }
}

module.exports = AdminWebBuildOperations;
