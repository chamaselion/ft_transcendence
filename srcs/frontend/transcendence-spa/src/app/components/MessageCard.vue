<script setup lang="ts">
import { defineProps } from 'vue'

const props = defineProps<{
  message: string
  hint?: string
  modalMode?: boolean
  errorMsg?: boolean
}>()
</script>

<template>
  <div
    class="message-card"
    :class="{
      'modal-mode': props.modalMode,
      'error-mode': props.errorMsg
    }"
    role="status"
  >

    <div class="content">
      <p class="message">
        {{ props.message }}
      </p>

      <p
        v-if="props.hint"
        class="hint"
      >
        {{ props.hint }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.message-card {
  margin: 14px auto;
  box-sizing: border-box;

  display: flex;
  align-items: flex-start;
  gap: 14px;

  width: min(100%, 420px);
  padding: 18px 20px;

  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;

  box-shadow: var(--shadow-sm);

  color: var(--text-primary);
}

.content {
  text-align: center;
  flex: 1;
  min-width: 0;
}

.message {
  margin: 2px 0 0;

  color: var(--text-primary);

  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.hint {
  margin: 5px 0 0;

  color: var(--text-secondary);

  font-size: 13px;
  line-height: 1.5;
}

/* Error state */

.message-card.error-mode {
  border-color: #ef4444;
}

.error-mode {
  background: color-mix(
    in srgb,
    #ef4444 14%,
    var(--bg-surface)
  );

  color: #ef4444;
}

.error-mode .message {
  color: #ef4444;
}

.message-card.modal-mode {
  position: fixed;

  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  z-index: 1000;

  width: min(calc(100vw - 32px), 420px);
  padding: 24px;

  border-color: var(--border-default);

  box-shadow: var(--shadow-md);

  animation: message-card-enter 160ms ease-out;
}

.message-card:not(.modal-mode) {
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.message-card:not(.modal-mode):hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

@keyframes message-card-enter {
  from {
    opacity: 0;
    transform: translate(-50%, -47%) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .message-card {
    animation: none;
    transition: none;
  }
}
</style>
