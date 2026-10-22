<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import termsOfServiceEn from '@/assets/terms-of-service.md?raw'
import termsOfServiceDe from '@/assets/terms-of-service.de.md?raw'
import termsOfServiceHu from '@/assets/terms-of-service.hu.md?raw'
import privacyPolicyEn from '@/assets/privacy-policy.md?raw'
import privacyPolicyDe from '@/assets/privacy-policy.de.md?raw'
import privacyPolicyHu from '@/assets/privacy-policy.hu.md?raw'
import Button from '@/app/components/Button.vue'
import Modal from '@/app/components/Modal.vue'
import { renderMarkdown } from '@/utils/markdown'

export type LegalDocType = 'terms' | 'privacy'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    showAccept?: boolean
    initialDoc?: LegalDocType
  }>(),
  {
    showAccept: false,
    initialDoc: 'terms',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  accept: []
}>()

const { t, locale } = useI18n()
const activeDoc = ref<LegalDocType>(props.initialDoc)

watch(
  () => [props.modelValue, props.initialDoc] as const,
  ([open, doc]) => {
    if (open) {
      activeDoc.value = doc
    }
  },
)

const modalTitle = computed(() =>
  activeDoc.value === 'privacy' ? t('terms.privacyTitle') : t('terms.title'),
)

const termsByLocale: Record<string, string> = {
  en: termsOfServiceEn,
  de: termsOfServiceDe,
  hu: termsOfServiceHu,
}

const privacyByLocale: Record<string, string> = {
  en: privacyPolicyEn,
  de: privacyPolicyDe,
  hu: privacyPolicyHu,
}

const rendered = computed(() => {
  const lang = locale.value
  const source =
    activeDoc.value === 'privacy'
      ? (privacyByLocale[lang] ?? privacyPolicyEn)
      : (termsByLocale[lang] ?? termsOfServiceEn)
  return renderMarkdown(source)
})

const close = () => emit('update:modelValue', false)

const accept = () => {
  emit('accept')
  close()
}
</script>

<template>
  <Modal
    :model-value="props.modelValue"
    :title="modalTitle"
    size="large"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="mb-4 flex items-center gap-1 rounded-lg bg-subtle p-1">
      <button
        type="button"
        class="flex-1 cursor-pointer rounded-md border-none px-3 py-1.5 text-sm transition-[background-color,color] duration-150"
        :class="
          activeDoc === 'terms'
            ? 'bg-surface font-semibold text-ink shadow-[var(--shadow-sm)]'
            : 'bg-transparent font-medium text-ink-secondary hover:text-ink'
        "
        @click="activeDoc = 'terms'"
      >
        {{ $t('terms.title') }}
      </button>
      <button
        type="button"
        class="flex-1 cursor-pointer rounded-md border-none px-3 py-1.5 text-sm transition-[background-color,color] duration-150"
        :class="
          activeDoc === 'privacy'
            ? 'bg-surface font-semibold text-ink shadow-[var(--shadow-sm)]'
            : 'bg-transparent font-medium text-ink-secondary hover:text-ink'
        "
        @click="activeDoc = 'privacy'"
      >
        {{ $t('terms.privacyTitle') }}
      </button>
    </div>

    <div class="tos-content text-[0.9rem] leading-relaxed text-ink-secondary" v-html="rendered" />

    <template #footer>
      <template v-if="props.showAccept">
        <Button variant="outlined" size="small" @click="close">{{ $t('common.cancel') }}</Button>
        <Button size="small" @click="accept">{{ $t('terms.accept') }}</Button>
      </template>
      <Button v-else variant="outlined" size="small" @click="close">{{ $t('terms.close') }}</Button>
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
