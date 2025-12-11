/**
 * Tests for setup-remote-config.js (RemoteConfigSetup)
 * Tests Firebase Remote Config setup operations
 */

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

jest.mock('firebase-admin', () => {
  const mockRemoteConfig = {
    getTemplate: jest.fn(),
    publishTemplate: jest.fn(),
  };

  return {
    remoteConfig: jest.fn(() => mockRemoteConfig),
  };
});

jest.mock('chalk', () => ({
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
}));

const fs = require('fs').promises;
const admin = require('firebase-admin');
const RemoteConfigSetup = require('../../01-client-setup/steps/setup-remote-config');

describe('RemoteConfigSetup', () => {
  let setup;
  let mockFirebaseApp;
  let mockRemoteConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockRemoteConfig = {
      getTemplate: jest.fn(),
      publishTemplate: jest.fn(),
    };

    admin.remoteConfig.mockReturnValue(mockRemoteConfig);

    mockFirebaseApp = { name: 'test-app' };
    setup = new RemoteConfigSetup(mockFirebaseApp);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('initializes with Firebase app', () => {
      expect(setup.app).toBe(mockFirebaseApp);
    });

    test('throws error when no Firebase app provided', () => {
      expect(() => new RemoteConfigSetup()).toThrow('Firebase app instance is required');
    });

    test('throws error when Firebase app is null', () => {
      expect(() => new RemoteConfigSetup(null)).toThrow('Firebase app instance is required');
    });
  });

  describe('loadTemplate()', () => {
    test('loads template from file', async () => {
      const mockTemplate = {
        parameters: {
          featureFlags: { defaultValue: { value: '{}' } },
        },
      };
      fs.readFile.mockResolvedValue(JSON.stringify(mockTemplate));

      const result = await setup.loadTemplate();

      expect(result).toEqual(mockTemplate);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('remote-config-template.json'),
        'utf-8'
      );
    });

    test('throws error when template not found', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(setup.loadTemplate()).rejects.toThrow('Failed to load Remote Config template');
    });

    test('throws error when template is invalid JSON', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      await expect(setup.loadTemplate()).rejects.toThrow();
    });
  });

  describe('replaceVariables()', () => {
    const baseTemplate = {
      parameters: {
        featureFlags: {
          defaultValue: {
            value: JSON.stringify({
              delivery: '{{DELIVERY}}',
              club: '{{CLUB}}',
              happyHour: '{{HAPPY_HOUR}}',
              campaigns: '{{CAMPAIGNS}}',
              storeHours: '{{STORE_HOURS}}',
              pushNotifications: '{{PUSH_NOTIFICATIONS}}',
              suggestionBox: '{{SUGGESTION_BOX}}',
              clarity: '{{CLARITY}}',
              ourStory: '{{OUR_STORY}}',
            }),
          },
        },
        clarityProjectId: {
          defaultValue: { value: '{{CLARITY_PROJECT_ID}}' },
        },
      },
    };

    test('replaces feature flags with true/false strings', () => {
      const config = {
        featureFlags: {
          delivery: true,
          club: false,
          happyHour: true,
          campaigns: false,
          storeHours: true,
          pushNotifications: true,
          suggestionBox: false,
          clarity: true,
          ourStory: false,
        },
        clarityProjectId: 'clarity123',
      };

      const result = setup.replaceVariables(baseTemplate, config);
      const resultStr = JSON.stringify(result);

      // Values are escaped in JSON string format
      expect(resultStr).toContain('delivery');
      expect(resultStr).toContain('true');
      expect(resultStr).toContain('false');
    });

    test('replaces Clarity project ID', () => {
      const config = {
        featureFlags: {
          delivery: false,
          club: false,
          happyHour: false,
          campaigns: false,
          storeHours: false,
          pushNotifications: false,
          suggestionBox: false,
          clarity: false,
          ourStory: false,
        },
        clarityProjectId: 'my-clarity-project',
      };

      const result = setup.replaceVariables(baseTemplate, config);

      expect(JSON.stringify(result)).toContain('my-clarity-project');
    });

    test('handles all flags as true', () => {
      const config = {
        featureFlags: {
          delivery: true,
          club: true,
          happyHour: true,
          campaigns: true,
          storeHours: true,
          pushNotifications: true,
          suggestionBox: true,
          clarity: true,
          ourStory: true,
        },
        clarityProjectId: 'test',
      };

      const result = setup.replaceVariables(baseTemplate, config);
      const resultStr = JSON.stringify(result);

      expect(resultStr).not.toContain('false');
      expect(resultStr).toContain('true');
    });

    test('handles all flags as false', () => {
      const config = {
        featureFlags: {
          delivery: false,
          club: false,
          happyHour: false,
          campaigns: false,
          storeHours: false,
          pushNotifications: false,
          suggestionBox: false,
          clarity: false,
          ourStory: false,
        },
        clarityProjectId: 'test',
      };

      const result = setup.replaceVariables(baseTemplate, config);
      const resultStr = JSON.stringify(result);

      // All flags should be false - check the escaped string contains false values
      expect(resultStr).toContain('false');
      expect(resultStr).not.toContain(':true');
    });
  });

  describe('publishTemplate()', () => {
    test('publishes template to Firebase', async () => {
      const mockCurrentTemplate = {
        parameters: {},
        conditions: [],
      };

      const mockPublishedTemplate = {
        version: { versionNumber: 1 },
      };

      mockRemoteConfig.getTemplate.mockResolvedValue(mockCurrentTemplate);
      mockRemoteConfig.publishTemplate.mockResolvedValue(mockPublishedTemplate);

      const template = {
        parameters: { test: { defaultValue: { value: 'test' } } },
        conditions: [],
      };

      await setup.publishTemplate(template, 'demo');

      expect(mockRemoteConfig.getTemplate).toHaveBeenCalled();
      expect(mockRemoteConfig.publishTemplate).toHaveBeenCalled();
    });

    test('updates current template parameters', async () => {
      const mockCurrentTemplate = {
        parameters: { old: {} },
        conditions: [{ name: 'old-condition' }],
      };

      mockRemoteConfig.getTemplate.mockResolvedValue(mockCurrentTemplate);
      mockRemoteConfig.publishTemplate.mockResolvedValue({
        version: { versionNumber: 2 },
      });

      const newTemplate = {
        parameters: { new: { defaultValue: { value: 'new' } } },
        conditions: [{ name: 'new-condition' }],
      };

      await setup.publishTemplate(newTemplate, 'demo');

      expect(mockRemoteConfig.publishTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: newTemplate.parameters,
          conditions: newTemplate.conditions,
        })
      );
    });

    test('throws error on publish failure', async () => {
      mockRemoteConfig.getTemplate.mockResolvedValue({ parameters: {} });
      mockRemoteConfig.publishTemplate.mockRejectedValue(new Error('Publish failed'));

      await expect(setup.publishTemplate({}, 'demo')).rejects.toThrow(
        'Failed to publish Remote Config template'
      );
    });
  });

  describe('validateRemoteConfig()', () => {
    const expectedFeatureFlags = {
      delivery: true,
      club: false,
    };
    const expectedClarityId = 'clarity123';

    test('returns true when config is valid', async () => {
      const mockTemplate = {
        parameters: {
          featureFlags: {
            defaultValue: { value: JSON.stringify(expectedFeatureFlags) },
          },
          clarityProjectId: {
            defaultValue: { value: expectedClarityId },
          },
          versionarte: {
            defaultValue: { value: '{}' },
          },
        },
      };

      mockRemoteConfig.getTemplate.mockResolvedValue(mockTemplate);

      const result = await setup.validateRemoteConfig(expectedFeatureFlags, expectedClarityId);

      expect(result).toBe(true);
    });

    test('returns false when featureFlags parameter missing', async () => {
      mockRemoteConfig.getTemplate.mockResolvedValue({
        parameters: {
          clarityProjectId: { defaultValue: { value: expectedClarityId } },
          versionarte: { defaultValue: { value: '{}' } },
        },
      });

      const result = await setup.validateRemoteConfig(expectedFeatureFlags, expectedClarityId);

      expect(result).toBe(false);
    });

    test('returns false when clarityProjectId parameter missing', async () => {
      mockRemoteConfig.getTemplate.mockResolvedValue({
        parameters: {
          featureFlags: { defaultValue: { value: JSON.stringify(expectedFeatureFlags) } },
          versionarte: { defaultValue: { value: '{}' } },
        },
      });

      const result = await setup.validateRemoteConfig(expectedFeatureFlags, expectedClarityId);

      expect(result).toBe(false);
    });

    test('returns false when versionarte parameter missing', async () => {
      mockRemoteConfig.getTemplate.mockResolvedValue({
        parameters: {
          featureFlags: { defaultValue: { value: JSON.stringify(expectedFeatureFlags) } },
          clarityProjectId: { defaultValue: { value: expectedClarityId } },
        },
      });

      const result = await setup.validateRemoteConfig(expectedFeatureFlags, expectedClarityId);

      expect(result).toBe(false);
    });

    test('returns false when feature flag values mismatch', async () => {
      mockRemoteConfig.getTemplate.mockResolvedValue({
        parameters: {
          featureFlags: {
            defaultValue: { value: JSON.stringify({ delivery: false, club: true }) },
          },
          clarityProjectId: { defaultValue: { value: expectedClarityId } },
          versionarte: { defaultValue: { value: '{}' } },
        },
      });

      const result = await setup.validateRemoteConfig(expectedFeatureFlags, expectedClarityId);

      expect(result).toBe(false);
    });

    test('returns false when clarity ID mismatch', async () => {
      mockRemoteConfig.getTemplate.mockResolvedValue({
        parameters: {
          featureFlags: { defaultValue: { value: JSON.stringify(expectedFeatureFlags) } },
          clarityProjectId: { defaultValue: { value: 'different-id' } },
          versionarte: { defaultValue: { value: '{}' } },
        },
      });

      const result = await setup.validateRemoteConfig(expectedFeatureFlags, expectedClarityId);

      expect(result).toBe(false);
    });

    test('retries on failure', async () => {
      mockRemoteConfig.getTemplate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          parameters: {
            featureFlags: { defaultValue: { value: JSON.stringify(expectedFeatureFlags) } },
            clarityProjectId: { defaultValue: { value: expectedClarityId } },
            versionarte: { defaultValue: { value: '{}' } },
          },
        });

      // Mock sleep to avoid waiting
      jest.spyOn(setup, 'sleep').mockResolvedValue();

      const result = await setup.validateRemoteConfig(expectedFeatureFlags, expectedClarityId);

      expect(result).toBe(true);
      expect(mockRemoteConfig.getTemplate).toHaveBeenCalledTimes(3);
    });

    test('returns false after max retries', async () => {
      mockRemoteConfig.getTemplate.mockRejectedValue(new Error('Persistent error'));

      // Mock sleep to avoid waiting
      jest.spyOn(setup, 'sleep').mockResolvedValue();

      const result = await setup.validateRemoteConfig(expectedFeatureFlags, expectedClarityId);

      expect(result).toBe(false);
      expect(mockRemoteConfig.getTemplate).toHaveBeenCalledTimes(5);
    });
  });

  describe('setupRemoteConfig()', () => {
    const config = {
      featureFlags: {
        delivery: true,
        club: false,
        happyHour: true,
        campaigns: false,
        storeHours: true,
        pushNotifications: true,
        suggestionBox: false,
        clarity: true,
        ourStory: false,
      },
      clarityProjectId: 'clarity123',
      clientCode: 'demo',
    };

    beforeEach(() => {
      const mockTemplate = {
        parameters: {
          featureFlags: { defaultValue: { value: '{{DELIVERY}}' } },
          clarityProjectId: { defaultValue: { value: '{{CLARITY_PROJECT_ID}}' } },
        },
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockTemplate));

      mockRemoteConfig.getTemplate.mockResolvedValue({
        parameters: {
          featureFlags: { defaultValue: { value: JSON.stringify(config.featureFlags) } },
          clarityProjectId: { defaultValue: { value: config.clarityProjectId } },
          versionarte: { defaultValue: { value: '{}' } },
        },
      });

      mockRemoteConfig.publishTemplate.mockResolvedValue({
        version: { versionNumber: 1 },
      });
    });

    test('sets up remote config successfully', async () => {
      const result = await setup.setupRemoteConfig(config);

      expect(result.featureFlags).toEqual(config.featureFlags);
      expect(result.clarityProjectId).toBe(config.clarityProjectId);
    });

    test('returns default versionarte', async () => {
      const result = await setup.setupRemoteConfig(config);

      expect(result.versionarte).toBeDefined();
      expect(result.versionarte.android).toBeDefined();
      expect(result.versionarte.ios).toBeDefined();
    });

    test('throws error on setup failure', async () => {
      fs.readFile.mockRejectedValue(new Error('Template not found'));

      await expect(setup.setupRemoteConfig(config)).rejects.toThrow();
    });
  });

  describe('getDefaultVersionarte()', () => {
    test('returns android configuration', () => {
      const result = setup.getDefaultVersionarte();

      expect(result.android).toBeDefined();
      expect(result.android.version.minimum).toBe('1.0.0');
      expect(result.android.version.latest).toBe('0.0.1');
      expect(result.android.status.active).toBe(true);
    });

    test('returns iOS configuration', () => {
      const result = setup.getDefaultVersionarte();

      expect(result.ios).toBeDefined();
      expect(result.ios.version.minimum).toBe('1.0.0');
      expect(result.ios.version.latest).toBe('0.0.1');
      expect(result.ios.status.active).toBe(true);
    });

    test('includes maintenance message in Portuguese', () => {
      const result = setup.getDefaultVersionarte();

      expect(result.android.status.message.pt).toContain('manutenção');
      expect(result.ios.status.message.pt).toContain('manutenção');
    });
  });

  describe('sleep()', () => {
    test('returns a promise', () => {
      jest.useFakeTimers();

      const promise = setup.sleep(1000);

      expect(promise).toBeInstanceOf(Promise);

      jest.runAllTimers();
      jest.useRealTimers();
    });

    test('resolves after specified time', async () => {
      jest.useFakeTimers();

      const promise = setup.sleep(1000);
      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();

      jest.useRealTimers();
    });
  });
});
