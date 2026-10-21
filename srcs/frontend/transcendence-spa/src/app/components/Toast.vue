<template>
  <Transition name="toast">
    <div
      v-if="modelValue"
      class="toast items-start gap-2.5 rounded-lg border bg-surface px-3.5 py-3 text-ink shadow-card"
      :class="[layoutClass, typeClass]"
    >
      <span
        class="toast__icon mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--toast-color)]"
      />
      <div class="toast__content min-w-0 flex-1 text-sm">
        <slot>
          <div class="toast__message font-medium leading-[1.4] break-words">{{ message }}</div>
          <div
            v-if="hint"
            class="toast__hint mt-1 text-xs leading-[1.4] break-words text-ink-secondary"
          >
            {{ hint }}
          </div>
        </slot>
      </div>
      <button
        class="toast__close inline-flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-lg leading-none text-muted transition-colors duration-200 [font:inherit] hover:bg-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--toast-color)]"
        type="button"
        @click="close"
      >
        ×
      </button>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    type?: 'info' | 'good' | 'warn' | 'alert'
    message?: string
    hint?: string
    duration?: number
    fluid?: boolean
  }>(),
  {
    type: 'info',
    duration: 4000,
    fluid: false,
  },
)

const layoutClass = computed(() =>
  props.fluid ? 'flex w-full max-w-full min-w-[280px]' : 'inline-flex min-w-[280px] max-w-[420px]',
)

const typeClass = computed(
  () =>
    ({
      info: 'border-[color:var(--color-primary)] [--toast-color:var(--color-primary)]',
      good: 'border-[color:var(--color-good)] [--toast-color:var(--color-good)]',
      warn: 'border-[color:var(--color-warn)] [--toast-color:var(--color-warn)]',
      alert: 'border-[color:var(--color-alert)] [--toast-color:var(--color-alert)]',
    })[props.type],
)

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
  },
)

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
