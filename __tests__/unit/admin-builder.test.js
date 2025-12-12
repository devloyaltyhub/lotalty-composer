/**
 * Tests for 02-build-deploy/admin-builder.js
 */

const path = require('path');
const fs = require('fs');

// Mock dependencies before requiring the module
jest.mock('../../shared/utils/logger', () => ({
  info: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  keyValue: jest.fn(),
  section: jest.fn(),
  blank: jest.fn(),
  summaryBox: jest.fn(),
  startSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
}));

jest.mock('../../shared/utils/telegram', () => ({
  buildStarted: jest.fn().mockResolvedValue(true),
  deploymentCompleted: jest.fn().mockResolvedValue(true),
  error: jest.fn().mockResolvedValue(true),
}));

describe('AdminBuilder', () => {
  let AdminBuilder;

  beforeAll(() => {
    // Set required env vars
    process.env.GOOGLE_PLAY_JSON_KEY = '/fake/path/key.json';
    AdminBuilder = require('../../02-build-deploy/admin-builder');
  });

  describe('module exports', () => {
    test('module exists and exports class', () => {
      expect(AdminBuilder).toBeDefined();
      expect(typeof AdminBuilder).toBe('function');
    });

    test('can instantiate AdminBuilder', () => {
      const builder = new AdminBuilder();
      expect(builder).toBeInstanceOf(AdminBuilder);
    });
  });

  describe('AdminBuilder instance', () => {
    let builder;

    beforeEach(() => {
      builder = new AdminBuilder();
    });

    test('has correct adminRoot path', () => {
      expect(builder.adminRoot).toContain('loyalty-admin-main');
    });

    test('has formatDuration method', () => {
      expect(typeof builder.formatDuration).toBe('function');
    });

    test('formatDuration returns correct format for seconds', () => {
      expect(builder.formatDuration(5000)).toBe('5s');
      expect(builder.formatDuration(30000)).toBe('30s');
    });

    test('formatDuration returns correct format for minutes', () => {
      expect(builder.formatDuration(60000)).toBe('1m 0s');
      expect(builder.formatDuration(90000)).toBe('1m 30s');
      expect(builder.formatDuration(125000)).toBe('2m 5s');
    });

    test('has exec method', () => {
      expect(typeof builder.exec).toBe('function');
    });

    test('has checkPrerequisites method', () => {
      expect(typeof builder.checkPrerequisites).toBe('function');
    });

    test('has getVersionInfo method', () => {
      expect(typeof builder.getVersionInfo).toBe('function');
    });

    test('has setVersion method', () => {
      expect(typeof builder.setVersion).toBe('function');
    });

    test('has incrementBuildNumber method', () => {
      expect(typeof builder.incrementBuildNumber).toBe('function');
    });

    test('has buildAndroid method', () => {
      expect(typeof builder.buildAndroid).toBe('function');
    });

    test('has deployAndroid method', () => {
      expect(typeof builder.deployAndroid).toBe('function');
    });

    test('has buildAndDeploy method', () => {
      expect(typeof builder.buildAndDeploy).toBe('function');
    });
  });

  describe('version validation', () => {
    let builder;

    beforeEach(() => {
      builder = new AdminBuilder();
    });

    test('setVersion rejects invalid format', () => {
      expect(() => builder.setVersion('invalid')).toThrow('Invalid version format');
      expect(() => builder.setVersion('1.0.0')).toThrow('Invalid version format');
      expect(() => builder.setVersion('1.0+5')).toThrow('Invalid version format');
    });
  });
});

describe('deploy-admin CLI', () => {
  test('script file exists', () => {
    const scriptPath = require.resolve('../../02-build-deploy/cli/deploy-admin');
    expect(scriptPath).toBeDefined();
  });
});
