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

  async ensureOnMainBranch() {
    logger.section('Verificando branch');

    await this.checkUncommittedChanges();

    const currentBranch = (await this.gitManager.git.branchLocal()).current;
    if (currentBranch !== 'main') {
      logger.info(`Branch atual: ${currentBranch}. Mudando para main...`);
      await this.gitManager.git.checkout('main');
    }

    await this.gitManager.git.pull('origin', 'main');
    logger.success('Na branch main, atualizada com remote');
    return 'main';
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
