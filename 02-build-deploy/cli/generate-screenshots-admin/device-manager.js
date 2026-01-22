const { execSync, spawn } = require('child_process');
const inquirer = require('inquirer');
const logger = require('../../../shared/utils/logger');

class DeviceManager {
  constructor(adminRoot) {
    this.adminRoot = adminRoot;
  }

  exec(command, options = {}) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.adminRoot,
        ...options,
      }).trim();
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  getAndroidDevices() {
    try {
      const output = this.exec('flutter devices --machine', { silent: true });
      const devices = JSON.parse(output);

      return devices.filter((d) =>
        d.platform === 'android-x64' ||
        d.platform === 'android' ||
        d.platform === 'android-arm' ||
        d.platform === 'android-arm64'
      );
    } catch (error) {
      logger.warn('Erro ao listar dispositivos Android');
      return [];
    }
  }

  checkAdbDevices() {
    try {
      const output = this.exec('adb devices', { silent: true });
      const lines = output.split('\n').filter(line =>
        line.trim() &&
        !line.includes('List of devices') &&
        line.includes('device')
      );
      return lines.length > 0;
    } catch (error) {
      return false;
    }
  }

  getAvailableEmulators() {
    try {
      const output = this.exec('flutter emulators', { silent: true });
      const lines = output.split('\n');

      const emulators = [];
      let parsingData = false;

      for (const line of lines) {
        if (line.includes('Id') && line.includes('Name') && line.includes('Platform')) {
          parsingData = true;
          continue;
        }

        if (line.includes('To run an emulator') || line.includes('To create a new emulator')) {
          break;
        }

        if (parsingData && line.includes('•')) {
          const parts = line.split('•').map(p => p.trim());
          if (parts.length >= 4) {
            const [id, name, manufacturer, platform] = parts;
            if (platform === 'android' && id && name) {
              emulators.push({ id, name, manufacturer, platform });
            }
          }
        }
      }

      return emulators;
    } catch (error) {
      logger.warn('Erro ao listar emuladores');
      return [];
    }
  }

  async launchEmulator(emulatorId) {
    logger.startSpinner(`Iniciando emulador ${emulatorId}...`);

    try {
      const emulatorProcess = spawn('flutter', ['emulators', '--launch', emulatorId], {
        detached: true,
        stdio: 'ignore',
      });
      emulatorProcess.unref();

      logger.succeedSpinner(`Comando de inicializacao enviado para ${emulatorId}`);
      logger.startSpinner('Aguardando emulador inicializar (isso pode levar 1-2 minutos)...');

      let attempts = 0;
      const maxAttempts = 120;
      let lastDeviceCount = 0;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const devices = this.getAndroidDevices();
        const adbHasDevices = this.checkAdbDevices();

        if (attempts % 10 === 0 && attempts > 0) {
          logger.updateSpinner(`Aguardando emulador... (${attempts}s/${maxAttempts}s)`);
        }

        if (devices.length > 0 || adbHasDevices) {
          if (lastDeviceCount === 0) {
            logger.updateSpinner('Dispositivo detectado, verificando se esta pronto...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
          lastDeviceCount = devices.length;

          const finalDevices = this.getAndroidDevices();
          if (finalDevices.length > 0) {
            logger.succeedSpinner(`Emulador pronto! (${attempts}s)`);
            return true;
          }
        }

        attempts++;
      }

      logger.failSpinner(`Timeout esperando emulador inicializar (${maxAttempts}s)`);
      logger.warn('Tente iniciar o emulador manualmente e execute o script novamente.');
      return false;
    } catch (error) {
      logger.failSpinner('Falha ao iniciar emulador');
      throw error;
    }
  }

  async detectDevices() {
    logger.startSpinner('Detectando dispositivos Android...');

    let devices = this.getAndroidDevices();

    if (devices.length === 0) {
      logger.failSpinner('Nenhum dispositivo Android encontrado');

      logger.info('Procurando emuladores disponiveis...');
      const emulators = this.getAvailableEmulators();

      if (emulators.length === 0) {
        throw new Error(
          'Nenhum emulador Android disponivel.\n' +
            'Crie um emulador usando Android Studio ou execute:\n' +
            '  flutter emulators --create'
        );
      }

      logger.info(`Encontrados ${emulators.length} emuladores Android:`);
      emulators.forEach(e => {
        logger.keyValue(`  ${e.name}`, e.id, 2);
      });
      logger.blank();

      let selectedEmulator = emulators.find(e =>
        e.name.toLowerCase().includes('pixel') &&
        !e.name.toLowerCase().includes('tablet')
      ) || emulators[0];

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Deseja iniciar o emulador ${selectedEmulator.name}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        throw new Error('Operacao cancelada. Inicie um emulador manualmente e execute o script novamente.');
      }

      const launched = await this.launchEmulator(selectedEmulator.id);

      if (!launched) {
        throw new Error('Falha ao iniciar emulador. Tente iniciar manualmente.');
      }

      devices = this.getAndroidDevices();

      if (devices.length === 0) {
        throw new Error('Falha ao detectar emulador apos inicializacao.');
      }
    } else {
      logger.succeedSpinner(`Encontrados ${devices.length} dispositivos Android`);
    }

    const phones = devices.filter(
      (d) =>
        d.name.toLowerCase().includes('phone') ||
        d.name.toLowerCase().includes('pixel') ||
        (!d.name.toLowerCase().includes('tablet') && !d.name.toLowerCase().includes('pad'))
    );

    const tablets = devices.filter(
      (d) => d.name.toLowerCase().includes('tablet') || d.name.toLowerCase().includes('pad')
    );

    return { phones, tablets, all: devices };
  }

  async selectDevices(phoneDeviceArg, tabletDeviceArg) {
    const { phones, tablets, all } = await this.detectDevices();

    logger.blank();
    logger.info('Dispositivos disponiveis:');
    all.forEach((d, i) => {
      const type = phones.includes(d) ? 'Phone' : 'Tablet';
      logger.keyValue(`  ${i + 1}. ${type}`, d.name);
    });
    logger.blank();

    let phoneDevice = phoneDeviceArg;
    if (!phoneDevice) {
      if (phones.length === 0) {
        logger.warn('Nenhum phone Android detectado. Usando primeiro dispositivo disponivel.');
        phoneDevice = all[0].id;
      } else if (phones.length === 1) {
        phoneDevice = phones[0].id;
        logger.info(`Phone selecionado automaticamente: ${phones[0].name}`);
      } else {
        const { selectedPhone } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedPhone',
            message: 'Selecione o dispositivo PHONE para screenshots:',
            choices: phones.map((d) => ({ name: d.name, value: d.id })),
          },
        ]);
        phoneDevice = selectedPhone;
      }
    }

    let tabletDevice = tabletDeviceArg;
    if (!tabletDevice && tablets.length > 0) {
      const { useTablet } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useTablet',
          message: 'Deseja tambem gerar screenshots para TABLET?',
          default: true,
        },
      ]);

      if (useTablet) {
        if (tablets.length === 1) {
          tabletDevice = tablets[0].id;
          logger.info(`Tablet selecionado automaticamente: ${tablets[0].name}`);
        } else {
          const { selectedTablet } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedTablet',
              message: 'Selecione o dispositivo TABLET para screenshots:',
              choices: tablets.map((d) => ({ name: d.name, value: d.id })),
            },
          ]);
          tabletDevice = selectedTablet;
        }
      }
    }

    return { phoneDevice, tabletDevice };
  }
}

module.exports = DeviceManager;
