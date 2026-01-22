const admin = require('firebase-admin');

class DataTransformer {
  constructor(firestore) {
    this.firestore = firestore;
  }

  replaceVariables(data, variables) {
    let dataString = JSON.stringify(data);

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      dataString = dataString.split(placeholder).join(value);
    });

    return JSON.parse(dataString);
  }

  processTimestamps(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.processTimestamps(item));
    }

    const processed = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (value === '{{TIMESTAMP}}') {
        processed[key] = admin.firestore.FieldValue.serverTimestamp();
      } else if (typeof value === 'object') {
        processed[key] = this.processTimestamps(value);
      } else {
        processed[key] = value;
      }
    });

    return processed;
  }

  processSnapshotTypes(data) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.processSnapshotTypes(item));
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (data._type === 'timestamp' && data._value) {
      return admin.firestore.Timestamp.fromDate(new Date(data._value));
    }

    if (data._type === 'geopoint' && data._latitude !== undefined && data._longitude !== undefined) {
      return new admin.firestore.GeoPoint(data._latitude, data._longitude);
    }

    if (data._type === 'reference' && data._path) {
      return this.firestore.doc(data._path);
    }

    const processed = {};
    for (const [key, value] of Object.entries(data)) {
      processed[key] = this.processSnapshotTypes(value);
    }

    return processed;
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  transformStorageUrls(data, sourceBucket, targetBucket) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformStorageUrls(item, sourceBucket, targetBucket));
    }

    if (typeof data === 'string') {
      let result = data;

      result = result.replace(
        new RegExp(`gs://${this.escapeRegex(sourceBucket)}/`, 'g'),
        `gs://${targetBucket}/`
      );

      result = result.replace(
        new RegExp(
          `https://firebasestorage\\.googleapis\\.com/v0/b/${this.escapeRegex(sourceBucket)}/o/`,
          'g'
        ),
        `https://firebasestorage.googleapis.com/v0/b/${targetBucket}/o/`
      );

      return result;
    }

    if (typeof data !== 'object') {
      return data;
    }

    const transformed = {};
    for (const [key, value] of Object.entries(data)) {
      transformed[key] = this.transformStorageUrls(value, sourceBucket, targetBucket);
    }

    return transformed;
  }

  applyUrlMapping(data, urlMapping) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.applyUrlMapping(item, urlMapping));
    }

    if (typeof data === 'string') {
      if (urlMapping[data]) {
        return urlMapping[data];
      }

      const baseUrl = data.split('?')[0];
      if (urlMapping[baseUrl]) {
        return urlMapping[baseUrl];
      }

      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    const mapped = {};
    for (const [key, value] of Object.entries(data)) {
      mapped[key] = this.applyUrlMapping(value, urlMapping);
    }

    return mapped;
  }
}

module.exports = DataTransformer;
