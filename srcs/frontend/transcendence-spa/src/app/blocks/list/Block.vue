<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <component
    v-if="exportMode"
    :is="ordered ? 'ol' : 'ul'"
    class="list list--export"
    :class="{ 'list--export--checklist': checklist }"
    :style="style"
  >
    <li
      v-for="(item, index) in lines"
      :key="index"
      class="list__item"
      :class="{ 'list__item--checked': checklist && checkedAt(index) }"
    >
      <span class="list__marker" aria-hidden="true">{{
        checklist ? (checkedAt(index) ? '[x]' : '[ ]') : markerLabel(index)
      }}</span
      >{{ item }}
    </li>
  </component>

  <div
    v-else-if="checklist"
    :ref="setChecklistElement"
    class="checklist flex flex-col gap-1"
    :class="{ 'checklist--locked cursor-not-allowed opacity-70': locked }"
    @focusin="$emit('focus')"
    @focusout="onChecklistFocusOut"
  >
    <div
      v-for="(item, index) in checklistLines"
      :key="index"
      class="checklist__item flex items-center gap-2"
    >
      <input
        type="checkbox"
        class="checklist__checkbox h-4 w-4 shrink-0 accent-[var(--color-primary)]"
        :checked="checkedAt(index)"
        :disabled="!isEditable"
        :aria-label="$t('editor.checklist.toggle', { index: index + 1 })"
        @change="toggleItem(index)"
      />
      <input
        type="text"
        class="checklist__text min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-ink outline-none focus:border-line-subtle"
        :class="{ 'text-muted': checkedAt(index) }"
        :value="item"
        :disabled="!isEditable"
        :data-checklist-index="index"
        :placeholder="$t('editor.checklist.placeholder')"
        @input="onItemInput(index, $event)"
        @keydown="onItemKeydown(index, $event)"
      />
      <button
        v-if="isEditable"
        type="button"
        class="checklist__remove shrink-0 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-danger/10 hover:text-danger"
        :aria-label="$t('editor.checklist.remove')"
        :title="$t('editor.checklist.remove')"
        @click="removeItem(index)"
      >
        ×
      </button>
    </div>
    <button
      v-if="isEditable"
      type="button"
      class="checklist__add self-start rounded px-1.5 py-0.5 text-xs text-muted hover:bg-subtle hover:text-ink"
      @click="addItem(checklistLines.length - 1)"
    >
      + {{ $t('editor.checklist.add') }}
    </button>
  </div>

  <component
    v-else
    :is="ordered ? 'ol' : 'ul'"
    :ref="setElement"
    class="list space-y-1 pl-[1.5em] leading-relaxed [margin:0]"
    :class="{
      'list--editable rounded outline-none': isEditable,
      'list--locked cursor-not-allowed opacity-70': locked,
      'list--empty': isEmpty,
    }"
    :style="style"
    v-bind="attributes"
    @input="onInput"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="handleKeydown"
    @paste="onPaste"
  >
    <template v-if="!editable">
      <li v-for="(item, index) in items" :key="index" class="list__item">
        <slot name="item" :item="item" :index="index">{{ item }}</slot>
      </li>
    </template>
  </component>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import { useEditable, type EditableInsertEvent } from '@/app/editor/useEditable'

const props = withDefaults(
  defineProps<{
    items?: string[]
    text?: string
    ordered?: boolean
    marker?: string
    checklist?: boolean
    checked?: boolean[]
    editable?: boolean
    locked?: boolean
    typeface?: string
    color?: string
    bgColor?: string
    size?: string
    exportMode?: boolean
  }>(),
  {
    items: () => [],
    text: '',
    ordered: false,
    marker: '',
    checklist: false,
    checked: () => [],
    editable: false,
    locked: false,
    typeface: 'inherit',
    color: 'var(--text-primary)',
    bgColor: 'transparent',
    size: '1rem',
    exportMode: false,
  },
)

const emit = defineEmits<{
  'update:text': [value: string]
  'update:content': [value: { text: string; checked: boolean[] }]
  'insert-blocks': [event: EditableInsertEvent]
  focus: []
  blur: []
}>()

const element = ref<HTMLElement | null>(null)
const checklistElement = ref<HTMLElement | null>(null)
const setElement = (el: Element | ComponentPublicInstance | null) => {
  element.value = el instanceof HTMLElement ? el : null
}
const setChecklistElement = (el: Element | ComponentPublicInstance | null) => {
  checklistElement.value = el instanceof HTMLElement ? el : null
}

const isEditable = computed(() => props.editable && !props.locked)

const lines = computed(() => (props.text ? props.text.split('\n') : props.items))
const checklistLines = computed(() => (props.text ? props.text.split('\n') : ['']))
const isEmpty = computed(() => isEditable.value && lines.value.join('').trim() === '')

function checkedState(length = checklistLines.value.length): boolean[] {
  const next = Array.isArray(props.checked) ? props.checked.slice() : []
  while (next.length < length) next.push(false)
  return next.slice(0, length)
}

function checkedAt(index: number): boolean {
  return Boolean(props.checked?.[index])
}

function emitContent(nextLines: string[], nextChecked: boolean[]) {
  emit('update:content', {
    text: nextLines.join('\n'),
    checked: nextChecked,
  })
}

function onItemInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  const nextLines = checklistLines.value.slice()
  nextLines[index] = target.value
  emitContent(nextLines, checkedState(nextLines.length))
}

function toggleItem(index: number) {
  const next = checkedState()
  next[index] = !next[index]
  emitContent(checklistLines.value.slice(), next)
}

function addItem(afterIndex: number) {
  const nextLines = checklistLines.value.slice()
  const nextChecked = checkedState()
  const insertAt = Math.min(Math.max(afterIndex + 1, 0), nextLines.length)
  nextLines.splice(insertAt, 0, '')
  nextChecked.splice(insertAt, 0, false)
  emitContent(nextLines, nextChecked)
  nextTick(() => {
    const input = checklistElement.value?.querySelector<HTMLInputElement>(
      `[data-checklist-index="${insertAt}"]`,
    )
    input?.focus()
  })
}

function removeItem(index: number) {
  if (checklistLines.value.length <= 1) return
  const nextLines = checklistLines.value.slice()
  const nextChecked = checkedState()
  nextLines.splice(index, 1)
  nextChecked.splice(index, 1)
  emitContent(nextLines, nextChecked)
}

function onChecklistFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && checklistElement.value?.contains(next)) return
  emit('blur')
}

function onItemKeydown(index: number, event: KeyboardEvent) {
  if (!isEditable.value) return
  if (event.key === 'Enter') {
    event.preventDefault()
    addItem(index)
  } else if (
    event.key === 'Backspace' &&
    !checklistLines.value[index] &&
    checklistLines.value.length > 1
  ) {
    event.preventDefault()
    removeItem(index)
    nextTick(() => {
      const input = checklistElement.value?.querySelector<HTMLInputElement>(
        `[data-checklist-index="${Math.max(0, index - 1)}"]`,
      )
      input?.focus()
    })
  }
}

const { attributes, onInput, onFocus, onBlur, onKeydown, onPaste } = useEditable(
  element,
  () => lines.value.join('\n'),
  () => isEditable.value,
  emit,
  {
    multiline: true,
    pasteMode: 'list',
    write: (el, text) => {
      el.replaceChildren()
      text.split('\n').forEach((line) => {
        const item = document.createElement('li')
        item.textContent = line
        el.appendChild(item)
      })
    },
    read: (el) => {
      const items = Array.from(el.querySelectorAll('li')).map((item) => item.innerText)
      return items.length ? items.join('\n') : el.innerText
    },
  },
)

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Backspace' || event.key === 'Delete') {
    const el = element.value
    const items = el ? Array.from(el.querySelectorAll('li')) : []
    const onlyEmptyItem = items.length <= 1 && items.every((item) => item.innerText.trim() === '')

    if (onlyEmptyItem) {
      event.preventDefault()
      return
    }
  }

  onKeydown(event)
}

const style = computed(() => ({
  fontFamily: props.typeface,
  color: props.color,
  backgroundColor: props.bgColor,
  fontSize: props.size,
  listStyleType: props.exportMode ? 'none' : props.marker || (props.ordered ? 'decimal' : 'disc'),
}))

function markerLabel(index: number): string {
  if (props.ordered) return `${index + 1}.`
  if (props.marker === 'circle') return '◦'
  if (props.marker === 'square') return '▪'
  return '•'
}
</script>
