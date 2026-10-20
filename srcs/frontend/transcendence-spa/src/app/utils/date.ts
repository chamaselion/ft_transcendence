export function formatRelativeTime(dateString: string): string {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 45) return 'Just now'
  if (diffSec < 90) return '1 minute ago'
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60)
    return `${mins} minutes ago`
  }
  if (diffSec < 7200) return '1 hour ago'
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600)
    return `${hours} hours ago`
  }
  if (diffSec < 172800) return 'Yesterday'
  if (diffSec < 604800) {
    const days = Math.floor(diffSec / 86400)
    return `${days} days ago`
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatFullDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
