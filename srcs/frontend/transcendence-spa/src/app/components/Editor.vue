<template>
  <div class="editor">
    <EditorNav :active-block-id="store.activeBlockId" @add="onAdd" @delete="onDelete" />

    <div class="editor__content">
      <EditorBlock
        v-for="block in store.blocks"
        :key="block.id"
        :block="block"
        :active="block.id === store.activeBlockId"
        :locked="store.isLockedByOther(block)"
        @focus="onFocus(block)"
        @blur="onBlur(block)"
        @update:text="onUpdateText(block, $event)"
      />

      <p v-if="store.blocks.length === 0" class="editor__empty">
        This document is empty. Add a block from the toolbar.
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { watch } from 'vue'
import EditorBlock from '@/app/components/EditorBlock.vue'
import EditorNav from '@/app/components/EditorNav.vue'
import { useEditorStore } from '@/stores/editor'
import { type Block, type BlockType } from '@/app/editor/types'

const props = withDefaults(
  defineProps<{
    modelValue: Block[]
    currentUserId?: string | null
  }>(),
  {
    currentUserId: null,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: Block[]] }>()

const store = useEditorStore()

const cloneBlock = (block: Block): Block => ({
  id: block.id,
  text: block.text,
  decorator: block.decorator,
  lockedBy: block.lockedBy,
})

const sync = () => emit('update:modelValue', store.blocks.map(cloneBlock))

const onAdd = (type: BlockType) => {
  store.addBlock(type)
  sync()
}

const onDelete = () => {
  store.deleteActiveBlock()
  sync()
}

const onUpdateText = (block: Block, text: string) => {
  store.updateText(block.id, text)
  sync()
}

const onFocus = (block: Block) => {
  store.setActive(block.id)
  if (!store.isLockedByOther(block)) {
    store.lock(block.id)
    sync()
  }
}

const onBlur = (block: Block) => {
  store.unlock(block.id)
  sync()
}

// Seed the store from the incoming model. Watchers below keep an externally
// replaced model in sync without clobbering the local (uncontrolled) editing.
store.setCurrentUser(props.currentUserId)
store.setBlocks(props.modelValue.map(cloneBlock))

watch(
  () => props.modelValue,
  (next) => {
    if (JSON.stringify(next) === JSON.stringify(store.blocks)) return
    store.setBlocks(next.map(cloneBlock))
  },
  { deep: true },
)

watch(
  () => props.currentUserId,
  (userId) => store.setCurrentUser(userId),
)
</script>

<style lang="css" scoped>
.editor {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
}

.editor__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 16px 8px;
}

.editor__empty {
  margin: 0;
  padding: 24px 12px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
