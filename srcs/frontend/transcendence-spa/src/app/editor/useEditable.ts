import { computed, onMounted, type Ref } from 'vue'

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

/**
 * Wires an element up for uncontrolled `contenteditable` editing.
 *
 * The initial content is written once on mount and never re-bound to reactive
 * state, so Vue re-renders can not move the caret while the user types. Every
 * keystroke is read back from the DOM and emitted as `update:text`.
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

  const write = () => {
    const el = element.value
    if (el && editable()) {
      if (options.write) options.write(el, text())
      else if (options.raw) el.textContent = text()
      else el.innerText = text()
    }
  }

  onMounted(write)

  const onInput = () => {
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
    if (!options.multiline && event.key === 'Enter') {
      event.preventDefault()
    }
  }

  return { attributes, onInput, onFocus, onBlur, onKeydown }
}
