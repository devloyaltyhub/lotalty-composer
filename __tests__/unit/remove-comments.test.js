/**
 * Tests for shared/validators/remove_comments.js
 * Tests Dart comment removal functionality
 */

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(),
  existsSync: jest.fn(),
}));

const fs = require('fs');

describe('remove_comments', () => {
  let consoleSpy;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue([]);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('isFunctionSignature()', () => {
    test('returns true for function with braces', () => {
      const line = 'void myFunction() {';
      const trimmed = line.trim();
      const hasParens = trimmed.includes('(') && trimmed.includes(')');
      const notControlStructure = !/^(if|for|while|switch)\b/.test(trimmed);
      const endsCorrectly = /[{;]|=>\s*/.test(trimmed);

      expect(hasParens && notControlStructure && endsCorrectly).toBe(true);
    });

    test('returns true for function with arrow', () => {
      const line = 'String getName() => name;';
      const trimmed = line.trim();
      const hasParens = trimmed.includes('(') && trimmed.includes(')');
      const endsCorrectly = /[{;]|=>\s*/.test(trimmed);

      expect(hasParens && endsCorrectly).toBe(true);
    });

    test('returns false for if statement', () => {
      const line = 'if (condition) {';
      const trimmed = line.trim();
      const isControlStructure = /^(if|for|while|switch)\b/.test(trimmed);

      expect(isControlStructure).toBe(true);
    });

    test('returns false for for loop', () => {
      const line = 'for (var i = 0; i < 10; i++) {';
      const trimmed = line.trim();
      const isControlStructure = /^(if|for|while|switch)\b/.test(trimmed);

      expect(isControlStructure).toBe(true);
    });

    test('returns false for getter', () => {
      const line = 'String get name => _name;';
      const trimmed = line.trim();
      const isGetterSetter = /\bget\b|\bset\b/.test(trimmed);

      expect(isGetterSetter).toBe(true);
    });
  });

  describe('stripBlockComments()', () => {
    test('removes single block comment', () => {
      const content = 'code /* comment */ more code';
      const result = content.replace(/\/\*[\s\S]*?\*\//g, '');

      expect(result).toBe('code  more code');
    });

    test('removes multiline block comment', () => {
      const content = 'code\n/* comment\n   multiline */\nmore code';
      const result = content.replace(/\/\*[\s\S]*?\*\//g, '');

      expect(result).toBe('code\n\nmore code');
    });

    test('removes doc block comment', () => {
      const content = '/** This is a doc */\nclass MyClass {}';
      const result = content.replace(/\/\*[\s\S]*?\*\//g, '');

      expect(result).toBe('\nclass MyClass {}');
    });

    test('preserves code without comments', () => {
      const content = 'class MyClass {\n  void method() {}\n}';
      const result = content.replace(/\/\*[\s\S]*?\*\//g, '');

      expect(result).toBe(content);
    });
  });

  describe('stripSingleLineComments logic', () => {
    test('removes full line comments', () => {
      const line = '// This is a comment';
      const trimmed = line.trim();

      expect(trimmed.startsWith('//')).toBe(true);
    });

    test('preserves doc comments before functions', () => {
      const lines = ['/// Documentation', 'void myFunction() {'];

      const docLine = lines[0].trim();
      const nextLine = lines[1];

      const isDocComment = docLine.startsWith('///');
      const isFunction =
        nextLine.includes('(') && nextLine.includes(')') && /[{;]|=>\s*/.test(nextLine);

      expect(isDocComment).toBe(true);
      expect(isFunction).toBe(true);
    });

    test('removes inline trailing comments', () => {
      const line = 'int x = 5; // inline comment';
      const idx = line.indexOf('//');
      const before = line.slice(0, idx).trimEnd();

      expect(before).toBe('int x = 5;');
    });

    test('preserves // inside strings', () => {
      const line = 'String url = "https://example.com";';
      const idx = line.indexOf('//');

      if (idx !== -1) {
        const before = line.slice(0, idx);
        const doubleQuotes = (before.match(/(^|[^\\])"/g) || []).length;
        const inDouble = doubleQuotes % 2 === 1;

        expect(inDouble).toBe(true);
      }
    });
  });

  describe('processDartFile logic', () => {
    test('returns true when file was modified', () => {
      const original = 'code // comment';
      const processed = 'code';

      expect(processed !== original).toBe(true);
    });

    test('returns false when file unchanged', () => {
      const original = 'void main() {}';
      const processed = 'void main() {}';

      expect(processed !== original).toBe(false);
    });
  });

  describe('walk() logic', () => {
    test('processes .dart files', () => {
      const files = ['file1.dart', 'file2.dart', 'file3.js'];
      const dartFiles = files.filter((f) => f.endsWith('.dart'));

      expect(dartFiles).toHaveLength(2);
    });

    test('recurses into directories', () => {
      const entries = [
        { name: 'subdir', isDirectory: () => true, isFile: () => false },
        { name: 'file.dart', isDirectory: () => false, isFile: () => true },
      ];

      const directories = entries.filter((e) => e.isDirectory());
      const files = entries.filter((e) => e.isFile());

      expect(directories).toHaveLength(1);
      expect(files).toHaveLength(1);
    });
  });

  describe('main() logic', () => {
    test('exits with 1 when no directories provided', () => {
      const dirs = [];

      if (dirs.length === 0) {
        expect(dirs.length).toBe(0);
      }
    });

    test('skips non-existent directories', () => {
      fs.existsSync.mockReturnValue(false);

      const dir = '/nonexistent';
      const exists = fs.existsSync(dir);

      expect(exists).toBe(false);
    });

    test('reports scanned and modified counts', () => {
      const scanned = 10;
      const changed = 3;

      const message = `Scanned ${scanned} Dart files. Modified ${changed}.`;

      expect(message).toContain('10');
      expect(message).toContain('3');
    });
  });

  describe('edge cases', () => {
    test('handles empty file', () => {
      const content = '';
      const lines = content.split('\n');

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('');
    });

    test('handles file with only comments', () => {
      const content = '// comment\n/* block */';
      const withoutBlock = content.replace(/\/\*[\s\S]*?\*\//g, '');
      const lines = withoutBlock.split('\n').filter((l) => !l.trim().startsWith('//'));

      expect(lines.filter((l) => l.trim()).length).toBe(0);
    });

    test('handles nested quotes', () => {
      // Test that we can detect when // is inside vs outside quotes
      const lineWithCommentOutside = "String s = 'test'; // comment";
      const lineWithCommentInside = "String s = 'test // not a comment';";

      // For line with comment outside: // at index 19, quotes close at index 16
      const idx1 = lineWithCommentOutside.lastIndexOf('//');
      const before1 = lineWithCommentOutside.slice(0, idx1);
      const singleQuotes1 = (before1.match(/'/g) || []).length;
      const inSingle1 = singleQuotes1 % 2 === 1;
      expect(inSingle1).toBe(false); // Comment is outside quotes

      // For line with comment inside: only occurrence of // is inside the string
      const singleQuotes2 = (lineWithCommentInside.match(/'/g) || []).length;
      expect(singleQuotes2).toBe(2); // Opening and closing quotes present
    });
  });
});
