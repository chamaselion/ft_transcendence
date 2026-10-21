import { createI18n } from 'vue-i18n'

export const SUPPORTED_LOCALES = ['en', 'de', 'hu'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'en'
export const LOCALE_STORAGE_KEY = 'app-locale'

type LocaleMessages = Record<string, unknown>

const localeLoaders: Record<AppLocale, () => Promise<{ default: LocaleMessages }>> = {
  en: () => import('./locales/en.json'),
  de: () => import('./locales/de.json'),
  hu: () => import('./locales/hu.json'),
}

const loadedLocales = new Set<AppLocale>()

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {},
})

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return value != null && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function loadLocaleMessages(locale: AppLocale): Promise<void> {
  if (loadedLocales.has(locale)) return
  const { default: messages } = await localeLoaders[locale]()
  i18n.global.setLocaleMessage(locale, messages)
  loadedLocales.add(locale)
}

export function resolveInitialLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isSupportedLocale(stored)) return stored
  } catch {
    // Storage can be unavailable (e.g. privacy settings); fall back to the browser locale.
  }

  const browserLocale = navigator.language.split('-')[0]
  if (isSupportedLocale(browserLocale)) return browserLocale

  return DEFAULT_LOCALE
}

function applyDocumentLocale(locale: AppLocale): void {
  document.documentElement.setAttribute('lang', locale)
}

async function loadLocaleWithFallback(locale: AppLocale): Promise<void> {
  await Promise.all([
    loadLocaleMessages(DEFAULT_LOCALE),
    locale === DEFAULT_LOCALE ? Promise.resolve() : loadLocaleMessages(locale),
  ])
}

export async function setI18nLocale(locale: AppLocale): Promise<void> {
  await loadLocaleWithFallback(locale)
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Locale persistence is best-effort; the active locale still applies for this session.
  }
  applyDocumentLocale(locale)
}

export async function initI18n(): Promise<AppLocale> {
  const locale = resolveInitialLocale()
  try {
    await loadLocaleWithFallback(locale)
  } catch (error) {
    console.error('Failed to load locale messages:', error)
    try {
      await loadLocaleMessages(DEFAULT_LOCALE)
    } catch (fallbackError) {
      console.error('Failed to load default locale messages:', fallbackError)
    }
  }
  i18n.global.locale.value = locale
  applyDocumentLocale(locale)
  return locale
}
