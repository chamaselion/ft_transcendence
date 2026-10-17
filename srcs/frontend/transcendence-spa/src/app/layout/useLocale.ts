import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isSupportedLocale, setI18nLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'

export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  hu: 'Magyar',
}

export const LOCALE_FLAGS: Record<AppLocale, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  hu: '🇭🇺',
}

export interface LocaleOption {
  code: AppLocale
  label: string
  flag: string
}

const availableLocales: LocaleOption[] = SUPPORTED_LOCALES.map((code) => ({
  code,
  label: LOCALE_NAMES[code],
  flag: LOCALE_FLAGS[code],
}))

export function useLocale() {
  const { locale } = useI18n({ useScope: 'global' })

  const currentLocale = computed(() => locale.value as AppLocale)

  const setLocale = async (next: string): Promise<void> => {
    if (!isSupportedLocale(next)) return
    await setI18nLocale(next)
  }

  return {
    currentLocale,
    locales: availableLocales,
    setLocale,
  }
}
