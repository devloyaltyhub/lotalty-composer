/**
 * Tests for shared/validators/check-unused-files.js
 * Tests unused files checker functionality
 */

const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: mockExecSync,
}));

const mockFs = {
  existsSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

describe('check-unused-files', () => {
  let checkUnusedFiles;
  let consoleSpy;
  let consoleErrorSpy;
  let processExitSpy;
  let processChdirSpy;
  let originalCwd;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    originalCwd = process.cwd();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    processChdirSpy = jest.spyOn(process, 'chdir').mockImplementation(() => {});

    mockFs.existsSync.mockReturnValue(true);
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

  describe('runUnusedFilesCheck()', () => {
    // Note: dart_code_metrics was removed from the project
    // This function is now a no-op that always returns true
    test('always returns true (dart_code_metrics removed)', () => {
      const result = checkUnusedFiles.runUnusedFilesCheck('/path/to/project');

      expect(result).toBe(true);
    });

    test('does not execute any commands (no-op)', () => {
      checkUnusedFiles.runUnusedFilesCheck('/path/to/project');

      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('main()', () => {
    // Note: Since dart_code_metrics was removed, main() now always succeeds
    // as long as the Flutter project structure is valid

    test('exits with 0 when Flutter project exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      checkUnusedFiles.main();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    test('exits with 1 when Flutter project not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      checkUnusedFiles.main();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('restores original directory on success', () => {
      mockFs.existsSync.mockReturnValue(true);

      checkUnusedFiles.main();

      // chdir called once: to restore original cwd after success
      expect(processChdirSpy).toHaveBeenCalledTimes(1);
    });

    test('restores original directory on project not found error', () => {
      // First call (white_label_app exists) returns false
      mockFs.existsSync.mockReturnValue(false);

      checkUnusedFiles.main();

      // process.exit is called before chdir in checkFlutterProject
      // but try/catch in main still calls chdir to restore
      expect(processChdirSpy).toHaveBeenCalled();
    });
  });
});
