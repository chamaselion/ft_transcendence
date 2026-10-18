<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal"
        @click.self="closeOnOverlay && close()"
      >
        <div class="modal__panel" :class="`modal__panel--${size}`">
          <header class="modal__header">
            <slot name="header">
              <h2 class="modal__title">{{ title }}</h2>
            </slot>
            <button class="modal__close" type="button" @click="close">×</button>
          </header>
          <div class="modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, watch } from 'vue'

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

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  size?: 'small' | 'default' | 'large'
  closeOnOverlay?: boolean
  closeOnEsc?: boolean
}>(), {
  size: 'default',
  closeOnOverlay: true,
  closeOnEsc: true,
})

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
  isOpen = false
})
</script>

<style lang="css" scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: rgba(0, 0, 0, .5);
}

.modal__panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  border-radius: 12px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.modal__panel--small { max-width: 360px; }
.modal__panel--large { max-width: 800px; }

.modal__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal__title {
  flex: 1;
  margin: 0;
  font-size: 18px;
}

.modal__close {
  padding: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.modal__close:hover {
  background-color: var(--bg-subtle);
  color: var(--text-primary);
}

.modal__body {
  padding: 20px;
  overflow-y: auto;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle);
  background-color: var(--bg-subtle);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity .2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
