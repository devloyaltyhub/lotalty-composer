#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function calculateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    return null;
  }
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return null;
  }
}

function verifyFileIntegrity(sourcePath, destPath) {
  if (!fileExists(sourcePath) || !fileExists(destPath)) {
    return { valid: false, reason: 'Arquivo não encontrado' };
  }

  const sourceSize = getFileSize(sourcePath);
  const destSize = getFileSize(destPath);

  if (sourceSize !== destSize) {
    return {
      valid: false,
      reason: `Tamanho diferente (origem: ${sourceSize} bytes, destino: ${destSize} bytes)`,
    };
  }

  const sourceHash = calculateFileHash(sourcePath);
  const destHash = calculateFileHash(destPath);

  if (sourceHash !== destHash) {
    return {
      valid: false,
      reason: 'Hash diferente - arquivo pode estar corrompido',
    };
  }

  return { valid: true, reason: 'Arquivo íntegro' };
}

module.exports = {
  fileExists,
  calculateFileHash,
  getFileSize,
  verifyFileIntegrity,
};
