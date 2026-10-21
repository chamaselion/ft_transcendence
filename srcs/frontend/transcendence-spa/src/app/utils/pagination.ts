export type PageItem = number | '...'

export function buildVisiblePages(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const pages: PageItem[] = [1]

  if (current > 3) {
    pages.push('...')
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let page = start; page <= end; page++) {
    pages.push(page)
  }

  if (current < total - 2) {
    pages.push('...')
  }

  pages.push(total)
  return pages
}
