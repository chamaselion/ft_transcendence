import { i18n } from '@/i18n'

export type OAuthProvider = 'github' | '42'

const oauthError = (key: string) => i18n.global.t(`errors.oauth.${key}`)

const STORAGE_KEY = 'oauth_pending'
const MAX_AGE_MS = 10 * 60 * 1000
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22,128}$/

interface PendingOAuth {
  nonce: string
  provider: OAuthProvider
  mode: 'login'
  createdAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return value === 'github' || value === '42'
}

export function startOAuth(provider: OAuthProvider) {
  const nonce = crypto.randomUUID()

  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      nonce,
      provider,
      mode: 'login',
      createdAt: Date.now(),
      next: '/',
    }),
  )

  const url = new URL(`/api/auth/oauth/${provider}/authorize`, window.location.origin)

  url.searchParams.set('nonce', nonce)

  window.location.assign(url.toString())
}

export function getPendingOAuth(): PendingOAuth | null {
  try {
    const pending = sessionStorage.getItem(STORAGE_KEY)
    if (!pending) return null
    const parsed: unknown = JSON.parse(pending)
    if (
      isRecord(parsed) &&
      typeof parsed.nonce === 'string' &&
      NONCE_PATTERN.test(parsed.nonce) &&
      isOAuthProvider(parsed.provider) &&
      parsed.mode === 'login' &&
      typeof parsed.createdAt === 'number' &&
      Number.isFinite(parsed.createdAt)
    ) {
      const age = Date.now() - parsed.createdAt
      if (age < 0 || age >= MAX_AGE_MS) return null
      return {
        nonce: parsed.nonce,
        provider: parsed.provider,
        mode: parsed.mode,
        createdAt: parsed.createdAt,
      }
    }
  } catch {
    // Storage can be unavailable, or contain malformed data. Fail closed.
  }
  return null
}

export function validateOAuthCallback(provider: unknown, query: URLSearchParams) {
  if (!isOAuthProvider(provider)) throw new Error(oauthError('unsupportedProvider'))

  const getValue = (name: string) => {
    const values = query.getAll(name)
    if (values.length > 1) throw new Error(oauthError('duplicateParams'))
    return values[0] ?? null
  }

  const rawState = getValue('state')
  const code = getValue('code')
  const providerError = getValue('error')

  if (!rawState || rawState.length > 4096) {
    throw new Error(oauthError('invalidState'))
  }

  let state: unknown
  try {
    const base64 = rawState.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    state = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new Error(oauthError('invalidState'))
  }

  const pending = getPendingOAuth()
  if (!pending) {
    throw new Error(oauthError('sessionMissing'))
  }

  if (
    !isRecord(state) ||
    typeof state.sid !== 'string' ||
    !state.sid.trim() ||
    typeof state.n !== 'string' ||
    state.n !== pending.nonce ||
    state.p !== pending.provider ||
    state.p !== provider ||
    state.m !== pending.mode
  ) {
    throw new Error(oauthError('callbackMismatch'))
  }

  // Consume only the matching transaction, including provider cancellations.
  // Removal must succeed before the caller is allowed to exchange the code.
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    throw new Error(oauthError('storageUnavailable'))
  }

  if (providerError !== null) {
    throw new Error(
      providerError === 'access_denied'
        ? oauthError('signInCancelled')
        : oauthError('providerFailed'),
    )
  }
  if (!code?.trim() || code.length > 4096) {
    throw new Error(oauthError('invalidCode'))
  }

  return { provider, code, state: rawState }
}
