const STORAGE_KEY = 'tos_accepted'

export function hasAcceptedTerms(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function rememberTermsAcceptance(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    return
  }
}
