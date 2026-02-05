/**
 * Utility functions for restore-backup
 */

const zlib = require('zlib');

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function decompressGzip(buffer) {
  return zlib.gunzipSync(buffer);
}

function convertTimestamps(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => convertTimestamps(item));
  }

  if (typeof data === 'object') {
    if (data._seconds !== undefined && data._nanoseconds !== undefined) {
      const admin = require('firebase-admin');
      return new admin.firestore.Timestamp(data._seconds, data._nanoseconds);
    }

    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(data)) {
      const admin = require('firebase-admin');
      return admin.firestore.Timestamp.fromDate(new Date(data));
    }

    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = convertTimestamps(value);
    }
    return result;
  }

  return data;
}

module.exports = {
  formatSize,
  decompressGzip,
  convertTimestamps,
};
