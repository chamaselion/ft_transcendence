<template>
  <div class="editor" :class="[`editor--nav-${navPosition}`]">
    <!-- Nav toolbar (can be positioned on top, left or bottom) -->
    <EditorNav
      v-if="navPosition !== 'bottom'"
      :active-block-id="store.activeBlockId"
      :position="navPosition"
      @add="onAdd"
      @delete="onDelete"
    />

    <!-- Editor content: expands with the page by default, or scrollable if scrollable prop is true -->
    <div
      class="editor__content"
      :class="{ 'editor__content--scrollable': scrollable }"
    >
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

    <!-- Bottom Nav toolbar if navPosition is bottom -->
    <EditorNav
      v-if="navPosition === 'bottom'"
      :active-block-id="store.activeBlockId"
      :position="navPosition"
      @add="onAdd"
      @delete="onDelete"
    />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, watch } from 'vue'
import EditorBlock from '@/app/components/EditorBlock.vue'
import EditorNav from '@/app/components/EditorNav.vue'
import { useEditorStore } from '@/stores/editor'
import {
  createBlock,
  type Block,
  type BlockType,
  type EditorDataProvider,
} from '@/app/editor/types'

const props = withDefaults(
  defineProps<{
    provider: EditorDataProvider
    scrollable?: boolean
    navPosition?: 'top' | 'left' | 'bottom'
  }>(),
  {
    scrollable: false,
    navPosition: 'top',
  },
)

const emit = defineEmits<{
  error: [error: string]
}>()

const store = useEditorStore()

function wireProvider(provider: EditorDataProvider) {
  provider.onInit = (e) => {
    store.setBlocks(e.blocks)
  }

  provider.onCreated = (e) => {
    store.insertBlock(e.block, e.afterBlockId)
  }

  provider.onUpdated = (e) => {
    if (e.text !== undefined) {
      store.updateBlockText(e.blockId, e.text)
    }
    if (e.decorator !== undefined) {
      store.updateBlockDecorator(e.blockId, e.decorator)
    }
  }

  provider.onDeleted = (e) => {
    store.removeBlock(e.blockId)
  }

  provider.onUnlocked = (e) => {
    store.unlockBlockById(e.blockId)
  }

  provider.onError = (e) => {
    emit('error', e.error)
  }
}

onMounted(() => {
  wireProvider(props.provider)
})

watch(
  () => props.provider,
  (newProvider) => {
    wireProvider(newProvider)
  },
)

const onAdd = async (type: BlockType) => {
  const block = createBlock(type)
  const afterBlockId = store.activeBlockId
  store.insertBlock(block, afterBlockId)
  store.setActive(block.id)

  await props.provider.sendBlockCreate({
    block,
    afterBlockId,
    type,
    text: block.text,
    decorator: block.decorator,
  })
}

const onDelete = async () => {
  const blockId = store.activeBlockId
  if (!blockId) return
  store.removeBlock(blockId)

  await props.provider.sendBlockDelete({
    blockId,
  })
}

const onUpdateText = async (block: Block, text: string) => {
  store.updateBlockText(block.id, text)

  await props.provider.sendEdit({
    blockId: block.id,
    text,
    decorator: block.decorator,
  })
}

const onFocus = (block: Block) => {
  store.setActive(block.id)
  if (!store.isLockedByOther(block)) {
    store.lock(block.id)
  }
}

const onBlur = (block: Block) => {
  store.unlock(block.id)
}
</script>

<style lang="css" scoped>
.editor {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
}

.editor--nav-top {
  flex-direction: column;
}

.editor--nav-left {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.editor--nav-bottom {
  flex-direction: column;
}

.editor__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  width: 100%;
  padding: 16px 8px;
}

/* Expands naturally with site by default, or scrollable when scrollable prop is active */
.editor__content--scrollable {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  padding-right: 12px;
}

.editor__empty {
  margin: 0;
  padding: 32px 16px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}
</style>
