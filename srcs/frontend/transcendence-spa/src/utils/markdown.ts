const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderInline = (value: string) =>
  escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

export function renderMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const html: string[] = []
  let paragraph: string[] = []
  let list: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  const flushList = () => {
    if (!list.length) return
    html.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`)
    list = []
  }

  const flushBlocks = () => {
    flushParagraph()
    flushList()
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushBlocks()
      continue
    }

    if (line.startsWith('### ')) {
      flushBlocks()
      html.push(`<h3>${renderInline(line.slice(4))}</h3>`)
      continue
    }

    if (line.startsWith('## ')) {
      flushBlocks()
      html.push(`<h2>${renderInline(line.slice(3))}</h2>`)
      continue
    }

    if (line.startsWith('# ')) {
      flushBlocks()
      html.push(`<h1>${renderInline(line.slice(2))}</h1>`)
      continue
    }

    if (line.startsWith('> ')) {
      flushBlocks()
      html.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`)
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushBlocks()
      html.push('<hr />')
      continue
    }

    if (line.startsWith('- ')) {
      flushParagraph()
      list.push(line.slice(2))
      continue
    }

    if (list.length) flushList()
    paragraph.push(line)
  }

  flushBlocks()
  return html.join('\n')
}
