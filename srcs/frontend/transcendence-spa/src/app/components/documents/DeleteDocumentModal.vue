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
    :title="$t('documents.deleteTitle')"
    size="small"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="flex flex-col gap-3 text-[0.95rem] text-ink">
      <p>
        {{
          $t('documents.deleteConfirm', {
            title: props.document?.title || $t('common.untitledDocument'),
          })
        }}
      </p>
      <p class="m-0 text-[0.85rem] text-ink-secondary">
        {{ $t('documents.deleteWarning') }}
      </p>
    </div>
    <template #footer>
      <Button
        variant="outlined"
        size="small"
        :disabled="props.deleting"
        @click="emit('update:modelValue', false)"
      >
        {{ $t('common.cancel') }}
      </Button>
      <Button color="alert" size="small" :loading="props.deleting" @click="emit('confirm')">
        {{ $t('documents.deleteSubmit') }}
      </Button>
    </template>
  </Modal>
</template>
