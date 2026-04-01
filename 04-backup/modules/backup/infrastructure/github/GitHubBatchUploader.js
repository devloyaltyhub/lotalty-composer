"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubBatchUploader = void 0;
const file_preparers_1 = require("./file-preparers");
const backup_validator_1 = require("./backup-validator");
const GitHubAPI_1 = require("./GitHubAPI");
class GitHubBatchUploader {
    constructor(config) {
        this.config = config;
        this.api = new GitHubAPI_1.GitHubAPI(this.config);
        this.validator = new backup_validator_1.BackupValidator(this.api);
    }
    isConfigured() {
        return !!(this.config.token && this.config.owner && this.config.repo);
    }
    async uploadBackup(date, clientName, firestoreData, storageData) {
        console.log(`[GitHubBatchUploader] Iniciando upload para ${clientName}...`);
        if (!this.isConfigured()) {
            return {
                success: false,
                filesUploaded: 0,
                errors: ['GitHub nao configurado - verifique as variaveis de ambiente'],
                commits: [],
            };
        }
        const errors = [];
        const basePath = `backups/${date}/${clientName}`;
        const filesToUpload = [];
        try {
            const firestoreFiles = (0, file_preparers_1.prepareFirestoreFiles)(basePath, firestoreData);
            filesToUpload.push(...firestoreFiles);
            console.log(`[GitHubBatchUploader] Firestore: ${firestoreFiles.length} arquivos preparados`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Firestore preparation failed: ${message}`);
            console.error(`[GitHubBatchUploader] Firestore preparation error: ${message}`);
        }
        try {
            const storageFiles = (0, file_preparers_1.prepareStorageFiles)(basePath, storageData);
            filesToUpload.push(...storageFiles);
            console.log(`[GitHubBatchUploader] Storage: ${storageFiles.length} arquivos preparados`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Storage preparation failed: ${message}`);
            console.error(`[GitHubBatchUploader] Storage preparation error: ${message}`);
        }
        if (filesToUpload.length === 0) {
            return {
                success: false,
                filesUploaded: 0,
                errors: [...errors, 'Nenhum arquivo para upload'],
                commits: [],
            };
        }
        try {
            const commitMessage = `Backup ${clientName} - ${date} (${filesToUpload.length} arquivos)`;
            const commitSha = await this.api.createSingleCommit(filesToUpload, commitMessage);
            console.log(`[GitHubBatchUploader] Upload completo: ${filesToUpload.length} arquivos em 1 commit`);
            return {
                success: errors.length === 0,
                filesUploaded: filesToUpload.length,
                errors,
                commits: [commitSha],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Commit failed: ${message}`);
            console.error(`[GitHubBatchUploader] Commit error: ${message}`);
            return {
                success: false,
                filesUploaded: 0,
                errors,
                commits: [],
            };
        }
    }
    async testConnection() {
        if (!this.isConfigured()) {
            return false;
        }
        return this.api.testConnection();
    }
    async verifyFileExists(path, expectedSha) {
        return this.validator.verifyFileExists(path, expectedSha);
    }
    async validateBackup(date, clientName, expectedFiles) {
        return this.validator.validateBackup(date, clientName, expectedFiles);
    }
}
exports.GitHubBatchUploader = GitHubBatchUploader;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2l0SHViQmF0Y2hVcGxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9pbmZyYXN0cnVjdHVyZS9naXRodWIvR2l0SHViQmF0Y2hVcGxvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFRQSxxREFHMEI7QUFDMUIseURBQXFEO0FBRXJELDJDQUF3QztBQUd4QyxNQUFhLG1CQUFtQjtJQUs5QixZQUFZLE1BQXlCO1FBQ25DLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxxQkFBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksa0NBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVELFlBQVk7UUFDVixPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEUsQ0FBQztJQUVELEtBQUssQ0FBQyxZQUFZLENBQ2hCLElBQVksRUFDWixVQUFrQixFQUNsQixhQUFrQyxFQUNsQyxXQUE4QjtRQUU5QixPQUFPLENBQUMsR0FBRyxDQUFDLCtDQUErQyxVQUFVLEtBQUssQ0FBQyxDQUFDO1FBRTVFLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQztZQUN6QixPQUFPO2dCQUNMLE9BQU8sRUFBRSxLQUFLO2dCQUNkLGFBQWEsRUFBRSxDQUFDO2dCQUNoQixNQUFNLEVBQUUsQ0FBQyw2REFBNkQsQ0FBQztnQkFDdkUsT0FBTyxFQUFFLEVBQUU7YUFDWixDQUFDO1FBQ0osQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUM1QixNQUFNLFFBQVEsR0FBRyxX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O2FBQ1osQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLGNBQWM7UUFDbEIsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDO1lBQ3pCLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBRUQsS0FBSyxDQUFDLGdCQUFnQixDQUNwQixJQUFZLEVBQ1osV0FBb0I7UUFFcEIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRUQsS0FBSyxDQUFDLGNBQWMsQ0FDbEIsSUFBWSxFQUNaLFVBQWtCLEVBQ2xCLGFBQWtDO1FBRWxDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUN4RSxDQUFDO0NBQ0Y7QUF6SEQsa0RBeUhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUge1xuICBHaXRIdWJCYXRjaENvbmZpZyxcbiAgQmFja3VwVmFsaWRhdGlvblJlc3VsdCxcbiAgRXhwZWN0ZWRCYWNrdXBGaWxlcyxcbiAgRmlsZVRvVXBsb2FkLFxuICBGaWxlVmVyaWZpY2F0aW9uUmVzdWx0LFxuICBVcGxvYWRSZXN1bHQsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHtcbiAgcHJlcGFyZUZpcmVzdG9yZUZpbGVzLFxuICBwcmVwYXJlU3RvcmFnZUZpbGVzLFxufSBmcm9tICcuL2ZpbGUtcHJlcGFyZXJzJztcbmltcG9ydCB7IEJhY2t1cFZhbGlkYXRvciB9IGZyb20gJy4vYmFja3VwLXZhbGlkYXRvcic7XG5pbXBvcnQgdHlwZSB7IEZpcmVzdG9yZUJhY2t1cERhdGEgfSBmcm9tICcuLi9GaXJlc3RvcmVFeHBvcnRlcic7XG5pbXBvcnQgeyBHaXRIdWJBUEkgfSBmcm9tICcuL0dpdEh1YkFQSSc7XG5pbXBvcnQgdHlwZSB7IFN0b3JhZ2VCYWNrdXBEYXRhIH0gZnJvbSAnLi4vU3RvcmFnZUV4cG9ydGVyJztcblxuZXhwb3J0IGNsYXNzIEdpdEh1YkJhdGNoVXBsb2FkZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZzogR2l0SHViQmF0Y2hDb25maWc7XG4gIHByaXZhdGUgcmVhZG9ubHkgYXBpOiBHaXRIdWJBUEk7XG4gIHByaXZhdGUgcmVhZG9ubHkgdmFsaWRhdG9yOiBCYWNrdXBWYWxpZGF0b3I7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBHaXRIdWJCYXRjaENvbmZpZykge1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIHRoaXMuYXBpID0gbmV3IEdpdEh1YkFQSSh0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy52YWxpZGF0b3IgPSBuZXcgQmFja3VwVmFsaWRhdG9yKHRoaXMuYXBpKTtcbiAgfVxuXG4gIGlzQ29uZmlndXJlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gISEodGhpcy5jb25maWcudG9rZW4gJiYgdGhpcy5jb25maWcub3duZXIgJiYgdGhpcy5jb25maWcucmVwbyk7XG4gIH1cblxuICBhc3luYyB1cGxvYWRCYWNrdXAoXG4gICAgZGF0ZTogc3RyaW5nLFxuICAgIGNsaWVudE5hbWU6IHN0cmluZyxcbiAgICBmaXJlc3RvcmVEYXRhOiBGaXJlc3RvcmVCYWNrdXBEYXRhLFxuICAgIHN0b3JhZ2VEYXRhOiBTdG9yYWdlQmFja3VwRGF0YVxuICApOiBQcm9taXNlPFVwbG9hZFJlc3VsdD4ge1xuICAgIGNvbnNvbGUubG9nKGBbR2l0SHViQmF0Y2hVcGxvYWRlcl0gSW5pY2lhbmRvIHVwbG9hZCBwYXJhICR7Y2xpZW50TmFtZX0uLi5gKTtcblxuICAgIGlmICghdGhpcy5pc0NvbmZpZ3VyZWQoKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGZpbGVzVXBsb2FkZWQ6IDAsXG4gICAgICAgIGVycm9yczogWydHaXRIdWIgbmFvIGNvbmZpZ3VyYWRvIC0gdmVyaWZpcXVlIGFzIHZhcmlhdmVpcyBkZSBhbWJpZW50ZSddLFxuICAgICAgICBjb21taXRzOiBbXSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGJhc2VQYXRoID0gYGJhY2t1cHMvJHtkYXRlfS8ke2NsaWVudE5hbWV9YDtcbiAgICBjb25zdCBmaWxlc1RvVXBsb2FkOiBGaWxlVG9VcGxvYWRbXSA9IFtdO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGZpcmVzdG9yZUZpbGVzID0gcHJlcGFyZUZpcmVzdG9yZUZpbGVzKGJhc2VQYXRoLCBmaXJlc3RvcmVEYXRhKTtcbiAgICAgIGZpbGVzVG9VcGxvYWQucHVzaCguLi5maXJlc3RvcmVGaWxlcyk7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYFtHaXRIdWJCYXRjaFVwbG9hZGVyXSBGaXJlc3RvcmU6ICR7ZmlyZXN0b3JlRmlsZXMubGVuZ3RofSBhcnF1aXZvcyBwcmVwYXJhZG9zYFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InO1xuICAgICAgZXJyb3JzLnB1c2goYEZpcmVzdG9yZSBwcmVwYXJhdGlvbiBmYWlsZWQ6ICR7bWVzc2FnZX1gKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFtHaXRIdWJCYXRjaFVwbG9hZGVyXSBGaXJlc3RvcmUgcHJlcGFyYXRpb24gZXJyb3I6ICR7bWVzc2FnZX1gKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3RvcmFnZUZpbGVzID0gcHJlcGFyZVN0b3JhZ2VGaWxlcyhiYXNlUGF0aCwgc3RvcmFnZURhdGEpO1xuICAgICAgZmlsZXNUb1VwbG9hZC5wdXNoKC4uLnN0b3JhZ2VGaWxlcyk7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYFtHaXRIdWJCYXRjaFVwbG9hZGVyXSBTdG9yYWdlOiAke3N0b3JhZ2VGaWxlcy5sZW5ndGh9IGFycXVpdm9zIHByZXBhcmFkb3NgXG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcic7XG4gICAgICBlcnJvcnMucHVzaChgU3RvcmFnZSBwcmVwYXJhdGlvbiBmYWlsZWQ6ICR7bWVzc2FnZX1gKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFtHaXRIdWJCYXRjaFVwbG9hZGVyXSBTdG9yYWdlIHByZXBhcmF0aW9uIGVycm9yOiAke21lc3NhZ2V9YCk7XG4gICAgfVxuXG4gICAgaWYgKGZpbGVzVG9VcGxvYWQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZmlsZXNVcGxvYWRlZDogMCxcbiAgICAgICAgZXJyb3JzOiBbLi4uZXJyb3JzLCAnTmVuaHVtIGFycXVpdm8gcGFyYSB1cGxvYWQnXSxcbiAgICAgICAgY29tbWl0czogW10sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb21taXRNZXNzYWdlID0gYEJhY2t1cCAke2NsaWVudE5hbWV9IC0gJHtkYXRlfSAoJHtmaWxlc1RvVXBsb2FkLmxlbmd0aH0gYXJxdWl2b3MpYDtcbiAgICAgIGNvbnN0IGNvbW1pdFNoYSA9IGF3YWl0IHRoaXMuYXBpLmNyZWF0ZVNpbmdsZUNvbW1pdChcbiAgICAgICAgZmlsZXNUb1VwbG9hZCxcbiAgICAgICAgY29tbWl0TWVzc2FnZVxuICAgICAgKTtcblxuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbR2l0SHViQmF0Y2hVcGxvYWRlcl0gVXBsb2FkIGNvbXBsZXRvOiAke2ZpbGVzVG9VcGxvYWQubGVuZ3RofSBhcnF1aXZvcyBlbSAxIGNvbW1pdGBcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICAgIGZpbGVzVXBsb2FkZWQ6IGZpbGVzVG9VcGxvYWQubGVuZ3RoLFxuICAgICAgICBlcnJvcnMsXG4gICAgICAgIGNvbW1pdHM6IFtjb21taXRTaGFdLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InO1xuICAgICAgZXJyb3JzLnB1c2goYENvbW1pdCBmYWlsZWQ6ICR7bWVzc2FnZX1gKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFtHaXRIdWJCYXRjaFVwbG9hZGVyXSBDb21taXQgZXJyb3I6ICR7bWVzc2FnZX1gKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGZpbGVzVXBsb2FkZWQ6IDAsXG4gICAgICAgIGVycm9ycyxcbiAgICAgICAgY29tbWl0czogW10sXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICghdGhpcy5pc0NvbmZpZ3VyZWQoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hcGkudGVzdENvbm5lY3Rpb24oKTtcbiAgfVxuXG4gIGFzeW5jIHZlcmlmeUZpbGVFeGlzdHMoXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIGV4cGVjdGVkU2hhPzogc3RyaW5nXG4gICk6IFByb21pc2U8RmlsZVZlcmlmaWNhdGlvblJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLnZhbGlkYXRvci52ZXJpZnlGaWxlRXhpc3RzKHBhdGgsIGV4cGVjdGVkU2hhKTtcbiAgfVxuXG4gIGFzeW5jIHZhbGlkYXRlQmFja3VwKFxuICAgIGRhdGU6IHN0cmluZyxcbiAgICBjbGllbnROYW1lOiBzdHJpbmcsXG4gICAgZXhwZWN0ZWRGaWxlczogRXhwZWN0ZWRCYWNrdXBGaWxlc1xuICApOiBQcm9taXNlPEJhY2t1cFZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy52YWxpZGF0b3IudmFsaWRhdGVCYWNrdXAoZGF0ZSwgY2xpZW50TmFtZSwgZXhwZWN0ZWRGaWxlcyk7XG4gIH1cbn1cbiJdfQ==