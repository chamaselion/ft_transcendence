<template>
  <Transition name="toast">
    <div v-if="modelValue" class="toast" :class="[`toast--${type}`, { 'toast--fluid': fluid }]">
      <span class="toast__icon" />
      <div class="toast__content">
        <slot>
          <div class="toast__message">{{ message }}</div>
          <div v-if="hint" class="toast__hint">{{ hint }}</div>
        </slot>
      </div>
      <button class="toast__close" type="button" @click="close">×</button>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  type?: 'info' | 'good' | 'warn' | 'alert'
  message?: string
  hint?: string
  duration?: number
  fluid?: boolean
}>(), {
  type: 'info',
  duration: 4000,
  fluid: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

let timer: ReturnType<typeof setTimeout> | undefined

const close = () => emit('update:modelValue', false)

watch(
  () => props.modelValue,
  (open) => {
    clearTimeout(timer)
    if (open && props.duration > 0) {
      timer = setTimeout(close, props.duration)
    }
  }
)

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style lang="css" scoped>
.toast {
  display: inline-flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 280px;
  max-width: 420px;
  padding: 12px 14px;
  border: 1px solid var(--toast-color);
  border-radius: 8px;
  background-color: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
  box-sizing: border-box;
}

.toast--fluid {
  display: flex;
  width: 100%;
  max-width: 100%;
}

.toast--info { --toast-color: var(--color-primary); }
.toast--good { --toast-color: var(--color-good); }
.toast--warn { --toast-color: var(--color-warn); }
.toast--alert { --toast-color: var(--color-alert); }

.toast__icon {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  background-color: var(--toast-color);
}

.toast__content {
  flex: 1;
  font-size: 14px;
  min-width: 0;
}

.toast__message {
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
}

.toast__hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  word-break: break-word;
}

.toast__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 5px;
  background-color: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: background-color .2s ease, color .2s ease;
}

.toast__close:hover {
  background-color: color-mix(in srgb, var(--text-primary) 10%, transparent);
  color: var(--text-primary);
}

.toast__close:focus-visible {
  outline: 2px solid var(--toast-color);
  outline-offset: 1px;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity .2s ease, transform .2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
