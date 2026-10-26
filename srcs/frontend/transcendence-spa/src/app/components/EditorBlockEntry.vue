<template>
  <EditorConflict
    v-if="conflict"
    data-pdf-split="avoid"
    :block="block"
    :conflict="conflict"
    :editable="editable"
    @update-local="$emit('update-local', $event)"
    @resolve-local="$emit('resolve-local')"
    @resolve-remote="$emit('resolve-remote')"
  />
  <EditorBlock
    v-else
    data-pdf-split="avoid"
    :block="block"
    :active="active"
    :locked="locked"
    :elaborating="elaborating"
    :translating="translating"
    :export-mode="exportMode"
    :editable="editable"
    @focus="$emit('focus')"
    @blur="$emit('blur')"
    @update:text="$emit('update:text', $event)"
    @insert-blocks="$emit('insert-blocks', $event)"
    @update:decorator="$emit('update:decorator', $event)"
  />
</template>

<script setup lang="ts">
import EditorBlock from '@/app/components/EditorBlock.vue'
import EditorConflict from '@/app/components/EditorConflict.vue'
import type { Block } from '@/app/editor/types'
import type { BlockConflict } from '@/app/editor/merge'
import type { EditableInsertEvent } from '@/app/editor/useEditable'

withDefaults(
  defineProps<{
    block: Block
    conflict?: BlockConflict | null
    editable?: boolean
    active?: boolean
    locked?: boolean
    elaborating?: boolean
    translating?: boolean
    exportMode?: boolean
  }>(),
  {
    conflict: null,
    editable: true,
    active: false,
    locked: false,
    elaborating: false,
    translating: false,
    exportMode: false,
  },
)

defineEmits<{
  focus: []
  blur: []
  'update:text': [value: string]
  'insert-blocks': [event: EditableInsertEvent]
  'update:decorator': [value: string]
  'update-local': [value: { text?: string; decorator?: string }]
  'resolve-local': []
  'resolve-remote': []
}>()
</script>
