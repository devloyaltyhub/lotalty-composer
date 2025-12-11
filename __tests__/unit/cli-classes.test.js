/**
 * Tests for cli/classes.js
 * Tests ConfigManager, WorkflowEngine, CommandRunner, MenuRenderer, LoyaltyCLI
 */

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('chalk', () => {
  const mockFn = (str) => str;
  return {
    bold: {
      cyan: jest.fn(mockFn),
      white: jest.fn(mockFn),
      yellow: jest.fn(mockFn),
    },
    cyan: jest.fn(mockFn),
    green: Object.assign(jest.fn(mockFn), { bold: jest.fn(mockFn) }),
    yellow: jest.fn(mockFn),
    red: jest.fn(mockFn),
    gray: jest.fn(mockFn),
    white: jest.fn(mockFn),
  };
});

jest.mock('boxen', () => jest.fn((content) => `[BOX: ${content}]`));

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
  Separator: class Separator {
    constructor(text) {
      this.text = text;
      this.type = 'separator';
    }
  },
}));

jest.mock('../../cli/config', () => ({
  SCRIPTS: {
    CREATE_CLIENT: {
      name: 'Create Client',
      description: 'Create a new client',
      category: 'CLIENT_OPS',
      script: 'test-script.js',
    },
    BUILD_APP: {
      name: 'Build App',
      description: 'Build the app',
      category: 'BUILD',
      script: 'build.js',
      args: ['--prod'],
    },
  },
  WORKFLOWS: {
    COMPLETE_SETUP: {
      name: 'Complete Setup',
      description: 'Full setup workflow',
      category: 'WORKFLOWS',
      steps: [
        { action: 'create', script: { name: 'Create', description: 'Create', script: 'create.js' } },
        { action: 'build', script: { name: 'Build', description: 'Build', script: 'build.js' } },
      ],
    },
    CRITICAL_WORKFLOW: {
      name: 'Critical Workflow',
      description: 'Needs confirmation',
      category: 'WORKFLOWS',
      confirmStart: true,
      steps: [{ action: 'critical', script: { name: 'Critical', description: 'Critical', script: 'critical.js' } }],
    },
  },
}));

const fs = require('fs');
const { spawn } = require('child_process');
const inquirer = require('inquirer');
const {
  ConfigManager,
  WorkflowEngine,
  CommandRunner,
  MenuRenderer,
  LoyaltyCLI,
} = require('../../cli/classes');

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and loadConfig()', () => {
    test('loads config from file if exists', () => {
      const mockConfig = { lastClient: 'demo', favoriteWorkflows: ['test'] };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const manager = new ConfigManager();

      expect(manager.config).toEqual(mockConfig);
    });

    test('returns defaults if file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const manager = new ConfigManager();

      expect(manager.config).toEqual({
        lastClient: null,
        favoriteWorkflows: [],
      });
    });

    test('returns defaults on read error', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const manager = new ConfigManager();

      expect(manager.config).toEqual({
        lastClient: null,
        favoriteWorkflows: [],
      });
    });

    test('returns defaults on JSON parse error', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      const manager = new ConfigManager();

      expect(manager.config).toEqual({
        lastClient: null,
        favoriteWorkflows: [],
      });
    });
  });

  describe('saveConfig()', () => {
    test('writes config to file', () => {
      fs.existsSync.mockReturnValue(false);
      const manager = new ConfigManager();
      manager.config = { lastClient: 'test', favoriteWorkflows: [] };

      manager.saveConfig();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.loyalty-cli-config.json'),
        JSON.stringify({ lastClient: 'test', favoriteWorkflows: [] }, null, 2)
      );
    });

    test('ignores write errors', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      const manager = new ConfigManager();

      expect(() => manager.saveConfig()).not.toThrow();
    });
  });

  describe('setLastClient()', () => {
    test('sets and saves last client', () => {
      fs.existsSync.mockReturnValue(false);
      const manager = new ConfigManager();

      manager.setLastClient('demo-client');

      expect(manager.config.lastClient).toBe('demo-client');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('getLastClient()', () => {
    test('returns last client', () => {
      fs.existsSync.mockReturnValue(false);
      const manager = new ConfigManager();
      manager.config.lastClient = 'my-client';

      expect(manager.getLastClient()).toBe('my-client');
    });
  });
});

describe('WorkflowEngine', () => {
  let mockConfigManager;
  let mockChild;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigManager = { setLastClient: jest.fn(), getLastClient: jest.fn() };

    mockChild = {
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          mockChild._closeCallback = callback;
        } else if (event === 'error') {
          mockChild._errorCallback = callback;
        }
        return mockChild;
      }),
    };
    spawn.mockReturnValue(mockChild);
  });

  describe('constructor', () => {
    test('initializes with workflow and config manager', () => {
      const workflow = { name: 'Test', steps: [] };
      const engine = new WorkflowEngine(workflow, mockConfigManager);

      expect(engine.workflow).toBe(workflow);
      expect(engine.configManager).toBe(mockConfigManager);
      expect(engine.currentStep).toBe(0);
    });
  });

  describe('formatDuration()', () => {
    test('formats seconds only', () => {
      const engine = new WorkflowEngine({ steps: [] }, mockConfigManager);

      expect(engine.formatDuration(5000)).toBe('5s');
      expect(engine.formatDuration(45000)).toBe('45s');
    });

    test('formats minutes and seconds', () => {
      const engine = new WorkflowEngine({ steps: [] }, mockConfigManager);

      expect(engine.formatDuration(65000)).toBe('1m 5s');
      expect(engine.formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('execute()', () => {
    test('executes workflow steps', async () => {
      const workflow = {
        name: 'Test Workflow',
        description: 'Test description',
        steps: [
          { action: 'step1', script: { name: 'Step 1', description: 'First', script: 'step1.js' } },
        ],
      };
      const engine = new WorkflowEngine(workflow, mockConfigManager);

      const executePromise = engine.execute();

      // Wait for spawn to be called
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(0);

      const result = await executePromise;
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalled();
    });

    test('cancels workflow when confirmation rejected', async () => {
      const workflow = {
        name: 'Critical Workflow',
        description: 'Critical',
        confirmStart: true,
        steps: [],
      };
      inquirer.prompt.mockResolvedValueOnce({ confirmed: false });

      const engine = new WorkflowEngine(workflow, mockConfigManager);
      const result = await engine.execute();

      expect(result).toBe(false);
    });

    test('proceeds when confirmation accepted', async () => {
      const workflow = {
        name: 'Critical Workflow',
        description: 'Critical',
        confirmStart: true,
        steps: [
          { action: 'step1', script: { name: 'Step 1', description: 'First', script: 'step1.js' } },
        ],
      };
      inquirer.prompt.mockResolvedValueOnce({ confirmed: true });

      const engine = new WorkflowEngine(workflow, mockConfigManager);
      const executePromise = engine.execute();

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(0);

      const result = await executePromise;
      expect(result).toBe(true);
    });

    test('skips optional step when user declines', async () => {
      const workflow = {
        name: 'Test Workflow',
        description: 'Test',
        steps: [
          { action: 'step1', script: { name: 'Step 1', description: 'First', script: 'step1.js' }, optional: true },
        ],
      };
      inquirer.prompt.mockResolvedValueOnce({ shouldRun: false });

      const engine = new WorkflowEngine(workflow, mockConfigManager);
      const result = await engine.execute();

      expect(result).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
    });

    test('aborts workflow on error and user chooses abort', async () => {
      const workflow = {
        name: 'Test Workflow',
        description: 'Test',
        steps: [
          { action: 'step1', script: { name: 'Step 1', description: 'First', script: 'step1.js' } },
        ],
      };
      inquirer.prompt.mockResolvedValueOnce({ action: 'abort' });

      const engine = new WorkflowEngine(workflow, mockConfigManager);
      const executePromise = engine.execute();

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(1); // Fail

      const result = await executePromise;
      expect(result).toBe(false);
    });
  });

  describe('runScript()', () => {
    test('runs script with spawn', async () => {
      const engine = new WorkflowEngine({ steps: [] }, mockConfigManager);
      const scriptConfig = { script: 'test.js', args: ['--arg1'] };

      const runPromise = engine.runScript(scriptConfig);

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(0);

      await runPromise;

      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.stringContaining('test.js'), '--arg1'],
        expect.objectContaining({ stdio: 'inherit' })
      );
    });

    test('rejects on non-zero exit code', async () => {
      const engine = new WorkflowEngine({ steps: [] }, mockConfigManager);
      const scriptConfig = { script: 'test.js' };

      const runPromise = engine.runScript(scriptConfig);

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(1);

      await expect(runPromise).rejects.toThrow('Script exited with code 1');
    });

    test('rejects on spawn error', async () => {
      const engine = new WorkflowEngine({ steps: [] }, mockConfigManager);
      const scriptConfig = { script: 'test.js' };

      const runPromise = engine.runScript(scriptConfig);

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._errorCallback(new Error('Spawn failed'));

      await expect(runPromise).rejects.toThrow('Spawn failed');
    });

    test('sets SKIP_PREFLIGHT_CHECK when preflight ran in previous step', async () => {
      const workflow = {
        steps: [
          { script: { script: 'shared/utils/preflight-check.js' } },
          { script: { script: 'other.js' } },
        ],
      };
      const engine = new WorkflowEngine(workflow, mockConfigManager);
      engine.currentStep = 2;

      const runPromise = engine.runScript({ script: 'test.js' });

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(0);

      await runPromise;

      expect(spawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ SKIP_PREFLIGHT_CHECK: '1' }),
        })
      );
    });
  });
});

describe('CommandRunner', () => {
  let mockConfigManager;
  let mockChild;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigManager = {};

    mockChild = {
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          mockChild._closeCallback = callback;
        } else if (event === 'error') {
          mockChild._errorCallback = callback;
        }
        return mockChild;
      }),
    };
    spawn.mockReturnValue(mockChild);
  });

  describe('constructor', () => {
    test('initializes with config manager', () => {
      const runner = new CommandRunner(mockConfigManager);

      expect(runner.configManager).toBe(mockConfigManager);
      expect(runner.automationDir).toContain('loyalty-compose');
    });
  });

  describe('runScript()', () => {
    test('runs script and resolves on success', async () => {
      const runner = new CommandRunner(mockConfigManager);
      const scriptConfig = { name: 'Test', description: 'Test script', script: 'test.js' };

      const runPromise = runner.runScript(scriptConfig);

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(0);

      await runPromise;

      expect(spawn).toHaveBeenCalled();
    });

    test('rejects on non-zero exit code', async () => {
      const runner = new CommandRunner(mockConfigManager);
      const scriptConfig = { name: 'Test', description: 'Test script', script: 'test.js' };

      const runPromise = runner.runScript(scriptConfig);

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(1);

      await expect(runPromise).rejects.toThrow('Script falhou com código 1');
    });

    test('rejects on spawn error', async () => {
      const runner = new CommandRunner(mockConfigManager);
      const scriptConfig = { name: 'Test', description: 'Test script', script: 'test.js' };

      const runPromise = runner.runScript(scriptConfig);

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._errorCallback(new Error('Cannot spawn'));

      await expect(runPromise).rejects.toThrow('Cannot spawn');
    });

    test('passes args to spawn', async () => {
      const runner = new CommandRunner(mockConfigManager);
      const scriptConfig = {
        name: 'Test',
        description: 'Test script',
        script: 'test.js',
        args: ['--flag', 'value'],
      };

      const runPromise = runner.runScript(scriptConfig);

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockChild._closeCallback(0);

      await runPromise;

      expect(spawn).toHaveBeenCalledWith(
        'node',
        [expect.stringContaining('test.js'), '--flag', 'value'],
        expect.any(Object)
      );
    });
  });

  describe('formatDuration()', () => {
    test('formats duration correctly', () => {
      const runner = new CommandRunner(mockConfigManager);

      expect(runner.formatDuration(30000)).toBe('30s');
      expect(runner.formatDuration(90000)).toBe('1m 30s');
    });
  });
});

describe('MenuRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.clear = jest.fn();
    console.log = jest.fn();
  });

  describe('printHeader()', () => {
    test('clears console and prints header', () => {
      const renderer = new MenuRenderer();

      renderer.printHeader();

      expect(console.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('groupByCategory()', () => {
    test('groups items by category', () => {
      const renderer = new MenuRenderer();
      const items = {
        item1: { name: 'Item 1', category: 'A' },
        item2: { name: 'Item 2', category: 'B' },
        item3: { name: 'Item 3', category: 'A' },
      };

      const grouped = renderer.groupByCategory(items);

      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(1);
    });
  });

  describe('createMenuChoices()', () => {
    test('creates menu choices with separators', () => {
      const renderer = new MenuRenderer();
      const items = {
        item1: { name: 'Item 1', category: 'Category A', description: 'Desc 1' },
        item2: { name: 'Item 2', category: 'Category A', description: 'Desc 2' },
      };

      const choices = renderer.createMenuChoices(items, 'script');

      // Should have separator + 2 items + trailing separator
      const separators = choices.filter((c) => c.type === 'separator');
      const actualChoices = choices.filter((c) => c.value);

      expect(separators.length).toBe(2);
      expect(actualChoices.length).toBe(2);
    });

    test('uses different prefix for workflows', () => {
      const renderer = new MenuRenderer();
      const items = {
        item1: { name: 'Item 1', category: 'Cat', description: 'Desc' },
      };

      const choices = renderer.createMenuChoices(items, 'workflow');
      const itemChoice = choices.find((c) => c.value);

      expect(itemChoice.name).toContain('▶');
    });

    test('uses different prefix for scripts', () => {
      const renderer = new MenuRenderer();
      const items = {
        item1: { name: 'Item 1', category: 'Cat', description: 'Desc' },
      };

      const choices = renderer.createMenuChoices(items, 'script');
      const itemChoice = choices.find((c) => c.value);

      expect(itemChoice.name).toContain('›');
    });
  });
});

describe('LoyaltyCLI', () => {
  let cli;
  let mockChild;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(false);
    console.clear = jest.fn();
    console.log = jest.fn();
    console.error = jest.fn();

    mockChild = {
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          mockChild._closeCallback = callback;
        } else if (event === 'error') {
          mockChild._errorCallback = callback;
        }
        return mockChild;
      }),
    };
    spawn.mockReturnValue(mockChild);

    cli = new LoyaltyCLI();
  });

  describe('constructor', () => {
    test('initializes components', () => {
      expect(cli.configManager).toBeInstanceOf(ConfigManager);
      expect(cli.commandRunner).toBeInstanceOf(CommandRunner);
      expect(cli.menuRenderer).toBeInstanceOf(MenuRenderer);
    });
  });

  describe('showMainMenu()', () => {
    test('shows menu and returns selection', async () => {
      const mockSelection = { name: 'Test', steps: [] };
      inquirer.prompt.mockResolvedValueOnce({ selection: mockSelection });

      const result = await cli.showMainMenu();

      expect(result).toBe(mockSelection);
      expect(inquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('showIndividualScriptsMenu()', () => {
    test('shows individual scripts menu', async () => {
      const mockScript = { name: 'Test Script', script: 'test.js' };
      inquirer.prompt.mockResolvedValueOnce({ selection: mockScript });

      const result = await cli.showIndividualScriptsMenu();

      expect(result).toBe(mockScript);
    });
  });

  describe('handleSelection()', () => {
    test('exits on EXIT selection', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit called');
      });

      await expect(cli.handleSelection('EXIT')).rejects.toThrow('exit called');

      expect(mockExit).toHaveBeenCalledWith(0);
      mockExit.mockRestore();
    });

    test('returns to main menu on BACK from individual menu', async () => {
      inquirer.prompt.mockResolvedValue({ selection: 'BACK' });

      const result = await cli.handleSelection('INDIVIDUAL');

      expect(result).toBe(true);
    });
  });

  describe('promptContinue()', () => {
    test('prompts user and returns result', async () => {
      inquirer.prompt.mockResolvedValue({ shouldContinue: true });

      const result = await cli.promptContinue();

      expect(result).toBe(true);
      expect(inquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('handleDirectCommand()', () => {
    test('lists available commands with --list', async () => {
      await cli.handleDirectCommand(['node', 'cli', '--list']);

      expect(console.log).toHaveBeenCalled();
    });

    test('lists available commands with -l', async () => {
      await cli.handleDirectCommand(['node', 'cli', '-l']);

      expect(console.log).toHaveBeenCalled();
    });

    test('exits with error for unknown workflow', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        cli.handleDirectCommand(['node', 'cli', 'workflow', 'unknown-workflow'])
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    test('exits with error for unknown script', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(
        cli.handleDirectCommand(['node', 'cli', 'unknown-script'])
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });
});
