const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGITS_ONLY_REGEX = /^\d+$/;
const LOGIN_REGEX = /^[A-Za-z0-9_]+$/;
const LOGIN_MIN_LENGTH = 3;
const LOGIN_MAX_LENGTH = 32;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const normalizeText = (value) => String(value || '').trim();

const buildFieldError = (message) => ({ ok: false, error: message });
const buildFieldSuccess = (value) => ({ ok: true, value });

const validateLogin = (value, fieldName = 'login') => {
  if (typeof value !== 'string') {
    return buildFieldError(`${fieldName} must be a string`);
  }

  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return buildFieldError(`${fieldName} is required`);
  }

  if (normalizedValue.length < LOGIN_MIN_LENGTH || normalizedValue.length > LOGIN_MAX_LENGTH) {
    return buildFieldError(`${fieldName} must be ${LOGIN_MIN_LENGTH}-${LOGIN_MAX_LENGTH} characters long`);
  }

  if (!LOGIN_REGEX.test(normalizedValue)) {
    return buildFieldError(`${fieldName} may only contain letters, numbers, and underscores`);
  }

  return buildFieldSuccess(normalizedValue);
};

const validateEmail = (value, fieldName = 'email') => {
  if (typeof value !== 'string') {
    return buildFieldError(`${fieldName} must be a string`);
  }

  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return buildFieldError(`${fieldName} is required`);
  }

  if (normalizedValue.length > 255) {
    return buildFieldError(`${fieldName} is too long`);
  }

  if (!EMAIL_REGEX.test(normalizedValue)) {
    return buildFieldError('Invalid email format');
  }

  return buildFieldSuccess(normalizedValue);
};

const validatePassword = (value, fieldName = 'password') => {
  if (typeof value !== 'string') {
    return buildFieldError(`${fieldName} must be a string`);
  }

  if (!normalizeText(value)) {
    return buildFieldError(`${fieldName} is required`);
  }

  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return buildFieldError(`${fieldName} must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters long`);
  }

  return buildFieldSuccess(value);
};

const validateOtpCode = (value, fieldName = 'code') => {
  if (typeof value !== 'string') {
    return buildFieldError(`${fieldName} must be a string`);
  }

  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return buildFieldError(`${fieldName} is required`);
  }

  if (!DIGITS_ONLY_REGEX.test(normalizedValue)) {
    return buildFieldError(`${fieldName} must contain only digits`);
  }

  return buildFieldSuccess(normalizedValue);
};

const validateChallengeId = (value, fieldName = 'challengeId') => {
  if (typeof value !== 'string') {
    return buildFieldError(`${fieldName} must be a string`);
  }

  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return buildFieldError(`${fieldName} is required`);
  }

  if (!UUID_REGEX.test(normalizedValue)) {
    return buildFieldError(`${fieldName} must be a valid UUID`);
  }

  return buildFieldSuccess(normalizedValue);
};

const validateUuid = (value, fieldName = 'id') => validateChallengeId(value, fieldName);

const validateOptionalEmail = (value, fieldName = 'email') => {
  if (value === undefined) {
    return buildFieldSuccess('');
  }

  return validateEmail(value, fieldName);
};

const validateOptionalLogin = (value, fieldName = 'login') => {
  if (value === undefined) {
    return buildFieldSuccess('');
  }

  return validateLogin(value, fieldName);
};

module.exports = {
  normalizeText,
  validateChallengeId,
  validateEmail,
  validateLogin,
  validateOptionalEmail,
  validateOptionalLogin,
  validateOtpCode,
  validatePassword,
  validateUuid,
};
