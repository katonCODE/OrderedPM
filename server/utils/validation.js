// server/utils/validation.js
// Utility functions for input validation

/**
 * Safely parse an integer with validation
 * @param {string|number} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Parsed and validated integer
 */
const safeParseInt = (value, defaultValue = 0, min = null, max = null) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  
  const parsed = parseInt(value, 10);
  
  // Check if parsing resulted in NaN
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  
  // Apply min/max constraints if provided
  let result = parsed;
  if (min !== null) {
    result = Math.max(result, min);
  }
  if (max !== null) {
    result = Math.min(result, max);
  }
  
  return result;
};

/**
 * Validate UUID format (basic check)
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID format
 */
const isValidUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  
  // Basic UUID v4 format check: 8-4-4-4-12 hexadecimal characters
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid.trim());
};

/**
 * Validate string length
 * @param {string} str - String to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {boolean} allowEmpty - Whether empty strings are allowed
 * @returns {object} { valid: boolean, error: string|null }
 */
const validateStringLength = (str, maxLength, allowEmpty = true) => {
  if (str === undefined || str === null) {
    return { valid: allowEmpty, error: allowEmpty ? null : 'String is required' };
  }
  
  if (typeof str !== 'string') {
    return { valid: false, error: 'Value must be a string' };
  }
  
  const trimmed = str.trim();
  
  if (!allowEmpty && trimmed.length === 0) {
    return { valid: false, error: 'String cannot be empty' };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `String exceeds maximum length of ${maxLength} characters` };
  }
  
  return { valid: true, error: null };
};

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {object} { success: boolean, data: *, error: string|null }
 */
const safeJsonParse = (jsonString, defaultValue = null) => {
  if (jsonString === null || jsonString === undefined) {
    return { success: true, data: defaultValue, error: null };
  }
  
  if (typeof jsonString !== 'string') {
    return { success: false, data: defaultValue, error: 'Input must be a string' };
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    return { success: true, data: parsed, error: null };
  } catch (error) {
    return { success: false, data: defaultValue, error: error.message };
  }
};

module.exports = {
  safeParseInt,
  isValidUUID,
  validateStringLength,
  safeJsonParse,
};
