/**
 * Tests for cli/index.js
 * Tests barrel export for CLI module
 */

describe('CLI Index - Barrel Export', () => {
  let cliModule;

  beforeAll(() => {
    // Reset modules to get fresh import
    jest.resetModules();

    // Mock dependencies
    jest.mock('fs', () => ({
      existsSync: jest.fn(() => false),
      readFileSync: jest.fn(),
      writeFileSync: jest.fn(),
    }));

    jest.mock('child_process', () => ({
      spawn: jest.fn(),
    }));

    jest.mock('chalk', () => ({
      bold: { cyan: jest.fn((s) => s), white: jest.fn((s) => s), yellow: jest.fn((s) => s) },
      cyan: jest.fn((s) => s),
      green: jest.fn((s) => s),
      yellow: jest.fn((s) => s),
      red: jest.fn((s) => s),
      gray: jest.fn((s) => s),
    }));

    jest.mock('boxen', () => jest.fn((s) => s));

    jest.mock('inquirer', () => ({
      prompt: jest.fn(),
      Separator: class {},
    }));

    cliModule = require('../../cli/index');
  });

  describe('constants exports', () => {
    test('exports CATEGORIES', () => {
      expect(cliModule).toHaveProperty('CATEGORIES');
      expect(typeof cliModule.CATEGORIES).toBe('object');
    });
  });

  describe('configuration exports', () => {
    test('exports SCRIPTS', () => {
      expect(cliModule).toHaveProperty('SCRIPTS');
      expect(typeof cliModule.SCRIPTS).toBe('object');
    });

    test('exports WORKFLOWS', () => {
      expect(cliModule).toHaveProperty('WORKFLOWS');
      expect(typeof cliModule.WORKFLOWS).toBe('object');
    });
  });

  describe('class exports', () => {
    test('exports ConfigManager class', () => {
      expect(cliModule).toHaveProperty('ConfigManager');
      expect(typeof cliModule.ConfigManager).toBe('function');
    });

    test('exports WorkflowEngine class', () => {
      expect(cliModule).toHaveProperty('WorkflowEngine');
      expect(typeof cliModule.WorkflowEngine).toBe('function');
    });

    test('exports CommandRunner class', () => {
      expect(cliModule).toHaveProperty('CommandRunner');
      expect(typeof cliModule.CommandRunner).toBe('function');
    });

    test('exports MenuRenderer class', () => {
      expect(cliModule).toHaveProperty('MenuRenderer');
      expect(typeof cliModule.MenuRenderer).toBe('function');
    });

    test('exports LoyaltyCLI class', () => {
      expect(cliModule).toHaveProperty('LoyaltyCLI');
      expect(typeof cliModule.LoyaltyCLI).toBe('function');
    });
  });

  describe('class instantiation', () => {
    test('ConfigManager can be instantiated', () => {
      const instance = new cliModule.ConfigManager();
      expect(instance).toBeDefined();
    });

    test('MenuRenderer can be instantiated', () => {
      const instance = new cliModule.MenuRenderer();
      expect(instance).toBeDefined();
    });

    test('CommandRunner can be instantiated', () => {
      const configManager = new cliModule.ConfigManager();
      const instance = new cliModule.CommandRunner(configManager);
      expect(instance).toBeDefined();
    });

    test('WorkflowEngine can be instantiated', () => {
      const configManager = new cliModule.ConfigManager();
      const workflow = { name: 'Test', steps: [] };
      const instance = new cliModule.WorkflowEngine(workflow, configManager);
      expect(instance).toBeDefined();
    });

    test('LoyaltyCLI can be instantiated', () => {
      const instance = new cliModule.LoyaltyCLI();
      expect(instance).toBeDefined();
    });
  });

  describe('export completeness', () => {
    test('exports all expected properties', () => {
      const expectedExports = [
        'CATEGORIES',
        'SCRIPTS',
        'WORKFLOWS',
        'ConfigManager',
        'WorkflowEngine',
        'CommandRunner',
        'MenuRenderer',
        'LoyaltyCLI',
      ];

      expectedExports.forEach((exportName) => {
        expect(cliModule).toHaveProperty(exportName);
      });
    });

    test('does not export unexpected properties', () => {
      const expectedExports = [
        'CATEGORIES',
        'SCRIPTS',
        'WORKFLOWS',
        'ConfigManager',
        'WorkflowEngine',
        'CommandRunner',
        'MenuRenderer',
        'LoyaltyCLI',
      ];

      const actualExports = Object.keys(cliModule);

      actualExports.forEach((exportName) => {
        expect(expectedExports).toContain(exportName);
      });
    });
  });
});
