<script setup lang="ts">
import { computed } from 'vue'
import termsOfService from '@/assets/terms-of-service.md?raw'
import Button from '@/app/components/Button.vue'
import Modal from '@/app/components/Modal.vue'
import { renderMarkdown } from '@/utils/markdown'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    showAccept?: boolean
  }>(),
  {
    showAccept: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  accept: []
}>()

const rendered = computed(() => renderMarkdown(termsOfService))

const close = () => emit('update:modelValue', false)

const accept = () => {
  emit('accept')
  close()
}
</script>

<template>
  <Modal
    :model-value="props.modelValue"
    title="Terms of Service"
    size="large"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="tos-content text-[0.9rem] leading-relaxed text-ink-secondary" v-html="rendered" />

    <template #footer>
      <template v-if="props.showAccept">
        <Button variant="outlined" size="small" @click="close">Cancel</Button>
        <Button size="small" @click="accept">Accept</Button>
      </template>
      <Button v-else variant="outlined" size="small" @click="close">Close</Button>
    </template>
  </Modal>
</template>

<style scoped>
.tos-content :deep(h1) {
  margin: 0 0 0.75rem;
  color: var(--text-primary);
  font-size: 1.35rem;
  font-weight: 700;
}

.tos-content :deep(h2) {
  margin: 1.5rem 0 0.5rem;
  color: var(--text-primary);
  font-size: 1.05rem;
  font-weight: 600;
}

.tos-content :deep(h3) {
  margin: 1.25rem 0 0.5rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 600;
}

.tos-content :deep(p) {
  margin: 0.6rem 0;
}

.tos-content :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
  list-style: disc;
}

.tos-content :deep(li) {
  margin: 0.3rem 0;
}

.tos-content :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.tos-content :deep(blockquote) {
  margin: 0.75rem 0;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--color-warn);
  border-radius: 0 0.375rem 0.375rem 0;
  background: var(--bg-subtle);
}

.tos-content :deep(code) {
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
  background: var(--bg-subtle);
  font-size: 0.85em;
}

.tos-content :deep(hr) {
  margin: 1.25rem 0;
  border: 0;
  border-top: 1px solid var(--border-subtle);
}
</style>
