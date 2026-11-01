<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <figure class="image-block m-0 flex flex-col gap-2" :class="{ 'opacity-70': locked }">
    <div
      v-if="safeSrc"
      class="image-block__frame overflow-hidden rounded-md border border-line-subtle bg-subtle/30"
    >
      <img
        :src="safeSrc"
        :alt="alt || caption || $t('editor.image.altFallback')"
        class="block h-auto max-h-[32rem] w-full object-contain"
        :loading="exportMode ? 'eager' : 'lazy'"
      />
    </div>
    <div
      v-else-if="isEditable"
      class="image-block__empty flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-subtle bg-subtle/20 px-4 py-8 text-sm text-muted"
    >
      <Icon name="Photo" :size="28" />
      <span>{{ $t('editor.image.empty') }}</span>
    </div>
    <p v-else class="m-0 py-2 text-sm text-muted italic">{{ $t('editor.image.empty') }}</p>

    <div v-if="isEditable" class="flex flex-wrap items-center gap-2">
      <input
        ref="fileInput"
        class="hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        @change="onFileSelected"
      />
      <Button variant="outlined" size="x-small" :loading="uploading" @click="fileInput?.click()">
        {{ safeSrc ? $t('editor.image.replace') : $t('editor.image.upload') }}
      </Button>
      <Button v-if="safeSrc" variant="outlined" color="alert" size="x-small" @click="removeImage">
        {{ $t('editor.image.remove') }}
      </Button>
      <span v-if="error" class="text-xs text-danger">{{ error }}</span>
    </div>

    <input
      v-if="isEditable"
      :value="caption"
      class="image-block__caption w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-sm text-ink-secondary outline-none focus:border-line-subtle"
      :placeholder="$t('editor.image.captionPlaceholder')"
      :aria-label="$t('editor.image.caption')"
      @input="onCaptionInput"
      @focus="$emit('focus')"
      @blur="$emit('blur')"
    />
    <figcaption
      v-else-if="caption"
      class="image-block__caption text-center text-sm text-ink-secondary"
    >
      {{ caption }}
    </figcaption>
  </figure>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { uploadDocumentImage } from '@/app/editor/document.api'
import { useEditorStore } from '@/stores/editor'

const props = withDefaults(
  defineProps<{
    src?: string
    imageId?: string
    alt?: string
    caption?: string
    editable?: boolean
    locked?: boolean
    exportMode?: boolean
  }>(),
  {
    src: '',
    imageId: '',
    alt: '',
    caption: '',
    editable: false,
    locked: false,
    exportMode: false,
  },
)

const emit = defineEmits<{
  'update:text': [value: string]
  'update:data': [value: { src: string; imageId: string }]
  focus: []
  blur: []
}>()

const { t } = useI18n()
const store = useEditorStore()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref('')
const isEditable = computed(() => props.editable && !props.locked && !props.exportMode)
const safeSrc = computed(() =>
  /^\/api\/documents\/[0-9a-fA-F-]+\/images\/[0-9a-fA-F-]+$/.test(props.src) ? props.src : '',
)

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!store.documentId) {
    error.value = t('editor.image.uploadFailed')
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const image = await uploadDocumentImage(store.documentId, file)
    emit('update:data', { src: image.url, imageId: image.id })
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('editor.image.uploadFailed')
  } finally {
    uploading.value = false
  }
}

function removeImage() {
  emit('update:data', { src: '', imageId: '' })
}

function onCaptionInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:text', target.value)
}
</script>
