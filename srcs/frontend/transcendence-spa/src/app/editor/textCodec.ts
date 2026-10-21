const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const HTML_UNESCAPE: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPE[character] ?? character)
}

export function unescapeHtml(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|#x27|#39);/g,
    (entity) => HTML_UNESCAPE[entity] ?? entity,
  )
}
