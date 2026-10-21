import { computed, onMounted, watch, type Ref } from 'vue'
import { insertPlainText, placeCaretAtEnd } from '@/app/editor/plainTextPaste'
import { parseClipboardText } from '@/app/editor/clipboardText'
import { EDITOR_BLOCK_MAX_LENGTH } from '@/utils/validation'

export interface EditableInsertBlock {
  type: 'p' | 'li'
  text: string
  ordered?: boolean
}

export interface EditableInsertEvent {
  currentText: string
  blocks: EditableInsertBlock[]
}

export interface EditableEmit {
  (event: 'update:text', value: string): void
  (event: 'insert-blocks', payload: EditableInsertEvent): void
  (event: 'focus'): void
  (event: 'blur'): void
}

interface EditableOptions {
  /** Preserve raw textContent instead of the rendered innerText (used by code). */
  raw?: boolean
  /** Allow the browser to insert line breaks (used by code, list and citation). */
  multiline?: boolean
  /** How pasted multi-line content should be interpreted. */
  pasteMode?: 'paragraph' | 'list' | 'text'
  /** Maximum number of plain-text characters allowed in the block. */
  maxLength?: number
  /** Custom serializer used to seed the element on mount. */
  write?: (el: HTMLElement, text: string) => void
  /** Custom parser used to read the element back on input. */
  read?: (el: HTMLElement) => string
}

export const STANDARD_TEXTS = new Set([
  'untitled document',
  'untitled',
  'write something…',
  'write something...',
  'heading',
  'list item',
  'quote',
  '// code',
])

export function isStandardText(value?: string | null): boolean {
  if (!value) return false
  return STANDARD_TEXTS.has(value.trim().toLowerCase())
}

/**
 * Wires an element up for uncontrolled `contenteditable` editing.
 *
 * The initial content is written once on mount and when the element is bound.
 * When reactive text changes arrive (e.g. from remote WebSocket edits), the DOM
 * is synced as long as the local user is not actively typing in that element.
 */
export function useEditable(
  element: Ref<HTMLElement | null>,
  text: () => string,
  editable: () => boolean,
  emit: EditableEmit,
  options: EditableOptions = {},
) {
  const attributes = computed(() => ({
    contenteditable: editable(),
    spellcheck: editable(),
  }))

  const maxLength = options.maxLength ?? EDITOR_BLOCK_MAX_LENGTH

  const clamp = (value: string): string =>
    value.length > maxLength ? value.slice(0, maxLength) : value

  const readValue = (el: HTMLElement): string => {
    if (options.read) return options.read(el)
    return options.raw ? (el.textContent ?? '') : el.innerText
  }

  const write = (value = text()) => {
    const el = element.value
    if (!el) return
    if (options.write) options.write(el, value)
    else if (options.raw) el.textContent = value
    else el.innerText = value
  }

  const selectionOffset = (el: HTMLElement): number | null => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null

    const range = selection.getRangeAt(0)
    if (!el.contains(range.startContainer)) return null

    const beforeRange = range.cloneRange()
    beforeRange.selectNodeContents(el)
    beforeRange.setEnd(range.startContainer, range.startOffset)
    return beforeRange.toString().length
  }

  const splitAtSelection = (el: HTMLElement, current: string) => {
    const offset = selectionOffset(el)
    if (offset === null) return { before: current, after: '' }
    return { before: current.slice(0, offset), after: current.slice(offset) }
  }

  const splitListAtSelection = (el: HTMLElement, current: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return { before: current, after: '' }

    const range = selection.getRangeAt(0)
    const items = Array.from(el.querySelectorAll('li'))
    const index = items.findIndex((item) => item.contains(range.startContainer))
    if (index === -1) return { before: current, after: '' }

    const item = items[index]
    if (!item) return { before: current, after: '' }

    const beforeRange = range.cloneRange()
    beforeRange.selectNodeContents(item)
    beforeRange.setEnd(range.startContainer, range.startOffset)
    const offset = beforeRange.toString().length
    const itemText = item.innerText
    const beforeLines = [
      ...items.slice(0, index).map((entry) => entry.innerText),
      itemText.slice(0, offset),
    ]
    const afterLines = [
      itemText.slice(offset),
      ...items.slice(index + 1).map((entry) => entry.innerText),
    ]
    return { before: beforeLines.join('\n'), after: afterLines.join('\n') }
  }

  onMounted(() => {
    write(text())
  })

  watch(
    () => element.value,
    (el) => {
      if (el) write(text())
    },
  )

  watch(text, (nextText) => {
    const el = element.value
    if (!el) return

    // If local user is currently focused and typing in this element, avoid caret jump
    if (document.activeElement === el) return

    if (readValue(el) !== nextText) {
      write(nextText)
    }
  })

  const onInput = () => {
    if (!editable()) return
    const el = element.value
    if (!el) return

    const value = readValue(el)
    const clamped = clamp(value)
    if (clamped !== value) {
      write(clamped)
      emit('update:text', clamped)
      placeCaretAtEnd(el)
      return
    }
    emit('update:text', clamped)
  }

  const onFocus = () => {
    if (editable()) emit('focus')
  }

  const onBlur = () => {
    if (editable()) emit('blur')
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (!editable()) {
      event.preventDefault()
      return
    }

    // If block currently holds standard/placeholder text and user starts typing new text, clear it
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const el = element.value
      if (!el) return
      const current = readValue(el)
      if (isStandardText(current)) {
        el.innerText = ''
        emit('update:text', '')
      } else {
        const selection = window.getSelection()
        const selectedLength = selection?.toString().length ?? 0
        if (current.length - selectedLength >= maxLength) {
          event.preventDefault()
          return
        }
      }
    }

    if (event.key === 'Enter' && !event.isComposing && !options.multiline) {
      event.preventDefault()
      const el = element.value
      if (!el) return

      const current = readValue(el)
      if (isStandardText(current)) {
        write('')
        emit('insert-blocks', {
          currentText: '',
          blocks: [{ type: 'p', text: '' }],
        })
        return
      }

      const { before, after } = splitAtSelection(el, current)
      write(before)
      emit('insert-blocks', {
        currentText: clamp(before),
        blocks: [{ type: 'p', text: clamp(after) }],
      })
    }
  }

  const onPaste = (event: ClipboardEvent) => {
    if (!editable()) {
      event.preventDefault()
      return
    }

    event.preventDefault()
    const el = element.value
    if (!el) return

    const plainText = event.clipboardData?.getData('text/plain') ?? ''
    const html = event.clipboardData?.getData('text/html') ?? ''
    if (!plainText && !html) return

    const current = readValue(el)
    const standard = isStandardText(current)
    const pasteMode = options.pasteMode ?? 'paragraph'
    const split = standard
      ? { before: '', after: '' }
      : pasteMode === 'list'
        ? splitListAtSelection(el, current)
        : splitAtSelection(el, current)
    const { before, after } = split

    if (pasteMode === 'text') {
      if (standard) write('')
      const remaining = Math.max(0, maxLength - before.length - after.length)
      insertPlainText(el, plainText.slice(0, remaining), true)
      return
    }

    const parsed = parseClipboardText(plainText, html)

    if (parsed.kind === 'single') {
      if (standard) write('')
      const remaining = Math.max(0, maxLength - before.length - after.length)
      insertPlainText(
        el,
        (parsed.lines[0] ?? plainText).slice(0, remaining),
        options.multiline ?? false,
      )
      return
    }

    if (pasteMode === 'list') {
      const items = parsed.lines.map((line) => line.trim()).filter(Boolean)
      if (!items.length) return

      const prefix = before && !before.endsWith('\n') ? '\n' : ''
      const suffix = after && !after.startsWith('\n') ? '\n' : ''
      const next = clamp(`${before}${prefix}${items.join('\n')}${suffix}${after}`)
      write(next)
      emit('update:text', next)
      el.focus()
      placeCaretAtEnd(el.querySelector<HTMLElement>('li:last-child') ?? el)
      return
    }

    if (parsed.kind === 'list') {
      const next = clamp(before + after)
      write(next)
      emit('insert-blocks', {
        currentText: next,
        blocks: [
          {
            type: 'li',
            text: clamp(parsed.lines.join('\n')),
            ordered: Boolean(parsed.ordered),
          },
        ],
      })
      return
    }

    if (!parsed.lines.length) return

    const merged = [before + (parsed.lines[0] ?? ''), ...parsed.lines.slice(1)]
    merged[merged.length - 1] += after
    const currentText = clamp(merged[0] ?? '')
    write(currentText)
    emit('insert-blocks', {
      currentText,
      blocks: merged.slice(1).map((line) => ({ type: 'p', text: clamp(line) })),
    })
  }

  return { attributes, onInput, onFocus, onBlur, onKeydown, onPaste }
}
