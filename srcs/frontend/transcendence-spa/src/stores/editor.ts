import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { createBlock, type Block, type BlockType } from '@/app/editor/types'
import { useAuthStore } from '@/stores/auth'

export const useEditorStore = defineStore('editor', () => {
  const blocks = ref<Block[]>([])
  const activeBlockId = ref<string | null>(null)
  const clientId = ref<string>('')
  const authStore = useAuthStore()

  const activeBlock = computed(
    () => blocks.value.find((block) => block.id === activeBlockId.value) ?? null,
  )

  const activeIndex = computed(() =>
    blocks.value.findIndex((block) => block.id === activeBlockId.value),
  )

  function setClientId(id: string) {
    clientId.value = id
  }

  function setBlocks(next: Block[]) {
    blocks.value = next
    if (!next.some((block) => block.id === activeBlockId.value)) {
      const firstAvailable = next.find((b) => !isLockedByOther(b)) ?? next[0]
      activeBlockId.value = firstAvailable?.id ?? null
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
    const index = blocks.value.findIndex((item) => item.id === id)
    const current = blocks.value[index]
    if (index !== -1 && current) {
      blocks.value[index] = { ...current, text }
    }
  }

  function updateBlockDecorator(id: string, decorator: string) {
    const index = blocks.value.findIndex((item) => item.id === id)
    const current = blocks.value[index]
    if (index !== -1 && current) {
      blocks.value[index] = { ...current, decorator }
    }
  }

  function isLockedByOther(block: Block): boolean {
    if (!block.lockedBy) return false
    if (clientId.value) {
      return block.lockedBy !== clientId.value
    }
    if (authStore.userId) {
      return block.lockedBy !== authStore.userId
    }
    return true
  }

  function lock(id: string, lockHolder?: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (!block) return
    const holder = lockHolder || clientId.value || authStore.userId || 'locked'
    block.lockedBy = holder
  }

  function unlock(id: string) {
    const block = blocks.value.find((item) => item.id === id)
    if (!block) return
    const myId = clientId.value || authStore.userId
    if (!block.lockedBy || !myId || block.lockedBy === myId) {
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
    clientId,
    setClientId,
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
