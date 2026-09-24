<template>
  <div
    class="editor-block"
    :class="{
      'editor-block--active': active,
      'editor-block--locked': locked,
    }"
    :data-block-id="block.id"
    @click="$emit('focus')"
  >
    <component
      :is="component"
      v-bind="componentProps"
      @update:text="$emit('update:text', $event)"
      @focus="$emit('focus')"
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
import { parseDecorator, type Block, type BlockType } from '@/app/editor/types'

const props = defineProps<{
  block: Block
  active?: boolean
  locked?: boolean
}>()

defineEmits<{
  'update:text': [value: string]
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
      }
    case 'cit':
      return { ...base, text: props.block.text, source: decoratorValue.source }
    case 'c':
      return { ...base, code: props.block.text, language: decoratorValue.language }
    case 'p':
    default:
      return { ...base, text: props.block.text }
  }
})
</script>

<style lang="css" scoped>
.editor-block {
  position: relative;
  padding: 4px 12px;
  border-left: 3px solid transparent;
  border-radius: 6px;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.editor-block--active {
  background-color: var(--bg-subtle);
  border-left-color: var(--color-primary);
}

.editor-block--locked {
  background-color: color-mix(in srgb, var(--color-warn) 12%, transparent);
}

.editor-block__lock {
  position: absolute;
  top: 4px;
  right: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: var(--color-warn);
  color: var(--color-warn-contrast);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
