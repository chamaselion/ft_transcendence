<script setup lang="ts">
import Button from '@/app/components/Button.vue'
import Modal from '@/app/components/Modal.vue'
import type { DocumentData } from '@/app/editor/document.api'

const props = defineProps<{
  modelValue: boolean
  document: DocumentData | null
  deleting: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <Modal
    :model-value="props.modelValue"
    title="Delete Document"
    size="small"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="directory__delete-modal-content">
      <p>
        Are you sure you want to delete
        <strong>"{{ props.document?.title || 'Untitled Document' }}"</strong>?
      </p>
      <p class="directory__delete-warning">
        This document and all its contents will be permanently deleted. This action cannot be
        undone.
      </p>
    </div>
    <template #footer>
      <Button
        variant="outlined"
        size="small"
        :disabled="props.deleting"
        @click="emit('update:modelValue', false)"
      >
        Cancel
      </Button>
      <Button color="alert" size="small" :loading="props.deleting" @click="emit('confirm')">
        Delete Document
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.directory__delete-modal-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.directory__delete-warning {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
