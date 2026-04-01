"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageExporter = void 0;
const storage_1 = require("firebase-admin/storage");
const storage_2 = require("@google-cloud/storage");
class StorageExporter {
    constructor(projectId, getFirebaseApp, maxFileSizeMB = 50) {
        this.projectId = projectId;
        this.getFirebaseApp = getFirebaseApp;
        this.maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    }
    async exportAllFiles() {
        console.log(`[StorageExporter] Iniciando export para ${this.projectId}...`);
        const app = this.getFirebaseApp(this.projectId);
        if (!app) {
            throw new Error(`Firebase app not found for projectId: ${this.projectId}`);
        }
        // Fix: Use Google Cloud Storage client directly with credentials
        let bucket;
        try {
            // Check if GOOGLE_APPLICATION_CREDENTIALS is set
            const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (credPath) {
                console.log(`[StorageExporter] Using credentials from: ${credPath}`);
                // Initialize GCS client directly with credentials
                const gcsStorage = new storage_2.Storage({
                    projectId: this.projectId,
                    keyFilename: credPath
                });
                const bucketName = app.options.storageBucket || `${this.projectId}.firebasestorage.app`;
                console.log(`[StorageExporter] Using bucket: ${bucketName}`);
                bucket = gcsStorage.bucket(bucketName);
            }
            else {
                // Fallback to Firebase Admin SDK storage (might not work without proper setup)
                console.log(`[StorageExporter] Warning: GOOGLE_APPLICATION_CREDENTIALS not set, trying Firebase Admin SDK`);
                const storage = (0, storage_1.getStorage)(app);
                const bucketName = app.options.storageBucket || `${this.projectId}.firebasestorage.app`;
                bucket = storage.bucket(bucketName);
            }
        }
        catch (storageError) {
            console.error(`[StorageExporter] Failed to initialize storage:`, storageError);
            throw storageError;
        }
        try {
            const [files] = await bucket.getFiles();
            console.log(`[StorageExporter] Encontrados ${files.length} arquivos`);
            const exportedFiles = [];
            let totalSize = 0;
            let skippedFiles = 0;
            for (const file of files) {
                const fileBackup = await this.exportFile(file);
                exportedFiles.push(fileBackup);
                totalSize += fileBackup.size;
                if (fileBackup.skipped) {
                    skippedFiles++;
                }
            }
            const result = {
                exportedAt: new Date().toISOString(),
                projectId: this.projectId,
                files: exportedFiles,
                stats: {
                    totalFiles: files.length,
                    totalSize,
                    skippedFiles,
                },
            };
            console.log(`[StorageExporter] Export completo: ${files.length} arquivos (${skippedFiles} pulados por tamanho)`);
            return result;
        }
        catch (error) {
            const message = error?.message || 'Unknown error';
            console.error(`[StorageExporter] Erro no export: ${message}`);
            throw error;
        }
    }
    async exportFile(file) {
        const [metadata] = await file.getMetadata();
        const size = parseInt(metadata.size, 10);
        const isLarge = size > this.maxFileSizeBytes;
        if (isLarge) {
            console.log(`[StorageExporter] Pulando arquivo grande: ${file.name} (${this.formatSize(size)})`);
            return {
                path: file.name,
                contentType: metadata.contentType || 'application/octet-stream',
                size,
                updatedAt: metadata.updated,
                skipped: true,
                skipReason: `File too large: ${this.formatSize(size)} > ${this.formatSize(this.maxFileSizeBytes)}`,
            };
        }
        try {
            const [content] = await file.download();
            return {
                path: file.name,
                contentType: metadata.contentType || 'application/octet-stream',
                size,
                updatedAt: metadata.updated,
                content,
            };
        }
        catch (error) {
            const message = error?.message || 'Unknown error';
            console.error(`[StorageExporter] Erro ao baixar ${file.name}: ${message}`);
            return {
                path: file.name,
                contentType: metadata.contentType || 'application/octet-stream',
                size,
                updatedAt: metadata.updated,
                skipped: true,
                skipReason: `Download failed: ${message}`,
            };
        }
    }
    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}
exports.StorageExporter = StorageExporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RvcmFnZUV4cG9ydGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2luZnJhc3RydWN0dXJlL1N0b3JhZ2VFeHBvcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxvREFBb0Q7QUFDcEQsbURBQWdEO0FBdUJoRCxNQUFhLGVBQWU7SUFLMUIsWUFDRSxTQUFpQixFQUNqQixjQUFzRCxFQUN0RCxnQkFBd0IsRUFBRTtRQUUxQixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztRQUMzQixJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsYUFBYSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7SUFDdEQsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjO1FBQ2xCLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkNBQTJDLElBQUksQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDO1FBRTVFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNULE1BQU0sSUFBSSxLQUFLLENBQ2IseUNBQXlDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FDMUQsQ0FBQztRQUNKLENBQUM7UUFFRCxpRUFBaUU7UUFDakUsSUFBSSxNQUFNLENBQUM7UUFDWCxJQUFJLENBQUM7WUFDSCxpREFBaUQ7WUFDakQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQztZQUM1RCxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUNiLE9BQU8sQ0FBQyxHQUFHLENBQUMsNkNBQTZDLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQ3JFLGtEQUFrRDtnQkFDbEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxpQkFBTyxDQUFDO29CQUM3QixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7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QUNKLFNBQVMsRUFBRSxRQUFRLENBQUMsT0FBTztnQkFDM0IsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsVUFBVSxFQUFFLG9CQUFvQixPQUFPLEVBQUU7YUFDMUMsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0lBRU8sVUFBVSxDQUFDLEtBQWE7UUFDOUIsTUFBTSxLQUFLLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN0QyxJQUFJLElBQUksR0FBRyxLQUFLLENBQUM7UUFDakIsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBRWxCLE9BQU8sSUFBSSxJQUFJLElBQUksSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNwRCxJQUFJLElBQUksSUFBSSxDQUFDO1lBQ2IsU0FBUyxFQUFFLENBQUM7UUFDZCxDQUFDO1FBRUQsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBeEpELDBDQXdKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgQXBwIH0gZnJvbSAnZmlyZWJhc2UtYWRtaW4vYXBwJztcbmltcG9ydCB7IGdldFN0b3JhZ2UgfSBmcm9tICdmaXJlYmFzZS1hZG1pbi9zdG9yYWdlJztcbmltcG9ydCB7IFN0b3JhZ2UgfSBmcm9tICdAZ29vZ2xlLWNsb3VkL3N0b3JhZ2UnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFN0b3JhZ2VCYWNrdXBEYXRhIHtcbiAgZXhwb3J0ZWRBdDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgZmlsZXM6IFN0b3JhZ2VGaWxlQmFja3VwW107XG4gIHN0YXRzOiB7XG4gICAgdG90YWxGaWxlczogbnVtYmVyO1xuICAgIHRvdGFsU2l6ZTogbnVtYmVyO1xuICAgIHNraXBwZWRGaWxlczogbnVtYmVyO1xuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0b3JhZ2VGaWxlQmFja3VwIHtcbiAgcGF0aDogc3RyaW5nO1xuICBjb250ZW50VHlwZTogc3RyaW5nO1xuICBzaXplOiBudW1iZXI7XG4gIHVwZGF0ZWRBdDogc3RyaW5nO1xuICBjb250ZW50PzogQnVmZmVyO1xuICBza2lwcGVkPzogYm9vbGVhbjtcbiAgc2tpcFJlYXNvbj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFN0b3JhZ2VFeHBvcnRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgcHJvamVjdElkOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVhZG9ubHkgbWF4RmlsZVNpemVCeXRlczogbnVtYmVyO1xuICBwcml2YXRlIHJlYWRvbmx5IGdldEZpcmViYXNlQXBwOiAocHJvamVjdElkOiBzdHJpbmcpID0+IEFwcCB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBnZXRGaXJlYmFzZUFwcDogKHByb2plY3RJZDogc3RyaW5nKSA9PiBBcHAgfCB1bmRlZmluZWQsXG4gICAgbWF4RmlsZVNpemVNQjogbnVtYmVyID0gNTBcbiAgKSB7XG4gICAgdGhpcy5wcm9qZWN0SWQgPSBwcm9qZWN0SWQ7XG4gICAgdGhpcy5nZXRGaXJlYmFzZUFwcCA9IGdldEZpcmViYXNlQXBwO1xuICAgIHRoaXMubWF4RmlsZVNpemVCeXRlcyA9IG1heEZpbGVTaXplTUIgKiAxMDI0ICogMTAyNDtcbiAgfVxuXG4gIGFzeW5jIGV4cG9ydEFsbEZpbGVzKCk6IFByb21pc2U8U3RvcmFnZUJhY2t1cERhdGE+IHtcbiAgICBjb25zb2xlLmxvZyhgW1N0b3JhZ2VFeHBvcnRlcl0gSW5pY2lhbmRvIGV4cG9ydCBwYXJhICR7dGhpcy5wcm9qZWN0SWR9Li4uYCk7XG5cbiAgICBjb25zdCBhcHAgPSB0aGlzLmdldEZpcmViYXNlQXBwKHRoaXMucHJvamVjdElkKTtcbiAgICBpZiAoIWFwcCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRmlyZWJhc2UgYXBwIG5vdCBmb3VuZCBmb3IgcHJvamVjdElkOiAke3RoaXMucHJvamVjdElkfWBcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gRml4OiBVc2UgR29vZ2xlIENsb3VkIFN0b3JhZ2UgY2xpZW50IGRpcmVjdGx5IHdpdGggY3JlZGVudGlhbHNcbiAgICBsZXQgYnVja2V0O1xuICAgIHRyeSB7XG4gICAgICAvLyBDaGVjayBpZiBHT09HTEVfQVBQTElDQVRJT05fQ1JFREVOVElBTFMgaXMgc2V0XG4gICAgICBjb25zdCBjcmVkUGF0aCA9IHByb2Nlc3MuZW52LkdPT0dMRV9BUFBMSUNBVElPTl9DUkVERU5USUFMUztcbiAgICAgIGlmIChjcmVkUGF0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1N0b3JhZ2VFeHBvcnRlcl0gVXNpbmcgY3JlZGVudGlhbHMgZnJvbTogJHtjcmVkUGF0aH1gKTtcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBHQ1MgY2xpZW50IGRpcmVjdGx5IHdpdGggY3JlZGVudGlhbHNcbiAgICAgICAgY29uc3QgZ2NzU3RvcmFnZSA9IG5ldyBTdG9yYWdlKHtcbiAgICAgICAgICBwcm9qZWN0SWQ6IHRoaXMucHJvamVjdElkLFxuICAgICAgICAgIGtleUZpbGVuYW1lOiBjcmVkUGF0aFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgYnVja2V0TmFtZSA9IGFwcC5vcHRpb25zLnN0b3JhZ2VCdWNrZXQgfHwgYCR7dGhpcy5wcm9qZWN0SWR9LmZpcmViYXNlc3RvcmFnZS5hcHBgO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1N0b3JhZ2VFeHBvcnRlcl0gVXNpbmcgYnVja2V0OiAke2J1Y2tldE5hbWV9YCk7XG4gICAgICAgIGJ1Y2tldCA9IGdjc1N0b3JhZ2UuYnVja2V0KGJ1Y2tldE5hbWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRmFsbGJhY2sgdG8gRmlyZWJhc2UgQWRtaW4gU0RLIHN0b3JhZ2UgKG1pZ2h0IG5vdCB3b3JrIHdpdGhvdXQgcHJvcGVyIHNldHVwKVxuICAgICAgICBjb25zb2xlLmxvZyhgW1N0b3JhZ2VFeHBvcnRlcl0gV2FybmluZzogR09PR0xFX0FQUExJQ0FUSU9OX0NSRURFTlRJQUxTIG5vdCBzZXQsIHRyeWluZyBGaXJlYmFzZSBBZG1pbiBTREtgKTtcbiAgICAgICAgY29uc3Qgc3RvcmFnZSA9IGdldFN0b3JhZ2UoYXBwKTtcbiAgICAgICAgY29uc3QgYnVja2V0TmFtZSA9IGFwcC5vcHRpb25zLnN0b3JhZ2VCdWNrZXQgfHwgYCR7dGhpcy5wcm9qZWN0SWR9LmZpcmViYXNlc3RvcmFnZS5hcHBgO1xuICAgICAgICBidWNrZXQgPSBzdG9yYWdlLmJ1Y2tldChidWNrZXROYW1lKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChzdG9yYWdlRXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFtTdG9yYWdlRXhwb3J0ZXJdIEZhaWxlZCB0byBpbml0aWFsaXplIHN0b3JhZ2U6YCwgc3RvcmFnZUVycm9yKTtcbiAgICAgIHRocm93IHN0b3JhZ2VFcnJvcjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgW2ZpbGVzXSA9IGF3YWl0IGJ1Y2tldC5nZXRGaWxlcygpO1xuICAgICAgY29uc29sZS5sb2coYFtTdG9yYWdlRXhwb3J0ZXJdIEVuY29udHJhZG9zICR7ZmlsZXMubGVuZ3RofSBhcnF1aXZvc2ApO1xuXG4gICAgICBjb25zdCBleHBvcnRlZEZpbGVzOiBTdG9yYWdlRmlsZUJhY2t1cFtdID0gW107XG4gICAgICBsZXQgdG90YWxTaXplID0gMDtcbiAgICAgIGxldCBza2lwcGVkRmlsZXMgPSAwO1xuXG4gICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgY29uc3QgZmlsZUJhY2t1cCA9IGF3YWl0IHRoaXMuZXhwb3J0RmlsZShmaWxlKTtcbiAgICAgICAgZXhwb3J0ZWRGaWxlcy5wdXNoKGZpbGVCYWNrdXApO1xuICAgICAgICB0b3RhbFNpemUgKz0gZmlsZUJhY2t1cC5zaXplO1xuXG4gICAgICAgIGlmIChmaWxlQmFja3VwLnNraXBwZWQpIHtcbiAgICAgICAgICBza2lwcGVkRmlsZXMrKztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQ6IFN0b3JhZ2VCYWNrdXBEYXRhID0ge1xuICAgICAgICBleHBvcnRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHByb2plY3RJZDogdGhpcy5wcm9qZWN0SWQsXG4gICAgICAgIGZpbGVzOiBleHBvcnRlZEZpbGVzLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgIHRvdGFsRmlsZXM6IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgICB0b3RhbFNpemUsXG4gICAgICAgICAgc2tpcHBlZEZpbGVzLFxuICAgICAgICB9LFxuICAgICAgfTtcblxuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbU3RvcmFnZUV4cG9ydGVyXSBFeHBvcnQgY29tcGxldG86ICR7ZmlsZXMubGVuZ3RofSBhcnF1aXZvcyAoJHtza2lwcGVkRmlsZXN9IHB1bGFkb3MgcG9yIHRhbWFuaG8pYFxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3I/Lm1lc3NhZ2UgfHwgJ1Vua25vd24gZXJyb3InO1xuICAgICAgY29uc29sZS5lcnJvcihgW1N0b3JhZ2VFeHBvcnRlcl0gRXJybyBubyBleHBvcnQ6ICR7bWVzc2FnZX1gKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZXhwb3J0RmlsZShmaWxlOiBhbnkpOiBQcm9taXNlPFN0b3JhZ2VGaWxlQmFja3VwPiB7XG4gICAgY29uc3QgW21ldGFkYXRhXSA9IGF3YWl0IGZpbGUuZ2V0TWV0YWRhdGEoKTtcbiAgICBjb25zdCBzaXplID0gcGFyc2VJbnQobWV0YWRhdGEuc2l6ZSwgMTApO1xuICAgIGNvbnN0IGlzTGFyZ2UgPSBzaXplID4gdGhpcy5tYXhGaWxlU2l6ZUJ5dGVzO1xuXG4gICAgaWYgKGlzTGFyZ2UpIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW1N0b3JhZ2VFeHBvcnRlcl0gUHVsYW5kbyBhcnF1aXZvIGdyYW5kZTogJHtmaWxlLm5hbWV9ICgke3RoaXMuZm9ybWF0U2l6ZShzaXplKX0pYFxuICAgICAgKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHBhdGg6IGZpbGUubmFtZSxcbiAgICAgICAgY29udGVudFR5cGU6IG1ldGFkYXRhLmNvbnRlbnRUeXBlIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nLFxuICAgICAgICBzaXplLFxuICAgICAgICB1cGRhdGVkQXQ6IG1ldGFkYXRhLnVwZGF0ZWQsXG4gICAgICAgIHNraXBwZWQ6IHRydWUsXG4gICAgICAgIHNraXBSZWFzb246IGBGaWxlIHRvbyBsYXJnZTogJHt0aGlzLmZvcm1hdFNpemUoXG4gICAgICAgICAgc2l6ZVxuICAgICAgICApfSA+ICR7dGhpcy5mb3JtYXRTaXplKHRoaXMubWF4RmlsZVNpemVCeXRlcyl9YCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IFtjb250ZW50XSA9IGF3YWl0IGZpbGUuZG93bmxvYWQoKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGF0aDogZmlsZS5uYW1lLFxuICAgICAgICBjb250ZW50VHlwZTogbWV0YWRhdGEuY29udGVudFR5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG4gICAgICAgIHNpemUsXG4gICAgICAgIHVwZGF0ZWRBdDogbWV0YWRhdGEudXBkYXRlZCxcbiAgICAgICAgY29udGVudCxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yPy5tZXNzYWdlIHx8ICdVbmtub3duIGVycm9yJztcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIGBbU3RvcmFnZUV4cG9ydGVyXSBFcnJvIGFvIGJhaXhhciAke2ZpbGUubmFtZX06ICR7bWVzc2FnZX1gXG4gICAgICApO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGF0aDogZmlsZS5uYW1lLFxuICAgICAgICBjb250ZW50VHlwZTogbWV0YWRhdGEuY29udGVudFR5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG4gICAgICAgIHNpemUsXG4gICAgICAgIHVwZGF0ZWRBdDogbWV0YWRhdGEudXBkYXRlZCxcbiAgICAgICAgc2tpcHBlZDogdHJ1ZSxcbiAgICAgICAgc2tpcFJlYXNvbjogYERvd25sb2FkIGZhaWxlZDogJHttZXNzYWdlfWAsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZm9ybWF0U2l6ZShieXRlczogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCB1bml0cyA9IFsnQicsICdLQicsICdNQicsICdHQiddO1xuICAgIGxldCBzaXplID0gYnl0ZXM7XG4gICAgbGV0IHVuaXRJbmRleCA9IDA7XG5cbiAgICB3aGlsZSAoc2l6ZSA+PSAxMDI0ICYmIHVuaXRJbmRleCA8IHVuaXRzLmxlbmd0aCAtIDEpIHtcbiAgICAgIHNpemUgLz0gMTAyNDtcbiAgICAgIHVuaXRJbmRleCsrO1xuICAgIH1cblxuICAgIHJldHVybiBgJHtzaXplLnRvRml4ZWQoMSl9ICR7dW5pdHNbdW5pdEluZGV4XX1gO1xuICB9XG59XG4iXX0=