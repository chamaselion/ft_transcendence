export function placeCaretAtEnd(element: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

function ensureCaretInside(element: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode)) {
    placeCaretAtEnd(element)
  }
}

/**
 * Inserts clipboard text without letting the browser paste HTML markup or
 * inline styles. Single-line fields collapse line breaks into spaces.
 */
export function insertPlainText(element: HTMLElement | null, text: string, multiline = true): void {
  if (!element) return

  const normalized = text.replace(/\r\n?/g, '\n')
  const value = multiline ? normalized : normalized.replace(/[ \t]*\n+[ \t]*/g, ' ')
  if (!value) return

  element.focus()
  ensureCaretInside(element)

  let inserted = false
  try {
    inserted = document.execCommand('insertText', false, value)
  } catch {
    inserted = false
  }
  if (inserted) return

  const selection = window.getSelection()
  if (!selection) return

  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange()
  if (selection.rangeCount === 0) {
    range.selectNodeContents(element)
    range.collapse(false)
  }

  range.deleteContents()
  const node = document.createTextNode(value)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  element.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: value }),
  )
}
