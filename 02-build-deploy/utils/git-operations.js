const logger = require('../../shared/utils/logger');

class GitOperations {
  constructor(gitManager) {
    this.gitManager = gitManager;
  }

  async checkoutBranch(branchName) {
    logger.startSpinner(`Checking out branch: ${branchName}...`);
    try {
      await this.gitManager.git.checkout(branchName);
      await this.gitManager.git.pull('origin', branchName);
      logger.succeedSpinner(`Branch checked out: ${branchName}`);
      return true;
    } catch (error) {
      logger.failSpinner('Failed to checkout branch');
      throw error;
    }
  }

  async checkUncommittedChanges() {
    const status = await this.gitManager.git.status();
    const hasChanges =
      status.modified.length > 0 ||
      status.not_added.length > 0 ||
      status.staged.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0;

    if (hasChanges) {
      const changedFiles = [
        ...status.modified,
        ...status.not_added,
        ...status.staged,
        ...status.created,
        ...status.deleted,
      ];

      logger.error('');
      logger.error('═'.repeat(70));
      logger.error('ERRO: Existem alterações não commitadas no repositório!');
      logger.error('═'.repeat(70));
      logger.error('');
      logger.error('Arquivos modificados:');
      changedFiles.slice(0, 10).forEach((file) => {
        logger.error(`  - ${file}`);
      });
      if (changedFiles.length > 10) {
        logger.error(`  ... e mais ${changedFiles.length - 10} arquivo(s)`);
      }
      logger.error('');
      logger.error('Por favor, commite ou descarte as alterações antes de fazer deploy.');
      logger.error('');
      logger.error('Opções:');
      logger.error('  git stash        # Para guardar temporariamente');
      logger.error('  git commit -am "mensagem"  # Para commitar');
      logger.error('  git checkout .   # Para descartar (CUIDADO!)');
      logger.error('');
      throw new Error('Deploy cancelado: existem alterações não commitadas');
    }

    return false;
  }

  async stashChangesIfNeeded() {
    await this.checkUncommittedChanges();
    return false;
  }

  async checkoutExistingBranch(branchName) {
    await this.stashChangesIfNeeded();

    const branches = await this.gitManager.git.branchLocal();
    const existsLocally = branches.all.includes(branchName);

    if (existsLocally) {
      await this.gitManager.git.checkout(branchName);
    } else {
      await this.gitManager.git.checkout(['-b', branchName, `origin/${branchName}`]);
    }

    try {
      await this.gitManager.git.pull('origin', branchName);
    } catch {
      logger.info('Branch not on remote yet, skipping pull');
    }
    logger.success(`Checked out existing branch: ${branchName}`);
  }

  async createNewDeployBranch(branchName) {
    await this.stashChangesIfNeeded();

    await this.gitManager.git.checkout('main');
    await this.gitManager.git.pull('origin', 'main');
    try {
      await this.gitManager.git.checkoutLocalBranch(branchName);
    } catch {
      await this.gitManager.git.checkout(branchName);
    }
    logger.success(`Created new branch: ${branchName}`);
  }

  async returnToMainBranch(clientCode) {
    const deployBranch = `deploy/${clientCode}`;
    logger.section('Returning to main branch');
    logger.info(`Leaving deploy branch: ${deployBranch}`);

    try {
      await this.gitManager.git.checkout('main');
      logger.success('Switched back to main branch');
      logger.warn('You are now on main branch - deploy branch changes are preserved');
    } catch (error) {
      logger.error(`Failed to return to main: ${error.message}`);
      logger.warn(`You may still be on branch: ${deployBranch}`);
    }
  }

  async createDeployBranch(clientCode) {
    const branchName = `deploy/${clientCode}`;
    logger.section(`Setting up deploy branch: ${branchName}`);

    await this.checkUncommittedChanges();

    try {
      const exists = await this.gitManager.branchExists(branchName);
      if (exists) {
        logger.info('Deploy branch already exists, checking out...');
        await this.checkoutExistingBranch(branchName);
      } else {
        logger.info('Creating new deploy branch from main...');
        await this.createNewDeployBranch(branchName);
      }
      return branchName;
    } catch (error) {
      logger.error(`Failed to setup deploy branch: ${error.message}`);
      throw error;
    }
  }

  async createDeploymentTag(clientName, version, buildNumber) {
    const tagName = `${clientName}/v${version}+${buildNumber}`;
    const message = `Release v${version} build ${buildNumber} for ${clientName}`;
    await this.gitManager.createTag(tagName, message);
    await this.gitManager.pushTag(tagName);
    return tagName;
  }
}

module.exports = GitOperations;
