"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupValidator = void 0;
class BackupValidator {
    constructor(api) {
        this.api = api;
    }
    async verifyFileExists(path, expectedSha) {
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
            const fileInfo = (await response.json());
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                exists: false,
                error: `Verification failed: ${message}`,
            };
        }
    }
    async validateBackup(date, clientName, expectedFiles) {
        console.log(`[BackupValidator] Validando backup ${clientName} (${date})...`);
        const basePath = `backups/${date}/${clientName}`;
        const errors = [];
        let filesValidated = 0;
        if (expectedFiles.firestore.manifest) {
            const manifestPath = `${basePath}/firestore/manifest.json`;
            const result = await this.verifyFileExists(manifestPath);
            if (!result.exists || result.error) {
                errors.push(`Firestore manifest validation failed: ${result.error || 'not found'}`);
            }
            else {
                filesValidated++;
                console.log(`[BackupValidator] Firestore manifest (${result.size} bytes)`);
            }
        }
        for (const collectionName of expectedFiles.firestore.collections) {
            const collectionPath = `${basePath}/firestore/collections/${collectionName}.json.gz`;
            const result = await this.verifyFileExists(collectionPath);
            if (!result.exists || result.error) {
                errors.push(`Firestore collection ${collectionName} validation failed: ${result.error || 'not found'}`);
            }
            else {
                filesValidated++;
                console.log(`[BackupValidator] Firestore ${collectionName} (${result.size} bytes)`);
            }
        }
        if (expectedFiles.storage.manifest) {
            const manifestPath = `${basePath}/storage/manifest.json`;
            const result = await this.verifyFileExists(manifestPath);
            if (!result.exists || result.error) {
                errors.push(`Storage manifest validation failed: ${result.error || 'not found'}`);
            }
            else {
                filesValidated++;
                console.log(`[BackupValidator] Storage manifest (${result.size} bytes)`);
            }
        }
        const filesToValidate = expectedFiles.storage.files.slice(0, 10);
        for (const filePath of filesToValidate) {
            const storagePath = `${basePath}/storage/files/${filePath}`;
            const result = await this.verifyFileExists(storagePath);
            if (!result.exists || result.error) {
                errors.push(`Storage file ${filePath} validation failed: ${result.error || 'not found'}`);
            }
            else {
                filesValidated++;
                console.log(`[BackupValidator] Storage ${filePath} (${result.size} bytes)`);
            }
        }
        if (expectedFiles.storage.files.length > 10) {
            console.log(`[BackupValidator] Storage validation: checked 10 of ${expectedFiles.storage.files.length} files (sample)`);
        }
        const valid = errors.length === 0;
        console.log(`[BackupValidator] Validacao ${valid ? 'SUCESSO' : 'FALHOU'}: ${filesValidated} arquivos, ${errors.length} erros`);
        return {
            valid,
            filesValidated,
            errors,
        };
    }
}
exports.BackupValidator = BackupValidator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja3VwLXZhbGlkYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9pbmZyYXN0cnVjdHVyZS9naXRodWIvYmFja3VwLXZhbGlkYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFRQSxNQUFhLGVBQWU7SUFDMUIsWUFBNkIsR0FBYztRQUFkLFFBQUcsR0FBSCxHQUFHLENBQVc7SUFBRyxDQUFDO0lBRS9DLEtBQUssQ0FBQyxnQkFBZ0IsQ0FDcEIsSUFBWSxFQUNaLFdBQW9CO1FBRXBCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTFDLElBQUksQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFOUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDakIsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO29CQUM1QixPQUFPO3dCQUNMLE1BQU0sRUFBRSxLQUFLO3dCQUNiLEtBQUssRUFBRSxzQkFBc0I7cUJBQzlCLENBQUM7Z0JBQ0osQ0FBQztnQkFDRCxPQUFPO29CQUNMLE1BQU0sRUFBRSxLQUFLO29CQUNiLEtBQUssRUFBRSxvQkFBb0IsUUFBUSxDQUFDLE1BQU0sRUFBRTtpQkFDN0MsQ0FBQztZQUNKLENBQUM7WUFFRCxNQUFNLFFBQVEsR0FBRyxDQUFDLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUEyQixDQUFDO1lBRW5FLElBQUksV0FBVyxJQUFJLFFBQVEsQ0FBQyxHQUFHLEtBQUssV0FBVyxFQUFFLENBQUM7Z0JBQ2hELE9BQU87b0JBQ0wsTUFBTSxFQUFFLElBQUk7b0JBQ1osR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FB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QU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3hELElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDbkMsTUFBTSxDQUFDLElBQUksQ0FDVCxnQkFBZ0IsUUFBUSx1QkFBdUIsTUFBTSxDQUFDLEtBQUssSUFBSSxXQUFXLEVBQUUsQ0FDN0UsQ0FBQztZQUNKLENBQUM7aUJBQU0sQ0FBQztnQkFDTixjQUFjLEVBQUUsQ0FBQztnQkFDakIsT0FBTyxDQUFDLEdBQUcsQ0FDVCw2QkFBNkIsUUFBUSxLQUFLLE1BQU0sQ0FBQyxJQUFJLFNBQVMsQ0FDL0QsQ0FBQztZQUNKLENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDNUMsT0FBTyxDQUFDLEdBQUcsQ0FDVCx1REFBdUQsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxpQkFBaUIsQ0FDM0csQ0FBQztRQUNKLENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztRQUNsQyxPQUFPLENBQUMsR0FBRyxDQUNULCtCQUErQixLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxLQUFLLGNBQWMsY0FBYyxNQUFNLENBQUMsTUFBTSxRQUFRLENBQ2xILENBQUM7UUFFRixPQUFPO1lBQ0wsS0FBSztZQUNMLGNBQWM7WUFDZCxNQUFNO1NBQ1AsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXRKRCwwQ0FzSkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IEdpdEh1YkFQSSB9IGZyb20gJy4vR2l0SHViQVBJJztcbmltcG9ydCB0eXBlIHtcbiAgRmlsZVZlcmlmaWNhdGlvblJlc3VsdCxcbiAgQmFja3VwVmFsaWRhdGlvblJlc3VsdCxcbiAgRXhwZWN0ZWRCYWNrdXBGaWxlcyxcbiAgR2l0SHViRmlsZUluZm9SZXNwb25zZSxcbn0gZnJvbSAnLi90eXBlcyc7XG5cbmV4cG9ydCBjbGFzcyBCYWNrdXBWYWxpZGF0b3Ige1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGFwaTogR2l0SHViQVBJKSB7fVxuXG4gIGFzeW5jIHZlcmlmeUZpbGVFeGlzdHMoXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIGV4cGVjdGVkU2hhPzogc3RyaW5nXG4gICk6IFByb21pc2U8RmlsZVZlcmlmaWNhdGlvblJlc3VsdD4ge1xuICAgIGNvbnN0IHVybCA9IHRoaXMuYXBpLmdldENvbnRlbnRzVXJsKHBhdGgpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5hcGkuZmV0Y2hSYXcodXJsKTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZXhpc3RzOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiAnRmlsZSBub3QgZm91bmQgKDQwNCknLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBleGlzdHM6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiBgR2l0SHViIEFQSSBlcnJvciAke3Jlc3BvbnNlLnN0YXR1c31gLFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBjb25zdCBmaWxlSW5mbyA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIEdpdEh1YkZpbGVJbmZvUmVzcG9uc2U7XG5cbiAgICAgIGlmIChleHBlY3RlZFNoYSAmJiBmaWxlSW5mby5zaGEgIT09IGV4cGVjdGVkU2hhKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZXhpc3RzOiB0cnVlLFxuICAgICAgICAgIC4uLihmaWxlSW5mby5zaGEgPyB7IHNoYTogZmlsZUluZm8uc2hhIH0gOiB7fSksXG4gICAgICAgICAgLi4uKGZpbGVJbmZvLnNpemUgIT09IHVuZGVmaW5lZCA/IHsgc2l6ZTogZmlsZUluZm8uc2l6ZSB9IDoge30pLFxuICAgICAgICAgIGVycm9yOiBgU0hBIG1pc21hdGNoOiBleHBlY3RlZCAke2V4cGVjdGVkU2hhfSwgZ290ICR7ZmlsZUluZm8uc2hhfWAsXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIGlmIChmaWxlSW5mby5zaXplID09PSAwKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgZXhpc3RzOiB0cnVlLFxuICAgICAgICAgIC4uLihmaWxlSW5mby5zaGEgPyB7IHNoYTogZmlsZUluZm8uc2hhIH0gOiB7fSksXG4gICAgICAgICAgc2l6ZTogZmlsZUluZm8uc2l6ZSxcbiAgICAgICAgICBlcnJvcjogJ0ZpbGUgaXMgZW1wdHkgKDAgYnl0ZXMpJyxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZXhpc3RzOiB0cnVlLFxuICAgICAgICAuLi4oZmlsZUluZm8uc2hhID8geyBzaGE6IGZpbGVJbmZvLnNoYSB9IDoge30pLFxuICAgICAgICAuLi4oZmlsZUluZm8uc2l6ZSAhPT0gdW5kZWZpbmVkID8geyBzaXplOiBmaWxlSW5mby5zaXplIH0gOiB7fSksXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcic7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBleGlzdHM6IGZhbHNlLFxuICAgICAgICBlcnJvcjogYFZlcmlmaWNhdGlvbiBmYWlsZWQ6ICR7bWVzc2FnZX1gLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBhc3luYyB2YWxpZGF0ZUJhY2t1cChcbiAgICBkYXRlOiBzdHJpbmcsXG4gICAgY2xpZW50TmFtZTogc3RyaW5nLFxuICAgIGV4cGVjdGVkRmlsZXM6IEV4cGVjdGVkQmFja3VwRmlsZXNcbiAgKTogUHJvbWlzZTxCYWNrdXBWYWxpZGF0aW9uUmVzdWx0PiB7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0JhY2t1cFZhbGlkYXRvcl0gVmFsaWRhbmRvIGJhY2t1cCAke2NsaWVudE5hbWV9ICgke2RhdGV9KS4uLmBcbiAgICApO1xuXG4gICAgY29uc3QgYmFzZVBhdGggPSBgYmFja3Vwcy8ke2RhdGV9LyR7Y2xpZW50TmFtZX1gO1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgZmlsZXNWYWxpZGF0ZWQgPSAwO1xuXG4gICAgaWYgKGV4cGVjdGVkRmlsZXMuZmlyZXN0b3JlLm1hbmlmZXN0KSB7XG4gICAgICBjb25zdCBtYW5pZmVzdFBhdGggPSBgJHtiYXNlUGF0aH0vZmlyZXN0b3JlL21hbmlmZXN0Lmpzb25gO1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy52ZXJpZnlGaWxlRXhpc3RzKG1hbmlmZXN0UGF0aCk7XG4gICAgICBpZiAoIXJlc3VsdC5leGlzdHMgfHwgcmVzdWx0LmVycm9yKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIGBGaXJlc3RvcmUgbWFuaWZlc3QgdmFsaWRhdGlvbiBmYWlsZWQ6ICR7cmVzdWx0LmVycm9yIHx8ICdub3QgZm91bmQnfWBcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpbGVzVmFsaWRhdGVkKys7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbQmFja3VwVmFsaWRhdG9yXSBGaXJlc3RvcmUgbWFuaWZlc3QgKCR7cmVzdWx0LnNpemV9IGJ5dGVzKWBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNvbGxlY3Rpb25OYW1lIG9mIGV4cGVjdGVkRmlsZXMuZmlyZXN0b3JlLmNvbGxlY3Rpb25zKSB7XG4gICAgICBjb25zdCBjb2xsZWN0aW9uUGF0aCA9IGAke2Jhc2VQYXRofS9maXJlc3RvcmUvY29sbGVjdGlvbnMvJHtjb2xsZWN0aW9uTmFtZX0uanNvbi5nemA7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnZlcmlmeUZpbGVFeGlzdHMoY29sbGVjdGlvblBhdGgpO1xuICAgICAgaWYgKCFyZXN1bHQuZXhpc3RzIHx8IHJlc3VsdC5lcnJvcikge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICBgRmlyZXN0b3JlIGNvbGxlY3Rpb24gJHtjb2xsZWN0aW9uTmFtZX0gdmFsaWRhdGlvbiBmYWlsZWQ6ICR7cmVzdWx0LmVycm9yIHx8ICdub3QgZm91bmQnfWBcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpbGVzVmFsaWRhdGVkKys7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbQmFja3VwVmFsaWRhdG9yXSBGaXJlc3RvcmUgJHtjb2xsZWN0aW9uTmFtZX0gKCR7cmVzdWx0LnNpemV9IGJ5dGVzKWBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZXhwZWN0ZWRGaWxlcy5zdG9yYWdlLm1hbmlmZXN0KSB7XG4gICAgICBjb25zdCBtYW5pZmVzdFBhdGggPSBgJHtiYXNlUGF0aH0vc3RvcmFnZS9tYW5pZmVzdC5qc29uYDtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudmVyaWZ5RmlsZUV4aXN0cyhtYW5pZmVzdFBhdGgpO1xuICAgICAgaWYgKCFyZXN1bHQuZXhpc3RzIHx8IHJlc3VsdC5lcnJvcikge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICBgU3RvcmFnZSBtYW5pZmVzdCB2YWxpZGF0aW9uIGZhaWxlZDogJHtyZXN1bHQuZXJyb3IgfHwgJ25vdCBmb3VuZCd9YFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZXNWYWxpZGF0ZWQrKztcbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYFtCYWNrdXBWYWxpZGF0b3JdIFN0b3JhZ2UgbWFuaWZlc3QgKCR7cmVzdWx0LnNpemV9IGJ5dGVzKWBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBmaWxlc1RvVmFsaWRhdGUgPSBleHBlY3RlZEZpbGVzLnN0b3JhZ2UuZmlsZXMuc2xpY2UoMCwgMTApO1xuICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgZmlsZXNUb1ZhbGlkYXRlKSB7XG4gICAgICBjb25zdCBzdG9yYWdlUGF0aCA9IGAke2Jhc2VQYXRofS9zdG9yYWdlL2ZpbGVzLyR7ZmlsZVBhdGh9YDtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudmVyaWZ5RmlsZUV4aXN0cyhzdG9yYWdlUGF0aCk7XG4gICAgICBpZiAoIXJlc3VsdC5leGlzdHMgfHwgcmVzdWx0LmVycm9yKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgIGBTdG9yYWdlIGZpbGUgJHtmaWxlUGF0aH0gdmFsaWRhdGlvbiBmYWlsZWQ6ICR7cmVzdWx0LmVycm9yIHx8ICdub3QgZm91bmQnfWBcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpbGVzVmFsaWRhdGVkKys7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbQmFja3VwVmFsaWRhdG9yXSBTdG9yYWdlICR7ZmlsZVBhdGh9ICgke3Jlc3VsdC5zaXplfSBieXRlcylgXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGV4cGVjdGVkRmlsZXMuc3RvcmFnZS5maWxlcy5sZW5ndGggPiAxMCkge1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbQmFja3VwVmFsaWRhdG9yXSBTdG9yYWdlIHZhbGlkYXRpb246IGNoZWNrZWQgMTAgb2YgJHtleHBlY3RlZEZpbGVzLnN0b3JhZ2UuZmlsZXMubGVuZ3RofSBmaWxlcyAoc2FtcGxlKWBcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgdmFsaWQgPSBlcnJvcnMubGVuZ3RoID09PSAwO1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtCYWNrdXBWYWxpZGF0b3JdIFZhbGlkYWNhbyAke3ZhbGlkID8gJ1NVQ0VTU08nIDogJ0ZBTEhPVSd9OiAke2ZpbGVzVmFsaWRhdGVkfSBhcnF1aXZvcywgJHtlcnJvcnMubGVuZ3RofSBlcnJvc2BcbiAgICApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHZhbGlkLFxuICAgICAgZmlsZXNWYWxpZGF0ZWQsXG4gICAgICBlcnJvcnMsXG4gICAgfTtcbiAgfVxufVxuIl19