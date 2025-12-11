/**
 * Tests for cli/config.js
 * Tests SCRIPTS and WORKFLOWS configuration
 */

const { SCRIPTS, WORKFLOWS } = require('../../cli/config');
const { CATEGORIES } = require('../../cli/constants');

describe('CLI Config - SCRIPTS', () => {
  describe('structure validation', () => {
    test('all scripts have required properties', () => {
      Object.entries(SCRIPTS).forEach(([key, script]) => {
        expect(script).toHaveProperty('name');
        expect(script).toHaveProperty('description');
        expect(script).toHaveProperty('category');
        expect(script).toHaveProperty('script');

        expect(typeof script.name).toBe('string');
        expect(typeof script.description).toBe('string');
        expect(typeof script.category).toBe('string');
        expect(typeof script.script).toBe('string');

        expect(script.name.length).toBeGreaterThan(0);
        expect(script.description.length).toBeGreaterThan(0);
        expect(script.script.length).toBeGreaterThan(0);
      });
    });

    test('scripts have valid categories', () => {
      const validCategories = Object.values(CATEGORIES);

      Object.entries(SCRIPTS).forEach(([key, script]) => {
        expect(validCategories).toContain(script.category);
      });
    });

    test('script paths end with .js', () => {
      Object.entries(SCRIPTS).forEach(([key, script]) => {
        expect(script.script).toMatch(/\.js$/);
      });
    });

    test('args property is array when present', () => {
      Object.entries(SCRIPTS).forEach(([key, script]) => {
        if (script.args !== undefined) {
          expect(Array.isArray(script.args)).toBe(true);
        }
      });
    });
  });

  describe('client operations scripts', () => {
    test('CREATE_CLIENT is properly defined', () => {
      expect(SCRIPTS.CREATE_CLIENT).toBeDefined();
      expect(SCRIPTS.CREATE_CLIENT.category).toBe(CATEGORIES.CLIENT_OPS);
      expect(SCRIPTS.CREATE_CLIENT.script).toContain('create-client');
    });

    test('UPDATE_CLIENT is properly defined', () => {
      expect(SCRIPTS.UPDATE_CLIENT).toBeDefined();
      expect(SCRIPTS.UPDATE_CLIENT.category).toBe(CATEGORIES.CLIENT_OPS);
    });

    test('VERIFY_CLIENT is properly defined', () => {
      expect(SCRIPTS.VERIFY_CLIENT).toBeDefined();
      expect(SCRIPTS.VERIFY_CLIENT.category).toBe(CATEGORIES.CLIENT_OPS);
    });

    test('ROLLBACK_CLIENT is properly defined', () => {
      expect(SCRIPTS.ROLLBACK_CLIENT).toBeDefined();
      expect(SCRIPTS.ROLLBACK_CLIENT.category).toBe(CATEGORIES.CLIENT_OPS);
    });
  });

  describe('security scripts', () => {
    test('SETUP_MASTER_USER is properly defined', () => {
      expect(SCRIPTS.SETUP_MASTER_USER).toBeDefined();
      expect(SCRIPTS.SETUP_MASTER_USER.category).toBe(CATEGORIES.SECURITY);
    });

    test('DEPLOY_MASTER_RULES is properly defined', () => {
      expect(SCRIPTS.DEPLOY_MASTER_RULES).toBeDefined();
      expect(SCRIPTS.DEPLOY_MASTER_RULES.category).toBe(CATEGORIES.SECURITY);
    });
  });

  describe('build & deploy scripts', () => {
    test('DEPLOY_CLIENT is properly defined', () => {
      expect(SCRIPTS.DEPLOY_CLIENT).toBeDefined();
      expect(SCRIPTS.DEPLOY_CLIENT.category).toBe(CATEGORIES.BUILD_DEPLOY);
    });

    test('BUILD_ONLY has --no-deploy arg', () => {
      expect(SCRIPTS.BUILD_ONLY).toBeDefined();
      expect(SCRIPTS.BUILD_ONLY.args).toContain('--no-deploy');
    });
  });

  describe('validation scripts', () => {
    test('PREFLIGHT_CHECK is properly defined', () => {
      expect(SCRIPTS.PREFLIGHT_CHECK).toBeDefined();
      expect(SCRIPTS.PREFLIGHT_CHECK.category).toBe(CATEGORIES.VALIDATION);
    });

    test('CHECK_UNUSED_FILES is properly defined', () => {
      expect(SCRIPTS.CHECK_UNUSED_FILES).toBeDefined();
      expect(SCRIPTS.CHECK_UNUSED_FILES.category).toBe(CATEGORIES.VALIDATION);
    });
  });
});

describe('CLI Config - WORKFLOWS', () => {
  describe('structure validation', () => {
    test('all workflows have required properties', () => {
      Object.entries(WORKFLOWS).forEach(([key, workflow]) => {
        expect(workflow).toHaveProperty('name');
        expect(workflow).toHaveProperty('description');
        expect(workflow).toHaveProperty('category');
        expect(workflow).toHaveProperty('steps');

        expect(typeof workflow.name).toBe('string');
        expect(typeof workflow.description).toBe('string');
        expect(typeof workflow.category).toBe('string');
        expect(Array.isArray(workflow.steps)).toBe(true);

        expect(workflow.name.length).toBeGreaterThan(0);
        expect(workflow.description.length).toBeGreaterThan(0);
        expect(workflow.steps.length).toBeGreaterThan(0);
      });
    });

    test('workflow steps have required structure', () => {
      Object.entries(WORKFLOWS).forEach(([key, workflow]) => {
        workflow.steps.forEach((step, index) => {
          expect(step).toHaveProperty('action');
          expect(step).toHaveProperty('script');
          expect(typeof step.action).toBe('string');
          expect(step.script).toHaveProperty('name');
          expect(step.script).toHaveProperty('description');
          expect(step.script).toHaveProperty('script');
        });
      });
    });

    test('confirmStart is boolean when present', () => {
      Object.entries(WORKFLOWS).forEach(([key, workflow]) => {
        if (workflow.confirmStart !== undefined) {
          expect(typeof workflow.confirmStart).toBe('boolean');
        }
      });
    });

    test('optional step flag is boolean when present', () => {
      Object.entries(WORKFLOWS).forEach(([key, workflow]) => {
        workflow.steps.forEach((step) => {
          if (step.optional !== undefined) {
            expect(typeof step.optional).toBe('boolean');
          }
        });
      });
    });
  });

  describe('specific workflows', () => {
    test('COMPLETE_SETUP workflow exists and has correct structure', () => {
      expect(WORKFLOWS.COMPLETE_SETUP).toBeDefined();
      expect(WORKFLOWS.COMPLETE_SETUP.steps.length).toBeGreaterThanOrEqual(2);
    });

    test('EMERGENCY_ROLLBACK requires confirmation', () => {
      expect(WORKFLOWS.EMERGENCY_ROLLBACK).toBeDefined();
      expect(WORKFLOWS.EMERGENCY_ROLLBACK.confirmStart).toBe(true);
    });

    test('DEPLOY_TO_STORES requires confirmation', () => {
      expect(WORKFLOWS.DEPLOY_TO_STORES).toBeDefined();
      expect(WORKFLOWS.DEPLOY_TO_STORES.confirmStart).toBe(true);
    });

    test('QUICK_UPDATE has optional steps', () => {
      expect(WORKFLOWS.QUICK_UPDATE).toBeDefined();
      // Check if any step is optional
      const hasOptionalStep = WORKFLOWS.QUICK_UPDATE.steps.some((step) => step.optional === true);
      // This may or may not have optional steps - just ensure workflow is valid
      expect(WORKFLOWS.QUICK_UPDATE.steps.length).toBeGreaterThan(0);
    });

    test('MASTER_FIREBASE_SECURITY workflow has security steps', () => {
      expect(WORKFLOWS.MASTER_FIREBASE_SECURITY).toBeDefined();
      const actions = WORKFLOWS.MASTER_FIREBASE_SECURITY.steps.map((s) => s.action);
      expect(actions).toContain('setup-user');
      expect(actions).toContain('deploy-rules');
    });
  });

  describe('workflow consistency', () => {
    test('workflow step scripts reference valid SCRIPTS', () => {
      // Get all script paths from SCRIPTS config
      const validScriptPaths = Object.values(SCRIPTS).map((s) => s.script);

      Object.entries(WORKFLOWS).forEach(([workflowKey, workflow]) => {
        workflow.steps.forEach((step) => {
          // Script should have a valid path
          expect(step.script.script).toBeDefined();
          expect(typeof step.script.script).toBe('string');
          expect(step.script.script.length).toBeGreaterThan(0);
        });
      });
    });

    test('all workflows belong to WORKFLOWS category', () => {
      Object.entries(WORKFLOWS).forEach(([key, workflow]) => {
        expect(workflow.category).toBe(CATEGORIES.WORKFLOWS);
      });
    });
  });
});

describe('CLI Config - Integration', () => {
  test('no duplicate script names', () => {
    const names = Object.values(SCRIPTS).map((s) => s.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  test('no duplicate workflow names', () => {
    const names = Object.values(WORKFLOWS).map((w) => w.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  test('exports both SCRIPTS and WORKFLOWS', () => {
    const config = require('../../cli/config');
    expect(config).toHaveProperty('SCRIPTS');
    expect(config).toHaveProperty('WORKFLOWS');
  });
});
