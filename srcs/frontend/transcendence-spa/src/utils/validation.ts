import { i18n } from '@/i18n'

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

function t(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params ?? {})
}

const valid = (value: string): ValidatedField => ({ value, error: null })
const invalid = (error: string, value = ''): ValidatedField => ({ value, error })

export function validateLogin(
  value: string,
  label = t('auth.register.usernameLabel'),
): ValidatedField {
  const normalized = value.trim()
  if (!normalized) return invalid(t('validation.required', { label }), normalized)
  if (normalized.length < LOGIN_MIN_LENGTH || normalized.length > LOGIN_MAX_LENGTH) {
    return invalid(
      t('validation.loginLength', {
        label,
        min: LOGIN_MIN_LENGTH,
        max: LOGIN_MAX_LENGTH,
      }),
      normalized,
    )
  }
  if (!LOGIN_REGEX.test(normalized)) {
    return invalid(t('validation.loginChars', { label }), normalized)
  }
  return valid(normalized)
}

export function validateEmail(
  value: string,
  label = t('auth.register.emailLabel'),
): ValidatedField {
  const normalized = value.trim()
  if (!normalized) return invalid(t('validation.required', { label }), normalized)
  if (normalized.length > EMAIL_MAX_LENGTH) {
    return invalid(t('validation.emailLength', { label, max: EMAIL_MAX_LENGTH }), normalized)
  }
  if (!EMAIL_REGEX.test(normalized)) return invalid(t('validation.invalidEmail'), normalized)
  return valid(normalized)
}

export function validatePassword(
  value: string,
  label = t('auth.register.passwordLabel'),
): ValidatedField {
  if (!value.trim()) return invalid(t('validation.required', { label }), value)
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return invalid(
      t('validation.passwordLength', {
        label,
        min: PASSWORD_MIN_LENGTH,
        max: PASSWORD_MAX_LENGTH,
      }),
      value,
    )
  }
  return valid(value)
}

export function validateOtpCode(
  value: string,
  label = t('auth.otp.codeLabel'),
): ValidatedField {
  const normalized = value.trim()
  if (!normalized) return invalid(t('validation.required', { label }), normalized)
  if (!DIGITS_ONLY_REGEX.test(normalized)) {
    return invalid(t('validation.otpDigits', { label }), normalized)
  }
  return valid(normalized)
}

export function validateDocumentTitle(
  value: string,
  label = t('documents.columnName'),
): ValidatedField {
  const normalized = value.trim()
  if (!normalized) return invalid(t('validation.required', { label }), normalized)
  if (normalized.length > DOCUMENT_TITLE_MAX_LENGTH) {
    return invalid(
      t('validation.maxLength', { label, max: DOCUMENT_TITLE_MAX_LENGTH }),
      normalized.slice(0, DOCUMENT_TITLE_MAX_LENGTH),
    )
  }
  return valid(normalized)
}

export function validateEditorBlockText(
  value: string,
  label = t('editor.blockType.p'),
): ValidatedField {
  if (value.length > EDITOR_BLOCK_MAX_LENGTH) {
    return invalid(
      t('validation.maxLength', { label, max: EDITOR_BLOCK_MAX_LENGTH }),
      value.slice(0, EDITOR_BLOCK_MAX_LENGTH),
    )
  }
  return valid(value)
}

export function validateSearchQuery(value: string): ValidatedField {
  const normalized = value.trim()
  if (normalized.length > SEARCH_QUERY_MAX_LENGTH) {
    return invalid(
      t('validation.searchMax', { max: SEARCH_QUERY_MAX_LENGTH }),
      normalized.slice(0, SEARCH_QUERY_MAX_LENGTH),
    )
  }
  return valid(normalized)
}
