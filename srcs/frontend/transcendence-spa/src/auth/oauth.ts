type OAuthProvider = 'github' | '42'

const STORAGE_KEY = 'oauth_pending'

// Initializes the oauth flow with nonce browser validation
// set's the nonce in the browser with the given STORAGE_KEY
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

// Gets the pending oauth from the browser storage, if it exists and is valid
export function getPendingOAuth() {
  const pending = sessionStorage.getItem(STORAGE_KEY)
  if (!pending) return null
  try {
    const parsed = JSON.parse(pending)
    if (parsed && parsed.nonce && parsed.provider) {
      return parsed
    }
  } catch (e) {
    console.error('Failed to parse pending oauth', e)
  }
  return null
}
