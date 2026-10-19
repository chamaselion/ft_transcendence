export const LOGIN_MIN_LENGTH = 3
export const LOGIN_MAX_LENGTH = 32
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 255
export const DOCUMENT_TITLE_MAX_LENGTH = 255
export const EDITOR_BLOCK_MAX_LENGTH = 5000
export const SEARCH_QUERY_MAX_LENGTH = 100

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const LOGIN_REGEX = /^[A-Za-z0-9_]+$/
const DIGITS_ONLY_REGEX = /^\d+$/

export interface ValidatedField {
  value: string
  error: string | null
}

const valid = (value: string): ValidatedField => ({ value, error: null })
const invalid = (error: string, value = ''): ValidatedField => ({ value, error })

export function validateLogin(value: string, label = 'Username'): ValidatedField {
  const normalized = value.trim()
  if (!normalized) return invalid(`${label} is required.`, normalized)
  if (normalized.length < LOGIN_MIN_LENGTH || normalized.length > LOGIN_MAX_LENGTH) {
    return invalid(
      `${label} must be ${LOGIN_MIN_LENGTH}-${LOGIN_MAX_LENGTH} characters long.`,
      normalized,
    )
  }
  if (!LOGIN_REGEX.test(normalized)) {
    return invalid(`${label} may only contain letters, numbers, and underscores.`, normalized)
  }
  return valid(normalized)
}

export function validateEmail(value: string, label = 'Email'): ValidatedField {
  const normalized = value.trim()
  if (!normalized) return invalid(`${label} is required.`, normalized)
  if (normalized.length > EMAIL_MAX_LENGTH) {
    return invalid(`${label} must be at most ${EMAIL_MAX_LENGTH} characters long.`, normalized)
  }
  if (!EMAIL_REGEX.test(normalized)) return invalid('Invalid email format.', normalized)
  return valid(normalized)
}

export function validatePassword(value: string, label = 'Password'): ValidatedField {
  if (!value.trim()) return invalid(`${label} is required.`, value)
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return invalid(
      `${label} must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters long.`,
      value,
    )
  }
  return valid(value)
}

export function validateOtpCode(value: string, label = 'Code'): ValidatedField {
  const normalized = value.trim()
  if (!normalized) return invalid(`${label} is required.`, normalized)
  if (!DIGITS_ONLY_REGEX.test(normalized)) {
    return invalid(`${label} must contain only digits.`, normalized)
  }
  return valid(normalized)
}

export function validateDocumentTitle(value: string, label = 'Title'): ValidatedField {
  const normalized = value.trim()
  if (!normalized) return invalid(`${label} is required.`, normalized)
  if (normalized.length > DOCUMENT_TITLE_MAX_LENGTH) {
    return invalid(
      `${label} must be at most ${DOCUMENT_TITLE_MAX_LENGTH} characters long.`,
      normalized.slice(0, DOCUMENT_TITLE_MAX_LENGTH),
    )
  }
  return valid(normalized)
}

export function validateEditorBlockText(value: string, label = 'Block content'): ValidatedField {
  if (value.length > EDITOR_BLOCK_MAX_LENGTH) {
    return invalid(
      `${label} must be at most ${EDITOR_BLOCK_MAX_LENGTH} characters long.`,
      value.slice(0, EDITOR_BLOCK_MAX_LENGTH),
    )
  }
  return valid(value)
}

export function validateSearchQuery(value: string): ValidatedField {
  const normalized = value.trim()
  if (normalized.length > SEARCH_QUERY_MAX_LENGTH) {
    return invalid(
      `Search query must be at most ${SEARCH_QUERY_MAX_LENGTH} characters long.`,
      normalized.slice(0, SEARCH_QUERY_MAX_LENGTH),
    )
  }
  return valid(normalized)
}
