import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { createBlock, type Block, type BlockType } from '@/app/editor/types'
import { useUserStore } from '@/stores/user'

export const useEditorStore = defineStore('editor', () => {
  const blocks = ref<Block[]>([])
  const activeBlockId = ref<string | null>(null)
  const userStore = useUserStore()

  const activeBlock = computed(
    () => blocks.value.find((block) => block.id === activeBlockId.value) ?? null,
  )

  const activeIndex = computed(() =>
    blocks.value.findIndex((block) => block.id === activeBlockId.value),
  )

  function setBlocks(next: Block[]) {
    blocks.value = next
    if (!next.some((block) => block.id === activeBlockId.value)) {
      activeBlockId.value = next[0]?.id ?? null
    }
  }

  function setActive(id: string) {
    activeBlockId.value = id
  }

  function addBlock(type: BlockType, text = ''): Block {
    const block = createBlock(type, text)
    const index = activeIndex.value
    const at = index === -1 ? blocks.value.length : index + 1
    blocks.value.splice(at, 0, block)
    activeBlockId.value = block.id
    return block
  }

  function insertBlock(block: Block, afterBlockId?: string | null) {
    if (blocks.value.some((b) => b.id === block.id)) {
      // Already present, ignore duplicate insert
      return
    }
    if (!afterBlockId) {
      blocks.value.push(block)
      return
    }
    const index = blocks.value.findIndex((b) => b.id === afterBlockId)
    if (index === -1) {
      blocks.value.push(block)
    } else {
      blocks.value.splice(index + 1, 0, block)
    }
  }

  function removeBlock(blockId: string) {
    const index = blocks.value.findIndex((b) => b.id === blockId)
    if (index === -1) return
    blocks.value.splice(index, 1)
    if (activeBlockId.value === blockId) {
      const next = blocks.value[index] ?? blocks.value[index - 1] ?? null
      activeBlockId.value = next?.id ?? null
    }
  }

  function deleteActiveBlock(): string | null {
    const id = activeBlockId.value
    if (id) {
      removeBlock(id)
    }
    return id
  }

  function updateBlockText(id: string, text: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (block) block.text = text
  }

  function updateBlockDecorator(id: string, decorator: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (block) block.decorator = decorator
  }

  function isLockedByOther(block: Block) {
    return block.lockedBy !== null && block.lockedBy !== userStore.userId
  }

  function lock(id: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (!block) return
    if (block.lockedBy === null || block.lockedBy === userStore.userId) {
      block.lockedBy = userStore.userId
    }
  }

  function unlock(id: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (block && block.lockedBy === userStore.userId) {
      block.lockedBy = null
    }
  }

  function unlockBlockById(id: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (block) {
      block.lockedBy = null
    }
  }

  return {
    blocks,
    activeBlockId,
    activeBlock,
    activeIndex,
    setBlocks,
    setActive,
    addBlock,
    insertBlock,
    removeBlock,
    deleteActiveBlock,
    updateText: updateBlockText,
    updateBlockText,
    updateBlockDecorator,
    isLockedByOther,
    lock,
    unlock,
    unlockBlockById,
  }
})
