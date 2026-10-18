export interface ParsedClipboardText {
  kind: 'single' | 'paragraphs' | 'list'
  lines: string[]
  ordered?: boolean
}

const UNORDERED_ITEM = /^\s*[-*•+]\s+/
const ORDERED_ITEM = /^\s*\d+[.)]\s+/

function stripListMarker(line: string): string {
  return line.replace(/^\s*(?:[-*•+]|\d+[.)])\s+/, '')
}

function parseHtmlList(html: string): ParsedClipboardText | null {
  if (!html) return null

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const list = doc.querySelector('ol, ul')
  if (!list) return null

  const items = Array.from(list.children)
    .filter((child) => child.tagName === 'LI')
    .map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (!items.length) return null
  return { kind: 'list', lines: items, ordered: list.tagName === 'OL' }
}

/**
 * Interprets clipboard text for block-level insertion. HTML is inspected only
 * to detect list structure; its markup and styling are never inserted.
 */
export function parseClipboardText(text: string, html = ''): ParsedClipboardText {
  const htmlList = parseHtmlList(html)
  if (htmlList) return htmlList

  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  const lines = normalized ? normalized.split('\n') : []
  const meaningfulLines = lines.filter((line) => line.trim().length > 0)

  if (!meaningfulLines.length) return { kind: 'single', lines: [''] }

  const unordered = meaningfulLines.every((line) => UNORDERED_ITEM.test(line))
  const ordered = meaningfulLines.every((line) => ORDERED_ITEM.test(line))
  if (unordered || ordered) {
    return {
      kind: 'list',
      lines: meaningfulLines.map(stripListMarker),
      ordered,
    }
  }

  if (lines.length === 1) return { kind: 'single', lines }
  return { kind: 'paragraphs', lines }
}
