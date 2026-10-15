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
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (isSupportedLocale(stored)) return stored

  const browserLocale = navigator.language.split('-')[0]
  if (isSupportedLocale(browserLocale)) return browserLocale

  return DEFAULT_LOCALE
}

function applyDocumentLocale(locale: AppLocale): void {
  document.documentElement.setAttribute('lang', locale)
}

export async function setI18nLocale(locale: AppLocale): Promise<void> {
  await loadLocaleMessages(locale)
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  applyDocumentLocale(locale)
}

export async function initI18n(): Promise<AppLocale> {
  const locale = resolveInitialLocale()
  await loadLocaleMessages(locale)
  i18n.global.locale.value = locale
  applyDocumentLocale(locale)
  return locale
}
