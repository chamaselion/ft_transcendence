<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-6"
        @click.self="closeOnOverlay && close()"
      >
        <div
          class="modal__panel flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-surface text-ink shadow-card"
          :class="sizeClass"
        >
          <header
            class="modal__header flex items-center gap-3 border-b border-line-subtle px-5 py-4"
          >
            <slot name="header">
              <h2 class="modal__title m-0 flex-1 text-lg">{{ title }}</h2>
            </slot>
            <button
              class="modal__close h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0 text-[22px] leading-none text-ink-secondary hover:bg-subtle hover:text-ink"
              type="button"
              @click="close"
            >
              ×
            </button>
          </header>
          <div class="modal__body overflow-y-auto p-5">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="modal__footer flex justify-end gap-2 border-t border-line-subtle bg-subtle px-5 py-4"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, watch } from 'vue'

let openModalCount = 0

const setBodyLocked = (locked: boolean) => {
  if (locked) {
    openModalCount += 1
    document.body.style.overflow = 'hidden'
    return
  }

  openModalCount = Math.max(0, openModalCount - 1)
  if (openModalCount === 0) document.body.style.overflow = ''
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    size?: 'small' | 'default' | 'large'
    closeOnOverlay?: boolean
    closeOnEsc?: boolean
  }>(),
  {
    size: 'default',
    closeOnOverlay: true,
    closeOnEsc: true,
  },
)

const sizeClass = computed(
  () =>
    ({
      small: 'max-w-[360px]',
      default: 'max-w-[520px]',
      large: 'max-w-[800px]',
    })[props.size],
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const close = () => emit('update:modelValue', false)

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.closeOnEsc) close()
}

let isOpen = false

const syncOpenState = (open: boolean) => {
  if (open === isOpen) return
  isOpen = open

  if (open) {
    document.addEventListener('keydown', onKeydown)
    setBodyLocked(true)
  } else {
    document.removeEventListener('keydown', onKeydown)
    setBodyLocked(false)
  }
}

watch(() => props.modelValue, syncOpenState, { immediate: true })

onBeforeUnmount(() => {
  if (!isOpen) return
  document.removeEventListener('keydown', onKeydown)
  setBodyLocked(false)
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
