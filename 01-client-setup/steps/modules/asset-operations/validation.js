const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { validateBusinessTypeKey } = require('../../../../shared/input-validator');

function validateAssetsStructure(generalAssetsDir, clientsDir, businessTypes) {
  console.log('Validating assets structure...');

  const errors = [];
  const warnings = [];

  if (!fs.existsSync(generalAssetsDir)) {
    errors.push(`General assets directory not found: ${generalAssetsDir}`);
    return { errors, warnings };
  }

  const requiredDirs = ['animations', 'images', 'fonts'];
  requiredDirs.forEach((dir) => {
    const dirPath = path.join(generalAssetsDir, dir);
    if (!fs.existsSync(dirPath)) {
      warnings.push(`Optional assets directory not found: ${dirPath}`);
    }
  });

  businessTypes.forEach((businessType) => {
    const animDir = path.join(generalAssetsDir, 'animations', businessType.key);
    const imgDir = path.join(generalAssetsDir, 'images', businessType.key);

    if (!fs.existsSync(animDir)) {
      warnings.push(
        `Animation assets not found for business type '${businessType.key}': ${animDir}`
      );
    }

    if (!fs.existsSync(imgDir)) {
      warnings.push(`Image assets not found for business type '${businessType.key}': ${imgDir}`);
    }
  });

  if (!fs.existsSync(clientsDir)) {
    errors.push(`Clients directory not found: ${clientsDir}`);
  }

  return { errors, warnings };
}

function displayValidationResults(validation) {
  const { errors, warnings } = validation;

  if (errors.length > 0) {
    console.log('Validation errors found:');
    errors.forEach((error) => console.log(`   - ${error}`));
  }

  if (warnings.length > 0) {
    console.log('Validation warnings:');
    warnings.forEach((warning) => console.log(`   - ${warning}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('Assets structure validation passed!');
  }

  return errors.length === 0;
}

function runAssetValidation(businessType, projectRoot) {
  console.log('Running automatic asset validation...');

  try {
    const validatedBusinessType = validateBusinessTypeKey(businessType, 'businessType');
    console.log('Checking required assets and copying missing ones...');
    const validateAssetsScript = path.join(
      projectRoot,
      'shared/validators/asset-validator.js'
    );

    execSync(
      `node "${validateAssetsScript}" --business-type "${validatedBusinessType}" --check-integrity --auto-copy --strict`,
      {
        stdio: 'inherit',
        cwd: projectRoot,
        shell: true,
      }
    );
    console.log('Asset validation and auto-copy completed successfully');

    return true;
  } catch (error) {
    console.error('Asset validation failed:', error.message);
    console.log(
      'Please check the assets manually in shared_assets/ and white_label_app/assets/'
    );
    return false;
  }
}

function runFinalAssetValidation(businessType, projectRoot) {
  console.log('Running final asset validation...');

  try {
    const validatedBusinessType = validateBusinessTypeKey(businessType, 'businessType');
    const validateAssetsScript = path.join(
      projectRoot,
      'shared/validators/asset-validator.js'
    );
    execSync(`node "${validateAssetsScript}" --business-type "${validatedBusinessType}" --strict`, {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: true,
    });
    console.log('Final asset validation completed successfully');
    return true;
  } catch (error) {
    console.warn(
      'Warning: Final asset validation found some issues, but continuing...',
      error.message
    );
    console.log('Recommend checking assets manually before proceeding');
    return false;
  }
}

module.exports = {
  validateAssetsStructure,
  displayValidationResults,
  runAssetValidation,
  runFinalAssetValidation,
};
