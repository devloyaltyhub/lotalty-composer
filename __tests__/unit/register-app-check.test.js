/**
 * Tests for register-app-check.js
 * Tests App Check registration and SHA-256 fingerprint management
 */

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
}));

jest.mock('chalk', () => ({
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  white: jest.fn((str) => str),
}));

const { execSync } = require('child_process');
const fs = require('fs');
const {
  registerAppCheckFingerprint,
  registerAppCheckFingerprints,
  addSHA256Fingerprint,
  getAndroidAppId,
  generateAppCheckInstructions,
} = require('../../01-client-setup/steps/register-app-check');

describe('register-app-check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAndroidAppId()', () => {
    test('returns app ID for matching package name', async () => {
      execSync.mockReturnValue(
        JSON.stringify({
          result: [
            { packageName: 'com.example.app', appId: '1:123:android:abc' },
            { packageName: 'com.other.app', appId: '1:456:android:def' },
          ],
        })
      );

      const result = await getAndroidAppId('test-project', 'com.example.app');

      expect(result).toBe('1:123:android:abc');
    });

    test('throws error when no apps found', async () => {
      execSync.mockReturnValue(JSON.stringify({ result: [] }));

      await expect(getAndroidAppId('test-project', 'com.example.app')).rejects.toThrow(
        'No Android apps found'
      );
    });

    test('throws error when package not found', async () => {
      execSync.mockReturnValue(
        JSON.stringify({
          result: [{ packageName: 'com.other.app', appId: '1:456:android:def' }],
        })
      );

      await expect(getAndroidAppId('test-project', 'com.example.app')).rejects.toThrow(
        'Android app with package com.example.app not found'
      );
    });

    test('handles Firebase CLI error', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Firebase CLI error');
      });

      await expect(getAndroidAppId('test-project', 'com.example.app')).rejects.toThrow(
        'Failed to get Android app ID'
      );
    });
  });

  describe('addSHA256Fingerprint()', () => {
    test('adds SHA-256 fingerprint successfully', async () => {
      execSync.mockReturnValue('');

      const result = await addSHA256Fingerprint(
        'test-project',
        '1:123:android:abc',
        'AA:BB:CC:DD',
        'release'
      );

      expect(result.success).toBe(true);
      expect(result.sha256).toBe('AA:BB:CC:DD');
      expect(result.type).toBe('release');
    });

    test('returns success with alreadyExists flag when SHA exists', async () => {
      execSync.mockImplementation(() => {
        throw new Error('already exists');
      });

      const result = await addSHA256Fingerprint(
        'test-project',
        '1:123:android:abc',
        'AA:BB:CC:DD',
        'release'
      );

      expect(result.success).toBe(true);
      expect(result.alreadyExists).toBe(true);
    });

    test('throws error for other failures', async () => {
      execSync.mockImplementation(() => {
        throw new Error('other error');
      });

      await expect(
        addSHA256Fingerprint('test-project', '1:123:android:abc', 'AA:BB:CC:DD', 'release')
      ).rejects.toThrow('Failed to add release SHA-256');
    });
  });

  describe('registerAppCheckFingerprints()', () => {
    const keystoreResults = {
      debug: { sha256: 'AA:BB:CC:DD:DEBUG' },
      release: { sha256: 'AA:BB:CC:DD:RELEASE' },
    };

    test('registers both debug and release fingerprints', async () => {
      execSync
        .mockReturnValueOnce(
          JSON.stringify({
            result: [{ packageName: 'com.example.app', appId: '1:123:android:abc' }],
          })
        )
        .mockReturnValue('');

      const result = await registerAppCheckFingerprints(
        'test-project',
        'com.example.app',
        keystoreResults
      );

      expect(result.success).toBe(true);
      expect(result.appId).toBe('1:123:android:abc');
      expect(result.debug.success).toBe(true);
      expect(result.release.success).toBe(true);
    });

    test('includes console URL in result', async () => {
      execSync
        .mockReturnValueOnce(
          JSON.stringify({
            result: [{ packageName: 'com.example.app', appId: '1:123:android:abc' }],
          })
        )
        .mockReturnValue('');

      const result = await registerAppCheckFingerprints(
        'test-project',
        'com.example.app',
        keystoreResults
      );

      expect(result.consoleUrl).toContain('test-project');
      expect(result.consoleUrl).toContain('appcheck');
    });

    test('throws error when app ID retrieval fails', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Failed to get app ID');
      });

      await expect(
        registerAppCheckFingerprints('test-project', 'com.example.app', keystoreResults)
      ).rejects.toThrow();
    });
  });

  describe('registerAppCheckFingerprint()', () => {
    test('returns success with manual steps required', async () => {
      execSync
        .mockReturnValueOnce(
          JSON.stringify({
            result: [{ packageName: 'com.example.app', appId: '1:123:android:abc' }],
          })
        )
        .mockReturnValue('');

      const result = await registerAppCheckFingerprint(
        'test-project',
        'AA:BB:CC:DD',
        'com.example.app'
      );

      expect(result.success).toBe(true);
      expect(result.manualStepsRequired).toBe(true);
      expect(result.sha256).toBe('AA:BB:CC:DD');
    });

    test('includes console URL in result', async () => {
      execSync
        .mockReturnValueOnce(
          JSON.stringify({
            result: [{ packageName: 'com.example.app', appId: '1:123:android:abc' }],
          })
        )
        .mockReturnValue('');

      const result = await registerAppCheckFingerprint(
        'test-project',
        'AA:BB:CC:DD',
        'com.example.app'
      );

      expect(result.consoleUrl).toContain('test-project');
    });
  });

  describe('generateAppCheckInstructions()', () => {
    test('generates instructions file', () => {
      const result = generateAppCheckInstructions(
        'demo',
        'demo-project',
        'AA:BB:CC:DD:DEBUG',
        'AA:BB:CC:DD:RELEASE',
        'com.example.demo',
        '/output'
      );

      expect(result).toContain('APP_CHECK_SETUP_demo.md');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('includes project ID in instructions', () => {
      generateAppCheckInstructions(
        'demo',
        'demo-project',
        'AA:BB:CC:DD:DEBUG',
        'AA:BB:CC:DD:RELEASE',
        'com.example.demo',
        '/output'
      );

      const content = fs.writeFileSync.mock.calls[0][1];
      expect(content).toContain('demo-project');
    });

    test('includes both SHA-256 fingerprints', () => {
      generateAppCheckInstructions(
        'demo',
        'demo-project',
        'AA:BB:CC:DD:DEBUG',
        'AA:BB:CC:DD:RELEASE',
        'com.example.demo',
        '/output'
      );

      const content = fs.writeFileSync.mock.calls[0][1];
      expect(content).toContain('AA:BB:CC:DD:DEBUG');
      expect(content).toContain('AA:BB:CC:DD:RELEASE');
    });

    test('includes package name', () => {
      generateAppCheckInstructions(
        'demo',
        'demo-project',
        'AA:BB:CC:DD:DEBUG',
        'AA:BB:CC:DD:RELEASE',
        'com.example.demo',
        '/output'
      );

      const content = fs.writeFileSync.mock.calls[0][1];
      expect(content).toContain('com.example.demo');
    });

    test('includes Firebase Console links', () => {
      generateAppCheckInstructions(
        'demo',
        'demo-project',
        'AA:BB:CC:DD:DEBUG',
        'AA:BB:CC:DD:RELEASE',
        'com.example.demo',
        '/output'
      );

      const content = fs.writeFileSync.mock.calls[0][1];
      expect(content).toContain('console.firebase.google.com');
    });

    test('handles legacy single SHA-256 (backward compatibility)', () => {
      generateAppCheckInstructions(
        'demo',
        'demo-project',
        'AA:BB:CC:DD:SINGLE',
        null,
        'com.example.demo',
        '/output'
      );

      const content = fs.writeFileSync.mock.calls[0][1];
      expect(content).toContain('AA:BB:CC:DD:SINGLE');
    });
  });
});
