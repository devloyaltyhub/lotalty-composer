/**
 * Validators Module - Barrel Export
 * Asset validation and code quality checks
 */

const path = require('path');

const assetValidator = require('./asset-validator');
const checkUnusedFiles = require('./check-unused-files');
// Note: remove_comments.js executes at module level, so only export path

// Script paths
const scripts = {
  assetValidator: path.join(__dirname, 'asset-validator.js'),
  checkUnusedFiles: path.join(__dirname, 'check-unused-files.js'),
  removeComments: path.join(__dirname, 'remove_comments.js'),
  checkProjectFolderName: path.join(__dirname, 'check_project_folder_name.sh'),
};

module.exports = {
  assetValidator,
  checkUnusedFiles,
  scripts,
};
