const { BusinessTypeRepository } = require('./business-type-repository');

class ValidationService {
  static validateBusinessTypeKey(key) {
    if (!key || key.length < 2) {
      return 'Business type key must be at least 2 characters long';
    }

    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return 'Business type key must start with a letter and contain only lowercase letters, numbers, and underscores';
    }

    const existingTypes = BusinessTypeRepository.getExistingTypes();
    if (existingTypes.some((type) => type.key === key)) {
      return `Business type "${key}" already exists`;
    }

    return null;
  }

  static validateLabel(label) {
    if (!label || label.trim().length === 0) {
      return 'Display label is required';
    }
    return null;
  }
}

module.exports = { ValidationService };
