/**
 * Tests for setup-app-config.js (AppConfigSetup)
 * Tests Firestore App Config setup operations
 */

const mockDoc = {
  set: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
};

const mockCollection = {
  doc: jest.fn(() => mockDoc),
};

const mockFirestore = jest.fn(() => ({
  collection: jest.fn(() => mockCollection),
}));

jest.mock("firebase-admin", () => ({
  firestore: mockFirestore,
}));

jest.mock("chalk", () => ({
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
}));

const AppConfigSetup = require("../../01-client-setup/steps/setup-app-config");

describe("AppConfigSetup", () => {
  let setup;
  let mockFirebaseApp;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    mockFirebaseApp = { name: "test-app" };
    setup = new AppConfigSetup(mockFirebaseApp);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    test("initializes with Firebase app", () => {
      expect(setup.app).toBe(mockFirebaseApp);
    });

    test("throws error when no Firebase app provided", () => {
      expect(() => new AppConfigSetup()).toThrow(
        "Firebase app instance is required",
      );
    });

    test("throws error when Firebase app is null", () => {
      expect(() => new AppConfigSetup(null)).toThrow(
        "Firebase app instance is required",
      );
    });
  });

  describe("setupAppConfig()", () => {
    const config = {
      featureFlags: {
        delivery: true,
        ecommerce: true,
        happyHour: true,
        campaigns: false,
        storeHours: true,
        pushNotifications: true,
        clarity: true,
        birthday: false,
        payments: false,
      },
      clarityProjectId: "clarity123",
      clientCode: "demo",
      planType: "profissional",
      planLimits: { maxClients: 5000 },
    };

    beforeEach(() => {
      mockDoc.set.mockResolvedValue();
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          featureFlags: config.featureFlags,
          clarityProjectId: config.clarityProjectId,
          versionarte: {
            android: { version: { minimum: "1.0.0", latest: "0.0.1" } },
            ios: { version: { minimum: "1.0.0", latest: "0.0.1" } },
          },
          planType: "profissional",
          planLimits: { maxClients: 5000 },
          launchScreenConfig: { launchDateTime: null },
        }),
      });
    });

    test("sets up app config successfully", async () => {
      const result = await setup.setupAppConfig(config);

      expect(result.featureFlags).toEqual(config.featureFlags);
      expect(result.clarityProjectId).toBe(config.clarityProjectId);
      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          featureFlags: config.featureFlags,
          clarityProjectId: config.clarityProjectId,
          planType: "profissional",
          planLimits: { maxClients: 5000 },
          launchScreenConfig: { launchDateTime: null },
        }),
      );
    });

    test("returns default versionarte", async () => {
      const result = await setup.setupAppConfig(config);

      expect(result.versionarte).toBeDefined();
      expect(result.versionarte.android).toBeDefined();
      expect(result.versionarte.ios).toBeDefined();
    });

    test("writes to App_Config/config collection/doc", async () => {
      await setup.setupAppConfig(config);

      const firestoreInstance = mockFirestore.mock.results[0].value;
      expect(firestoreInstance.collection).toHaveBeenCalledWith("App_Config");
      expect(mockCollection.doc).toHaveBeenCalledWith("config");
    });

    test("throws error on write failure", async () => {
      mockDoc.set.mockRejectedValue(new Error("Firestore write failed"));

      await expect(setup.setupAppConfig(config)).rejects.toThrow();
    });
  });

  describe("validateAppConfig()", () => {
    const expectedFeatureFlags = {
      delivery: true,
      club: false,
    };
    const expectedClarityId = "clarity123";

    test("returns true when config is valid", async () => {
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          featureFlags: expectedFeatureFlags,
          clarityProjectId: expectedClarityId,
          versionarte: {
            android: {},
            ios: {},
          },
        }),
      });

      const result = await setup.validateAppConfig(
        expectedFeatureFlags,
        expectedClarityId,
      );

      expect(result).toBe(true);
    });

    test("returns false when document does not exist", async () => {
      mockDoc.get.mockResolvedValue({
        exists: false,
      });

      const result = await setup.validateAppConfig(
        expectedFeatureFlags,
        expectedClarityId,
      );

      expect(result).toBe(false);
    });

    test("returns false when featureFlags field missing", async () => {
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          clarityProjectId: expectedClarityId,
          versionarte: { android: {}, ios: {} },
        }),
      });

      const result = await setup.validateAppConfig(
        expectedFeatureFlags,
        expectedClarityId,
      );

      expect(result).toBe(false);
    });

    test("returns false when versionarte field missing", async () => {
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          featureFlags: expectedFeatureFlags,
          clarityProjectId: expectedClarityId,
        }),
      });

      const result = await setup.validateAppConfig(
        expectedFeatureFlags,
        expectedClarityId,
      );

      expect(result).toBe(false);
    });

    test("returns false when feature flag values mismatch", async () => {
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          featureFlags: { delivery: false, club: true },
          clarityProjectId: expectedClarityId,
          versionarte: { android: {}, ios: {} },
        }),
      });

      const result = await setup.validateAppConfig(
        expectedFeatureFlags,
        expectedClarityId,
      );

      expect(result).toBe(false);
    });

    test("returns false when clarity ID mismatch", async () => {
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          featureFlags: expectedFeatureFlags,
          clarityProjectId: "different-id",
          versionarte: { android: {}, ios: {} },
        }),
      });

      const result = await setup.validateAppConfig(
        expectedFeatureFlags,
        expectedClarityId,
      );

      expect(result).toBe(false);
    });

    test("returns false after max retries on persistent error", async () => {
      mockDoc.get.mockRejectedValue(new Error("Persistent error"));

      const result = await setup.validateAppConfig(
        expectedFeatureFlags,
        expectedClarityId,
      );

      expect(result).toBe(false);
      expect(mockDoc.get).toHaveBeenCalledTimes(5);
    }, 15000);
  });

  describe("updatePlanConfig()", () => {
    test("updates plan type and limits", async () => {
      mockDoc.update.mockResolvedValue();

      const result = await setup.updatePlanConfig({
        planType: "ilimitado",
        featureFlags: { delivery: true },
        planLimits: { maxClients: -1 },
      });

      expect(result).toBe(true);
      expect(mockDoc.update).toHaveBeenCalledWith({
        planType: "ilimitado",
        featureFlags: { delivery: true },
        planLimits: { maxClients: -1 },
      });
    });

    test("updates without feature flags when not provided", async () => {
      mockDoc.update.mockResolvedValue();

      const result = await setup.updatePlanConfig({
        planType: "essencial",
        planLimits: { maxClients: 500 },
      });

      expect(result).toBe(true);
      expect(mockDoc.update).toHaveBeenCalledWith({
        planType: "essencial",
        planLimits: { maxClients: 500 },
      });
    });

    test("throws error on update failure", async () => {
      mockDoc.update.mockRejectedValue(new Error("Update failed"));

      await expect(
        setup.updatePlanConfig({
          planType: "profissional",
          planLimits: {},
        }),
      ).rejects.toThrow("Failed to update App Config");
    });
  });
});
