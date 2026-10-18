<template>
  <div
    class="editor-block"
    :class="{
      'editor-block--active': active && !locked,
      'editor-block--locked': locked,
    }"
    :data-block-id="block.id"
    @click="!locked && $emit('focus')"
  >
    <component
      :is="component"
      v-bind="componentProps"
      @update:text="!locked && $emit('update:text', $event)"
      @insert-blocks="!locked && $emit('insert-blocks', $event)"
      @update:language="!locked && onUpdateLanguage($event)"
      @focus="!locked && $emit('focus')"
      @blur="$emit('blur')"
    />
    <span v-if="locked" class="editor-block__lock" title="This block is locked by another user">
      Locked
    </span>
  </div>
</template>

<script lang="ts" setup>
import { computed, type Component } from 'vue'
import EditorParagraph from '@/app/components/EditorParagraph.vue'
import EditorHeading from '@/app/components/EditorHeading.vue'
import EditorList from '@/app/components/EditorList.vue'
import EditorCitation from '@/app/components/EditorCitation.vue'
import EditorCode from '@/app/components/EditorCode.vue'
import { parseDecorator, serializeDecorator, type Block, type BlockType } from '@/app/editor/types'
import type { EditableInsertEvent } from '@/app/editor/useEditable'

const props = defineProps<{
  block: Block
  active?: boolean
  locked?: boolean
  exportMode?: boolean
}>()

const emit = defineEmits<{
  'update:text': [value: string]
  'insert-blocks': [event: EditableInsertEvent]
  'update:decorator': [value: string]
  focus: []
  blur: []
}>()

const componentMap: Record<BlockType, Component> = {
  p: EditorParagraph,
  h: EditorHeading,
  li: EditorList,
  cit: EditorCitation,
  c: EditorCode,
}

const decorator = computed(() => parseDecorator(props.block.decorator))
const component = computed(() => componentMap[decorator.value.type])

function onUpdateLanguage(language: string) {
  if (props.locked) return
  const updated = { ...decorator.value, language }
  emit('update:decorator', serializeDecorator(updated))
}

const componentProps = computed(() => {
  const decoratorValue = decorator.value
  const base = { editable: true, locked: props.locked }

  switch (decoratorValue.type) {
    case 'h':
      return { ...base, text: props.block.text, level: decoratorValue.level ?? 2 }
    case 'li':
      return {
        ...base,
        text: props.block.text,
        ordered: decoratorValue.ordered,
        marker: decoratorValue.marker,
        exportMode: props.exportMode,
      }
    case 'cit':
      return { ...base, text: props.block.text, source: decoratorValue.source }
    case 'c':
      return { ...base, code: props.block.text, language: decoratorValue.language }
    case 'p':
    default:
      return { ...base, text: props.block.text, align: decoratorValue.align || 'left' }
  }
})
</script>

<style lang="css" scoped>
.editor-block {
  position: relative;
  padding: 4px 12px;
  border-left: 3px solid transparent;
  border-radius: 6px;
  overflow-wrap: anywhere;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.editor-block--active {
  background-color: var(--bg-subtle);
  border-left-color: var(--color-primary);
}

.editor-block--locked {
  border: 2px solid var(--color-alert, #dc2626);
  border-radius: 6px;
  background-color: color-mix(in srgb, var(--color-alert, #dc2626) 8%, transparent);
  user-select: none;
  cursor: not-allowed;
}

.editor-block--locked :deep(*) {
  pointer-events: none;
  user-select: none;
}

.editor-block__lock {
  position: absolute;
  top: 4px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-alert, #dc2626);
  color: var(--color-alert-contrast, #ffffff);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
</style>
