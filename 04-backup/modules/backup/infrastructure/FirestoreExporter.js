"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreExporter = void 0;
class FirestoreExporter {
    constructor(projectId, getFirestore, maxSubcollectionDepth = 2) {
        this.projectId = projectId;
        this.getFirestore = getFirestore;
        this.maxSubcollectionDepth = maxSubcollectionDepth;
    }
    async exportAllCollections() {
        console.log(`[FirestoreExporter] Iniciando export para ${this.projectId}...`);
        const db = this.getFirestore(this.projectId);
        const collections = [];
        let totalDocuments = 0;
        try {
            const collectionRefs = await db.listCollections();
            console.log(`[FirestoreExporter] Encontradas ${collectionRefs.length} colecoes`);
            for (const collRef of collectionRefs) {
                const collectionName = collRef.id;
                console.log(`[FirestoreExporter] Exportando colecao: ${collectionName}`);
                const documents = await this.exportCollection(collRef, 0);
                collections.push({
                    name: collectionName,
                    documents,
                    documentCount: documents.length,
                });
                totalDocuments += documents.length;
                console.log(`[FirestoreExporter] ${collectionName}: ${documents.length} documentos`);
            }
            const result = {
                exportedAt: new Date().toISOString(),
                projectId: this.projectId,
                collections,
                stats: {
                    totalCollections: collectionRefs.length,
                    totalDocuments,
                },
            };
            console.log(`[FirestoreExporter] Export completo: ${totalDocuments} documentos em ${collectionRefs.length} colecoes`);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[FirestoreExporter] Erro no export: ${message}`);
            throw new Error(`Firestore export failed for ${this.projectId}: ${message}`);
        }
    }
    async exportCollection(collectionRef, depth) {
        const documents = [];
        const snapshot = await collectionRef.get();
        for (const doc of snapshot.docs) {
            const docData = {
                id: doc.id,
                data: this.serializeData(doc.data()),
            };
            if (depth < this.maxSubcollectionDepth) {
                const subcollections = await doc.ref.listCollections();
                if (subcollections.length > 0) {
                    docData.subcollections = {};
                    for (const subcollRef of subcollections) {
                        docData.subcollections[subcollRef.id] = await this.exportCollection(subcollRef, depth + 1);
                    }
                }
            }
            documents.push(docData);
        }
        return documents;
    }
    serializeData(data) {
        const serialized = {};
        for (const [key, value] of Object.entries(data)) {
            serialized[key] = this.serializeValue(value);
        }
        return serialized;
    }
    serializeValue(value) {
        if (value === null || value === undefined) {
            return value;
        }
        if (typeof value === 'object' &&
            value !== null &&
            'toDate' in value &&
            typeof value.toDate === 'function') {
            return {
                _type: 'Timestamp',
                value: value.toDate().toISOString(),
            };
        }
        if (typeof value === 'object' &&
            value !== null &&
            'latitude' in value &&
            'longitude' in value) {
            const geoPoint = value;
            return {
                _type: 'GeoPoint',
                latitude: geoPoint.latitude,
                longitude: geoPoint.longitude,
            };
        }
        if (typeof value === 'object' &&
            value !== null &&
            'path' in value &&
            typeof value.path === 'string') {
            return {
                _type: 'DocumentReference',
                path: value.path,
            };
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.serializeValue(item));
        }
        if (typeof value === 'object' && value !== null) {
            return this.serializeData(value);
        }
        return value;
    }
}
exports.FirestoreExporter = FirestoreExporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmlyZXN0b3JlRXhwb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5mcmFzdHJ1Y3R1cmUvRmlyZXN0b3JlRXhwb3J0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBd0JBLE1BQWEsaUJBQWlCO0lBSzVCLFlBQ0UsU0FBaUIsRUFDakIsWUFBOEMsRUFDOUMsd0JBQWdDLENBQUM7UUFFakMsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQixDQUFDO0lBQ3JELENBQUM7SUFFRCxLQUFLLENBQUMsb0JBQW9CO1FBQ3hCLE9BQU8sQ0FBQyxHQUFHLENBQ1QsNkNBQTZDLElBQUksQ0FBQyxTQUFTLEtBQUssQ0FDakUsQ0FBQztRQUVGLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sV0FBVyxHQUFnQyxFQUFFLENBQUM7UUFDcEQsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBRXZCLElBQUksQ0FBQztZQUNILE1BQU0sY0FBYyxHQUFHLE1BQU0sRUFBRSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ2xELE9BQU8sQ0FBQyxHQUFHLENBQ1QsbUNBQW1DLGNBQWMsQ0FBQyxNQUFNLFdBQVcsQ0FDcEUsQ0FBQztZQUVGLEtBQUssTUFBTSxPQUFPLElBQUksY0FBYyxFQUFFLENBQUM7Z0JBQ3JDLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQ1QsMkNBQTJDLGNBQWMsRUFBRSxDQUM1RCxDQUFDO2dCQUVGLE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDMUQsV0FBVyxD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QyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFFRCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDaEQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQWdDLENBQUMsQ0FBQztRQUM5RCxDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUE1S0QsOENBNEtDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBDb2xsZWN0aW9uUmVmZXJlbmNlLCBGaXJlc3RvcmUgfSBmcm9tICdmaXJlYmFzZS1hZG1pbi9maXJlc3RvcmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpcmVzdG9yZUJhY2t1cERhdGEge1xuICBleHBvcnRlZEF0OiBzdHJpbmc7XG4gIHByb2plY3RJZDogc3RyaW5nO1xuICBjb2xsZWN0aW9uczogRmlyZXN0b3JlQ29sbGVjdGlvbkJhY2t1cFtdO1xuICBzdGF0czoge1xuICAgIHRvdGFsQ29sbGVjdGlvbnM6IG51bWJlcjtcbiAgICB0b3RhbERvY3VtZW50czogbnVtYmVyO1xuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZpcmVzdG9yZUNvbGxlY3Rpb25CYWNrdXAge1xuICBuYW1lOiBzdHJpbmc7XG4gIGRvY3VtZW50czogRmlyZXN0b3JlRG9jdW1lbnRbXTtcbiAgZG9jdW1lbnRDb3VudDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZpcmVzdG9yZURvY3VtZW50IHtcbiAgaWQ6IHN0cmluZztcbiAgZGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHN1YmNvbGxlY3Rpb25zPzogUmVjb3JkPHN0cmluZywgRmlyZXN0b3JlRG9jdW1lbnRbXT47XG59XG5cbmV4cG9ydCBjbGFzcyBGaXJlc3RvcmVFeHBvcnRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgcHJvamVjdElkOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVhZG9ubHkgbWF4U3ViY29sbGVjdGlvbkRlcHRoOiBudW1iZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgZ2V0RmlyZXN0b3JlOiAocHJvamVjdElkOiBzdHJpbmcpID0+IEZpcmVzdG9yZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm9qZWN0SWQ6IHN0cmluZyxcbiAgICBnZXRGaXJlc3RvcmU6IChwcm9qZWN0SWQ6IHN0cmluZykgPT4gRmlyZXN0b3JlLFxuICAgIG1heFN1YmNvbGxlY3Rpb25EZXB0aDogbnVtYmVyID0gMlxuICApIHtcbiAgICB0aGlzLnByb2plY3RJZCA9IHByb2plY3RJZDtcbiAgICB0aGlzLmdldEZpcmVzdG9yZSA9IGdldEZpcmVzdG9yZTtcbiAgICB0aGlzLm1heFN1YmNvbGxlY3Rpb25EZXB0aCA9IG1heFN1YmNvbGxlY3Rpb25EZXB0aDtcbiAgfVxuXG4gIGFzeW5jIGV4cG9ydEFsbENvbGxlY3Rpb25zKCk6IFByb21pc2U8RmlyZXN0b3JlQmFja3VwRGF0YT4ge1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtGaXJlc3RvcmVFeHBvcnRlcl0gSW5pY2lhbmRvIGV4cG9ydCBwYXJhICR7dGhpcy5wcm9qZWN0SWR9Li4uYFxuICAgICk7XG5cbiAgICBjb25zdCBkYiA9IHRoaXMuZ2V0RmlyZXN0b3JlKHRoaXMucHJvamVjdElkKTtcbiAgICBjb25zdCBjb2xsZWN0aW9uczogRmlyZXN0b3JlQ29sbGVjdGlvbkJhY2t1cFtdID0gW107XG4gICAgbGV0IHRvdGFsRG9jdW1lbnRzID0gMDtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb2xsZWN0aW9uUmVmcyA9IGF3YWl0IGRiLmxpc3RDb2xsZWN0aW9ucygpO1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbRmlyZXN0b3JlRXhwb3J0ZXJdIEVuY29udHJhZGFzICR7Y29sbGVjdGlvblJlZnMubGVuZ3RofSBjb2xlY29lc2BcbiAgICAgICk7XG5cbiAgICAgIGZvciAoY29uc3QgY29sbFJlZiBvZiBjb2xsZWN0aW9uUmVmcykge1xuICAgICAgICBjb25zdCBjb2xsZWN0aW9uTmFtZSA9IGNvbGxSZWYuaWQ7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbRmlyZXN0b3JlRXhwb3J0ZXJdIEV4cG9ydGFuZG8gY29sZWNhbzogJHtjb2xsZWN0aW9uTmFtZX1gXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZG9jdW1lbnRzID0gYXdhaXQgdGhpcy5leHBvcnRDb2xsZWN0aW9uKGNvbGxSZWYsIDApO1xuICAgICAgICBjb2xsZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICBkb2N1bWVudHMsXG4gICAgICAgICAgZG9jdW1lbnRDb3VudDogZG9jdW1lbnRzLmxlbmd0aCxcbiAgICAgICAgfSk7XG4gICAgICAgIHRvdGFsRG9jdW1lbnRzICs9IGRvY3VtZW50cy5sZW5ndGg7XG5cbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYFtGaXJlc3RvcmVFeHBvcnRlcl0gJHtjb2xsZWN0aW9uTmFtZX06ICR7ZG9jdW1lbnRzLmxlbmd0aH0gZG9jdW1lbnRvc2BcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0OiBGaXJlc3RvcmVCYWNrdXBEYXRhID0ge1xuICAgICAgICBleHBvcnRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHByb2plY3RJZDogdGhpcy5wcm9qZWN0SWQsXG4gICAgICAgIGNvbGxlY3Rpb25zLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgIHRvdGFsQ29sbGVjdGlvbnM6IGNvbGxlY3Rpb25SZWZzLmxlbmd0aCxcbiAgICAgICAgICB0b3RhbERvY3VtZW50cyxcbiAgICAgICAgfSxcbiAgICAgIH07XG5cbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW0ZpcmVzdG9yZUV4cG9ydGVyXSBFeHBvcnQgY29tcGxldG86ICR7dG90YWxEb2N1bWVudHN9IGRvY3VtZW50b3MgZW0gJHtjb2xsZWN0aW9uUmVmcy5sZW5ndGh9IGNvbGVjb2VzYFxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InO1xuICAgICAgY29uc29sZS5lcnJvcihgW0ZpcmVzdG9yZUV4cG9ydGVyXSBFcnJvIG5vIGV4cG9ydDogJHttZXNzYWdlfWApO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRmlyZXN0b3JlIGV4cG9ydCBmYWlsZWQgZm9yICR7dGhpcy5wcm9qZWN0SWR9OiAke21lc3NhZ2V9YFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGV4cG9ydENvbGxlY3Rpb24oXG4gICAgY29sbGVjdGlvblJlZjogQ29sbGVjdGlvblJlZmVyZW5jZSxcbiAgICBkZXB0aDogbnVtYmVyXG4gICk6IFByb21pc2U8RmlyZXN0b3JlRG9jdW1lbnRbXT4ge1xuICAgIGNvbnN0IGRvY3VtZW50czogRmlyZXN0b3JlRG9jdW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IHNuYXBzaG90ID0gYXdhaXQgY29sbGVjdGlvblJlZi5nZXQoKTtcblxuICAgIGZvciAoY29uc3QgZG9jIG9mIHNuYXBzaG90LmRvY3MpIHtcbiAgICAgIGNvbnN0IGRvY0RhdGE6IEZpcmVzdG9yZURvY3VtZW50ID0ge1xuICAgICAgICBpZDogZG9jLmlkLFxuICAgICAgICBkYXRhOiB0aGlzLnNlcmlhbGl6ZURhdGEoZG9jLmRhdGEoKSksXG4gICAgICB9O1xuXG4gICAgICBpZiAoZGVwdGggPCB0aGlzLm1heFN1YmNvbGxlY3Rpb25EZXB0aCkge1xuICAgICAgICBjb25zdCBzdWJjb2xsZWN0aW9ucyA9IGF3YWl0IGRvYy5yZWYubGlzdENvbGxlY3Rpb25zKCk7XG5cbiAgICAgICAgaWYgKHN1YmNvbGxlY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBkb2NEYXRhLnN1YmNvbGxlY3Rpb25zID0ge307XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IHN1YmNvbGxSZWYgb2Ygc3ViY29sbGVjdGlvbnMpIHtcbiAgICAgICAgICAgIGRvY0RhdGEuc3ViY29sbGVjdGlvbnNbc3ViY29sbFJlZi5pZF0gPSBhd2FpdCB0aGlzLmV4cG9ydENvbGxlY3Rpb24oXG4gICAgICAgICAgICAgIHN1YmNvbGxSZWYsXG4gICAgICAgICAgICAgIGRlcHRoICsgMVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZG9jdW1lbnRzLnB1c2goZG9jRGF0YSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRvY3VtZW50cztcbiAgfVxuXG4gIHByaXZhdGUgc2VyaWFsaXplRGF0YShcbiAgICBkYXRhOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxuICApOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gICAgY29uc3Qgc2VyaWFsaXplZDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7fTtcblxuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRhdGEpKSB7XG4gICAgICBzZXJpYWxpemVkW2tleV0gPSB0aGlzLnNlcmlhbGl6ZVZhbHVlKHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2VyaWFsaXplZDtcbiAgfVxuXG4gIHByaXZhdGUgc2VyaWFsaXplVmFsdWUodmFsdWU6IHVua25vd24pOiB1bmtub3duIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHZhbHVlICE9PSBudWxsICYmXG4gICAgICAndG9EYXRlJyBpbiB2YWx1ZSAmJlxuICAgICAgdHlwZW9mICh2YWx1ZSBhcyB7IHRvRGF0ZTogKCkgPT4gRGF0ZSB9KS50b0RhdGUgPT09ICdmdW5jdGlvbidcbiAgICApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIF90eXBlOiAnVGltZXN0YW1wJyxcbiAgICAgICAgdmFsdWU6ICh2YWx1ZSBhcyB7IHRvRGF0ZTogKCkgPT4gRGF0ZSB9KS50b0RhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG4gICAgICB2YWx1ZSAhPT0gbnVsbCAmJlxuICAgICAgJ2xhdGl0dWRlJyBpbiB2YWx1ZSAmJlxuICAgICAgJ2xvbmdpdHVkZScgaW4gdmFsdWVcbiAgICApIHtcbiAgICAgIGNvbnN0IGdlb1BvaW50ID0gdmFsdWUgYXMgeyBsYXRpdHVkZTogbnVtYmVyOyBsb25naXR1ZGU6IG51bWJlciB9O1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgX3R5cGU6ICdHZW9Qb2ludCcsXG4gICAgICAgIGxhdGl0dWRlOiBnZW9Qb2ludC5sYXRpdHVkZSxcbiAgICAgICAgbG9uZ2l0dWRlOiBnZW9Qb2ludC5sb25naXR1ZGUsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHZhbHVlICE9PSBudWxsICYmXG4gICAgICAncGF0aCcgaW4gdmFsdWUgJiZcbiAgICAgIHR5cGVvZiAodmFsdWUgYXMgeyBwYXRoOiBzdHJpbmcgfSkucGF0aCA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIF90eXBlOiAnRG9jdW1lbnRSZWZlcmVuY2UnLFxuICAgICAgICBwYXRoOiAodmFsdWUgYXMgeyBwYXRoOiBzdHJpbmcgfSkucGF0aCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICByZXR1cm4gdmFsdWUubWFwKChpdGVtKSA9PiB0aGlzLnNlcmlhbGl6ZVZhbHVlKGl0ZW0pKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2VyaWFsaXplRGF0YSh2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG4iXX0=