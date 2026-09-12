<template>
  <Transition name="toast">
    <div v-if="modelValue" class="toast" :class="`toast--${type}`">
      <span class="toast__icon" />
      <div class="toast__content">
        <slot>{{ message }}</slot>
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
  duration?: number
}>(), {
  type: 'info',
  duration: 4000,
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
}

.toast__close {
  padding: 0;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.toast__close:hover {
  color: var(--text-primary);
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
