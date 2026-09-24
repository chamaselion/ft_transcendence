import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { createBlock, type Block, type BlockType } from '@/app/editor/types'

export const useEditorStore = defineStore('editor', () => {
  const blocks = ref<Block[]>([])
  const activeBlockId = ref<string | null>(null)
  const currentUserId = ref<string | null>(null)

  const activeBlock = computed(
    () => blocks.value.find((block) => block.id === activeBlockId.value) ?? null,
  )

  const activeIndex = computed(() =>
    blocks.value.findIndex((block) => block.id === activeBlockId.value),
  )

  function setCurrentUser(userId: string | null) {
    currentUserId.value = userId
  }

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

  function deleteActiveBlock() {
    const index = activeIndex.value
    if (index === -1) return
    blocks.value.splice(index, 1)
    const next = blocks.value[index] ?? blocks.value[index - 1] ?? null
    activeBlockId.value = next?.id ?? null
  }

  function updateText(id: string, text: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (block) block.text = text
  }

  function isLockedByOther(block: Block) {
    return block.lockedBy !== null && block.lockedBy !== currentUserId.value
  }

  function lock(id: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (!block) return
    if (block.lockedBy === null || block.lockedBy === currentUserId.value) {
      block.lockedBy = currentUserId.value
    }
  }

  function unlock(id: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (block && block.lockedBy === currentUserId.value) {
      block.lockedBy = null
    }
  }

  return {
    blocks,
    activeBlockId,
    currentUserId,
    activeBlock,
    activeIndex,
    setCurrentUser,
    setBlocks,
    setActive,
    addBlock,
    deleteActiveBlock,
    updateText,
    isLockedByOther,
    lock,
    unlock,
  }
})
