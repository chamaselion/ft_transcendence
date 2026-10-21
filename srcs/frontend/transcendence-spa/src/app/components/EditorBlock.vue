<template>
  <div
    class="editor-block relative rounded-md border-l-[3px] border-l-transparent px-3 py-1 transition-[background-color,border-color] duration-150"
    :class="{
      'editor-block--active border-l-brand bg-subtle': active && !locked,
      'editor-block--locked cursor-not-allowed border-2 border-l-2 border-danger bg-danger/[0.08] select-none [&_*]:pointer-events-none [&_*]:select-none':
        locked,
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
    <FoldableTextPreview
      v-if="isForeignLanguage && canonicalText && decorator.type !== 'c' && decorator.type !== 'cit'"
      :text="canonicalText"
      :is-dirty="isDirty"
    />
    <span
      v-if="locked"
      class="editor-block__lock pointer-events-auto absolute top-1 right-2 rounded bg-danger px-2 py-0.5 text-[10px] font-bold tracking-[0.05em] text-danger-contrast uppercase shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
      title="This block is locked by another user"
    >
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
import FoldableTextPreview from '@/app/components/FoldableTextPreview.vue'
import { parseDecorator, serializeDecorator, type Block, type BlockType } from '@/app/editor/types'
import type { EditableInsertEvent } from '@/app/editor/useEditable'
import { useEditorStore } from '@/stores/editor'

const props = defineProps<{
  block: Block
  active?: boolean
  locked?: boolean
  exportMode?: boolean
}>()

const store = useEditorStore()
const canonicalText = computed(() => store.getCanonicalText(props.block.id))
const isForeignLanguage = computed(() => store.activeLanguage !== 'en')
const isDirty = computed(() => store.isBlockDirty(props.block.id))

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
