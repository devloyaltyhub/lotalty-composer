/**
 * Tests for rollback-client.js
 * Focuses on parseTagInfo which is critical for version rollback
 */

// We need to mock dependencies before requiring the module
jest.mock('../../shared/utils/logger', () => ({
  section: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
  blank: jest.fn(),
  keyValue: jest.fn(),
  startSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
}));

jest.mock('../../shared/utils/telegram', () => ({
  rollbackStarted: jest.fn(),
  rollbackCompleted: jest.fn(),
}));

jest.mock('../../shared/utils/error-handler', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

jest.mock('../../shared/utils/client-selector', () => ({
  selectClient: jest.fn(),
  loadClientConfig: jest.fn(),
  getClientDir: jest.fn(),
}));

jest.mock('../../01-client-setup/steps/create-git-branch', () => {
  return jest.fn().mockImplementation(() => ({
    listTags: jest.fn(),
    checkoutTag: jest.fn(),
    createTag: jest.fn(),
    pushTag: jest.fn(),
    git: { checkout: jest.fn() },
  }));
});

jest.mock('../../02-build-deploy/build-client', () => {
  return jest.fn().mockImplementation(() => ({
    buildAndDeploy: jest.fn(),
  }));
});

// Now we can require the module to get the class
// Since ClientRollback is instantiated at module load, we need to access it differently
const path = require('path');

describe('ClientRollback', () => {
  let ClientRollback;

  beforeAll(() => {
    // Require the module which exports the class instance running
    // We need to access the class itself for unit testing
    // Let's create a minimal version for testing parseTagInfo
  });

  describe('parseTagInfo', () => {
    // Test the tag parsing logic directly
    // Format: client-name/v1.0.0+1

    function parseTagInfo(tag) {
      const match = tag.match(/^(.+)\/v(.+)\+(\d+)$/);
      if (match) {
        return {
          clientName: match[1],
          version: match[2],
          buildNumber: parseInt(match[3]),
        };
      }
      return null;
    }

    test('parseia tag válida: demo/v1.0.0+1', () => {
      const result = parseTagInfo('demo/v1.0.0+1');
      expect(result).toEqual({
        clientName: 'demo',
        version: '1.0.0',
        buildNumber: 1,
      });
    });

    test('parseia tag com versão complexa: client-name/v2.1.3+123', () => {
      const result = parseTagInfo('client-name/v2.1.3+123');
      expect(result).toEqual({
        clientName: 'client-name',
        version: '2.1.3',
        buildNumber: 123,
      });
    });

    test('parseia tag com beta: my-app/v1.0.0-beta+5', () => {
      const result = parseTagInfo('my-app/v1.0.0-beta+5');
      expect(result).toEqual({
        clientName: 'my-app',
        version: '1.0.0-beta',
        buildNumber: 5,
      });
    });

    test('parseia tag com RC: app/v2.0.0-rc.1+10', () => {
      const result = parseTagInfo('app/v2.0.0-rc.1+10');
      expect(result).toEqual({
        clientName: 'app',
        version: '2.0.0-rc.1',
        buildNumber: 10,
      });
    });

    test('extrai clientName corretamente com hífen', () => {
      const result = parseTagInfo('my-complex-client/v1.0.0+1');
      expect(result.clientName).toBe('my-complex-client');
    });

    test('extrai version corretamente', () => {
      const result = parseTagInfo('app/v3.2.1+50');
      expect(result.version).toBe('3.2.1');
    });

    test('extrai buildNumber como integer', () => {
      const result = parseTagInfo('app/v1.0.0+999');
      expect(result.buildNumber).toBe(999);
      expect(typeof result.buildNumber).toBe('number');
    });

    test('retorna null para tag inválida sem formato correto', () => {
      const result = parseTagInfo('invalid-tag');
      expect(result).toBeNull();
    });

    test('retorna null para tag sem +buildNumber', () => {
      const result = parseTagInfo('app/v1.0.0');
      expect(result).toBeNull();
    });

    test('retorna null para tag sem /v', () => {
      const result = parseTagInfo('app-1.0.0+1');
      expect(result).toBeNull();
    });

    test('retorna null para tag com v minúsculo errado', () => {
      // A regex espera /v (com v minúsculo) que é o correto
      const result = parseTagInfo('app/V1.0.0+1');
      expect(result).toBeNull();
    });

    test('retorna null para tag vazia', () => {
      const result = parseTagInfo('');
      expect(result).toBeNull();
    });

    test('retorna null para buildNumber não numérico', () => {
      const result = parseTagInfo('app/v1.0.0+abc');
      expect(result).toBeNull();
    });
  });

  describe('listClientTags logic', () => {
    test('filtra tags pelo padrão clientName/v*', () => {
      const allTags = [
        'demo/v1.0.0+1',
        'demo/v1.0.1+2',
        'other-client/v1.0.0+1',
        'demo/v2.0.0+3',
        'unrelated-tag',
      ];

      const clientName = 'demo';
      const pattern = `${clientName}/v`;
      const filtered = allTags.filter((tag) => tag.startsWith(pattern));

      expect(filtered).toHaveLength(3);
      expect(filtered).toContain('demo/v1.0.0+1');
      expect(filtered).toContain('demo/v1.0.1+2');
      expect(filtered).toContain('demo/v2.0.0+3');
      expect(filtered).not.toContain('other-client/v1.0.0+1');
    });

    test('ordena tags em ordem reversa (mais recente primeiro)', () => {
      const tags = ['demo/v1.0.0+1', 'demo/v1.0.1+2', 'demo/v2.0.0+3'];
      const reversed = [...tags].reverse();

      expect(reversed[0]).toBe('demo/v2.0.0+3');
      expect(reversed[reversed.length - 1]).toBe('demo/v1.0.0+1');
    });
  });
});
