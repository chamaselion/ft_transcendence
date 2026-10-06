import { computed, onMounted, watch, type Ref } from 'vue'

export interface EditableEmit {
  (event: 'update:text', value: string): void
  (event: 'focus'): void
  (event: 'blur'): void
}

interface EditableOptions {
  /** Preserve raw textContent instead of the rendered innerText (used by code). */
  raw?: boolean
  /** Allow the browser to insert line breaks (used by code, list and citation). */
  multiline?: boolean
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

  const write = (value = text()) => {
    const el = element.value
    if (!el) return
    if (options.write) options.write(el, value)
    else if (options.raw) el.textContent = value
    else el.innerText = value
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

    const currentText = options.read
      ? options.read(el)
      : options.raw
        ? (el.textContent ?? '')
        : el.innerText

    if (currentText !== nextText) {
      write(nextText)
    }
  })

  const onInput = () => {
    if (!editable()) return
    const el = element.value
    if (!el) return
    if (options.read) emit('update:text', options.read(el))
    else emit('update:text', options.raw ? (el.textContent ?? '') : el.innerText)
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
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const el = element.value
      const current = options.read ? options.read(el!) : el?.innerText ?? ''
      if (isStandardText(current)) {
        if (el) {
          el.innerText = ''
          emit('update:text', '')
        }
      }
    }

    if (!options.multiline && event.key === 'Enter') {
      event.preventDefault()
    }
  }

  const onPaste = (event: ClipboardEvent) => {
    if (!editable()) {
      event.preventDefault()
      return
    }
    const el = element.value
    const current = options.read ? options.read(el!) : el?.innerText ?? ''
    if (isStandardText(current) && el) {
      el.innerText = ''
      emit('update:text', '')
    }
  }

  return { attributes, onInput, onFocus, onBlur, onKeydown, onPaste }
}
