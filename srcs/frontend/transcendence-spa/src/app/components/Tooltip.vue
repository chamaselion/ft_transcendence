<template>
  <span
    class="tooltip"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <span class="tooltip__trigger">
      <slot />
    </span>
    <Transition name="tooltip">
      <span
        v-if="visible"
        class="tooltip__bubble"
        :class="`tooltip__bubble--${placement}`"
        role="tooltip"
      >
        <slot name="content">{{ text }}</slot>
      </span>
    </Transition>
  </span>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}>(), {
  placement: 'top',
  delay: 150,
})

const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const show = () => {
  clearTimeout(timer)
  timer = setTimeout(() => (visible.value = true), props.delay)
}

const hide = () => {
  clearTimeout(timer)
  visible.value = false
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style lang="css" scoped>
.tooltip {
  position: relative;
  display: inline-flex;
}

.tooltip__trigger {
  display: inline-flex;
}

.tooltip__bubble {
  position: absolute;
  z-index: 900;
  padding: 6px 10px;
  border-radius: 6px;
  background-color: var(--text-primary);
  color: var(--bg-surface);
  font-size: 13px;
  white-space: nowrap;
  pointer-events: none;
}

.tooltip__bubble--top {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.tooltip__bubble--bottom {
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.tooltip__bubble--left {
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

.tooltip__bubble--right {
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity .15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>
