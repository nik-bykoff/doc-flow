/**
 * Request Validation Middleware
 * Provides schema-based validation for request bodies, params, and queries
 */

const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Validate request body, params, and query based on schema
      const validated = {};

      if (schema.body) {
        validated.body = await validateSchema(schema.body, req.body, 'body');
      }

      if (schema.params) {
        validated.params = await validateSchema(schema.params, req.params, 'params');
      }

      if (schema.query) {
        validated.query = await validateSchema(schema.query, req.query, 'query');
      }

      // Attach validated data to request
      req.validated = validated;
      next();
    } catch (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }
  };
};

/**
 * Validate data against a schema
 */
const validateSchema = async (schema, data, location) => {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];

    // Required field check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required in ${location}`);
      continue;
    }

    // Skip validation if field is optional and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation
    if (rules.type) {
      const isValid = validateType(value, rules.type);
      if (!isValid) {
        errors.push(`${key} must be of type ${rules.type} in ${location}`);
        continue;
      }
    }

    // String validations
    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${key} must be at least ${rules.minLength} characters long`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${key} must be at most ${rules.maxLength} characters long`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${key} format is invalid`);
      }
      if (rules.email && !isValidEmail(value)) {
        errors.push(`${key} must be a valid email address`);
      }
      if (rules.uuid && !isValidUUID(value)) {
        errors.push(`${key} must be a valid UUID`);
      }
    }

    // Number validations
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${key} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${key} must be at most ${rules.max}`);
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
    }

    // Custom validation function
    if (rules.custom) {
      const customError = rules.custom(value, data);
      if (customError) {
        errors.push(customError);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return data;
};

/**
 * Validate value type
 */
const validateType = (value, type) => {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && !Array.isArray(value) && value !== null;
    case 'uuid':
      return typeof value === 'string' && isValidUUID(value);
    default:
      return true;
  }
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate UUID format
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Common validation schemas
 */
const schemas = {
  uuid: {
    type: 'string',
    uuid: true,
    required: true
  },
  email: {
    type: 'string',
    email: true,
    required: true,
    maxLength: 255
  },
  password: {
    type: 'string',
    required: true,
    minLength: 8,
    maxLength: 100
  },
  pagination: {
    page: {
      type: 'number',
      min: 1,
      required: false
    },
    limit: {
      type: 'number',
      min: 1,
      max: 100,
      required: false
    }
  }
};

module.exports = {
  validate,
  schemas
};
