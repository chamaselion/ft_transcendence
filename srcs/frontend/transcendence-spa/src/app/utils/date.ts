import { i18n } from '@/i18n'

function t(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params ?? {})
}

export function formatRelativeTime(dateString: string): string {
  if (!dateString) return t('documents.timeUnknown')
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 45) return t('documents.timeJustNow')
  if (diffSec < 90) return t('documents.timeMinuteAgo')
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60)
    return t('documents.timeMinutesAgo', { count: mins })
  }
  if (diffSec < 7200) return t('documents.timeHourAgo')
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600)
    return t('documents.timeHoursAgo', { count: hours })
  }
  if (diffSec < 172800) return t('documents.timeYesterday')
  if (diffSec < 604800) {
    const days = Math.floor(diffSec / 86400)
    return t('documents.timeDaysAgo', { count: days })
  }

  return date.toLocaleDateString(i18n.global.locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatFullDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleString(i18n.global.locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
