/**
 * Tests for cli/constants.js
 * Tests CATEGORIES constant
 */

const { CATEGORIES } = require('../../cli/constants');

describe('CLI Constants - CATEGORIES', () => {
  describe('structure', () => {
    test('CATEGORIES is an object', () => {
      expect(typeof CATEGORIES).toBe('object');
      expect(CATEGORIES).not.toBeNull();
    });

    test('all category values are strings', () => {
      Object.entries(CATEGORIES).forEach(([key, value]) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    test('all category keys are uppercase', () => {
      Object.keys(CATEGORIES).forEach((key) => {
        expect(key).toBe(key.toUpperCase());
      });
    });
  });

  describe('required categories', () => {
    test('WORKFLOWS category exists', () => {
      expect(CATEGORIES.WORKFLOWS).toBeDefined();
      expect(CATEGORIES.WORKFLOWS).toContain('FLUXOS');
    });

    test('CLIENT_OPS category exists', () => {
      expect(CATEGORIES.CLIENT_OPS).toBeDefined();
      expect(CATEGORIES.CLIENT_OPS).toContain('CLIENTE');
    });

    test('BUILD_DEPLOY category exists', () => {
      expect(CATEGORIES.BUILD_DEPLOY).toBeDefined();
      expect(CATEGORIES.BUILD_DEPLOY).toContain('BUILD');
    });

    test('SECURITY category exists', () => {
      expect(CATEGORIES.SECURITY).toBeDefined();
      expect(CATEGORIES.SECURITY).toContain('SEGURANÇA');
    });

    test('ASSETS category exists', () => {
      expect(CATEGORIES.ASSETS).toBeDefined();
      expect(CATEGORIES.ASSETS).toContain('ASSETS');
    });

    test('VALIDATION category exists', () => {
      expect(CATEGORIES.VALIDATION).toBeDefined();
      expect(CATEGORIES.VALIDATION).toContain('VALIDAÇÃO');
    });
  });

  describe('category formatting', () => {
    test('categories have emoji or symbol prefix', () => {
      // Check that categories contain emoji characters or common symbols (checkmarks, etc.)
      // Unicode ranges: emojis (1F300-1F9FF, 2600-26FF) and misc symbols (2700-27BF includes ✅)
      const emojiOrSymbolRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/u;

      Object.values(CATEGORIES).forEach((category) => {
        expect(category).toMatch(emojiOrSymbolRegex);
      });
    });

    test('all category values are unique', () => {
      const values = Object.values(CATEGORIES);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('module exports', () => {
    test('exports CATEGORIES', () => {
      const constants = require('../../cli/constants');
      expect(constants).toHaveProperty('CATEGORIES');
    });
  });
});
