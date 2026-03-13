/**
 * Tests for shared/validators/check-unused-files.js
 * Tests unused files checker using dart_code_linter
 */

const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: mockExecSync,
}));

const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

describe('check-unused-files', () => {
  let checkUnusedFiles;
  let consoleSpy;
  let consoleErrorSpy;
  let processExitSpy;
  let processChdirSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    processChdirSpy = jest.spyOn(process, 'chdir').mockImplementation(() => {});

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('');
    mockExecSync.mockReturnValue('');

    checkUnusedFiles = require('../../shared/validators/check-unused-files');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    processChdirSpy.mockRestore();
  });

  describe('checkFlutterProject()', () => {
    test('returns path when project exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = checkUnusedFiles.checkFlutterProject();

      expect(result).toContain('white_label_app');
    });

    test('exits when project not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      checkUnusedFiles.checkFlutterProject();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('exits when pubspec.yaml not found', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p.includes('white_label_app') && !p.includes('pubspec')) return true;
        return false;
      });

      checkUnusedFiles.checkFlutterProject();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('loadIgnoredFiles()', () => {
    test('returns empty array when no ignore file exists', () => {
      mockFs.existsSync.mockImplementation((p) => !p.includes('.unused-files-ignore'));

      const result = checkUnusedFiles.loadIgnoredFiles('/some/project');

      expect(result).toEqual([]);
    });

    test('parses ignore file correctly', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        '# Comment\nlib/firebase_options.dart\n\nlib/some_file.dart\n',
      );

      const result = checkUnusedFiles.loadIgnoredFiles('/some/project');

      expect(result).toEqual(['lib/firebase_options.dart', 'lib/some_file.dart']);
    });
  });

  describe('runUnusedFilesCheck()', () => {
    test('returns true when no unused files found in any project', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('no unused files found!\n');

      const result = checkUnusedFiles.runUnusedFilesCheck();

      expect(result).toBe(true);
    });

    test('returns false when unused files are found', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p.includes('.unused-files-ignore')) return false;
        return true;
      });

      const error = new Error('unused files found');
      error.stdout = '⚠ unused file: /full/path/to/project/lib/src/unused_file.dart\n';
      error.stderr = '';
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      const result = checkUnusedFiles.runUnusedFilesCheck();

      expect(result).toBe(false);
    });

    test('ignores files listed in .unused-files-ignore', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('lib/firebase_options.dart\n');

      mockExecSync.mockImplementation((cmd, opts) => {
        const error = new Error('unused files found');
        error.stdout = `⚠ unused file: ${opts.cwd}/lib/firebase_options.dart\n`;
        error.stderr = '';
        throw error;
      });

      const result = checkUnusedFiles.runUnusedFilesCheck();

      expect(result).toBe(true);
    });

    test('calls dart_code_linter for each project with lib/ directory', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('');

      checkUnusedFiles.runUnusedFilesCheck();

      expect(mockExecSync).toHaveBeenCalled();
      const calls = mockExecSync.mock.calls;
      calls.forEach((call) => {
        expect(call[0]).toBe('dart run dart_code_linter:metrics check-unused-files lib');
      });
    });

    test('skips projects without lib/ directory', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p.endsWith('/lib')) return false;
        return true;
      });

      const result = checkUnusedFiles.runUnusedFilesCheck();

      expect(result).toBe(true);
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('main()', () => {
    test('exits with 0 when all projects pass', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('');

      checkUnusedFiles.main();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    test('exits with 1 when Flutter project not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      checkUnusedFiles.main();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('exits with 1 when unused files found', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p.includes('.unused-files-ignore')) return false;
        return true;
      });

      const error = new Error('unused files');
      error.stdout = '⚠ unused file: /path/lib/src/dead_code.dart\n';
      error.stderr = '';
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      checkUnusedFiles.main();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('restores original directory on success', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('');

      checkUnusedFiles.main();

      expect(processChdirSpy).toHaveBeenCalledTimes(1);
    });
  });
});
