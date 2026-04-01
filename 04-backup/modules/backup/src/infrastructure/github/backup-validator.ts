import type { GitHubAPI } from './GitHubAPI';
import type {
  FileVerificationResult,
  BackupValidationResult,
  ExpectedBackupFiles,
  GitHubFileInfoResponse,
} from './types';

export class BackupValidator {
  constructor(private readonly api: GitHubAPI) {}

  async verifyFileExists(
    path: string,
    expectedSha?: string
  ): Promise<FileVerificationResult> {
    const url = this.api.getContentsUrl(path);

    try {
      const response = await this.api.fetchRaw(url);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            exists: false,
            error: 'File not found (404)',
          };
        }
        return {
          exists: false,
          error: `GitHub API error ${response.status}`,
        };
      }

      const fileInfo = (await response.json()) as GitHubFileInfoResponse;

      if (expectedSha && fileInfo.sha !== expectedSha) {
        return {
          exists: true,
          ...(fileInfo.sha ? { sha: fileInfo.sha } : {}),
          ...(fileInfo.size !== undefined ? { size: fileInfo.size } : {}),
          error: `SHA mismatch: expected ${expectedSha}, got ${fileInfo.sha}`,
        };
      }

      if (fileInfo.size === 0) {
        return {
          exists: true,
          ...(fileInfo.sha ? { sha: fileInfo.sha } : {}),
          size: fileInfo.size,
          error: 'File is empty (0 bytes)',
        };
      }

      return {
        exists: true,
        ...(fileInfo.sha ? { sha: fileInfo.sha } : {}),
        ...(fileInfo.size !== undefined ? { size: fileInfo.size } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        exists: false,
        error: `Verification failed: ${message}`,
      };
    }
  }

  async validateBackup(
    date: string,
    clientName: string,
    expectedFiles: ExpectedBackupFiles
  ): Promise<BackupValidationResult> {
    console.log(
      `[BackupValidator] Validando backup ${clientName} (${date})...`
    );

    const basePath = `backups/${date}/${clientName}`;
    const errors: string[] = [];
    let filesValidated = 0;

    if (expectedFiles.firestore.manifest) {
      const manifestPath = `${basePath}/firestore/manifest.json`;
      const result = await this.verifyFileExists(manifestPath);
      if (!result.exists || result.error) {
        errors.push(
          `Firestore manifest validation failed: ${result.error || 'not found'}`
        );
      } else {
        filesValidated++;
        console.log(
          `[BackupValidator] Firestore manifest (${result.size} bytes)`
        );
      }
    }

    for (const collectionName of expectedFiles.firestore.collections) {
      const collectionPath = `${basePath}/firestore/collections/${collectionName}.json.gz`;
      const result = await this.verifyFileExists(collectionPath);
      if (!result.exists || result.error) {
        errors.push(
          `Firestore collection ${collectionName} validation failed: ${result.error || 'not found'}`
        );
      } else {
        filesValidated++;
        console.log(
          `[BackupValidator] Firestore ${collectionName} (${result.size} bytes)`
        );
      }
    }

    if (expectedFiles.storage.manifest) {
      const manifestPath = `${basePath}/storage/manifest.json`;
      const result = await this.verifyFileExists(manifestPath);
      if (!result.exists || result.error) {
        errors.push(
          `Storage manifest validation failed: ${result.error || 'not found'}`
        );
      } else {
        filesValidated++;
        console.log(
          `[BackupValidator] Storage manifest (${result.size} bytes)`
        );
      }
    }

    const filesToValidate = expectedFiles.storage.files.slice(0, 10);
    for (const filePath of filesToValidate) {
      const storagePath = `${basePath}/storage/files/${filePath}`;
      const result = await this.verifyFileExists(storagePath);
      if (!result.exists || result.error) {
        errors.push(
          `Storage file ${filePath} validation failed: ${result.error || 'not found'}`
        );
      } else {
        filesValidated++;
        console.log(
          `[BackupValidator] Storage ${filePath} (${result.size} bytes)`
        );
      }
    }

    if (expectedFiles.storage.files.length > 10) {
      console.log(
        `[BackupValidator] Storage validation: checked 10 of ${expectedFiles.storage.files.length} files (sample)`
      );
    }

    const valid = errors.length === 0;
    console.log(
      `[BackupValidator] Validacao ${valid ? 'SUCESSO' : 'FALHOU'}: ${filesValidated} arquivos, ${errors.length} erros`
    );

    return {
      valid,
      filesValidated,
      errors,
    };
  }
}
