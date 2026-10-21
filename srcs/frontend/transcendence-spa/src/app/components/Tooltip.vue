<template>
  <span
    class="tooltip relative inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <span class="tooltip__trigger inline-flex">
      <slot />
    </span>
    <Transition name="tooltip">
      <span
        v-if="visible"
        class="tooltip__bubble pointer-events-none absolute z-[900] whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-[13px] text-surface"
        :class="placementClass"
        role="tooltip"
      >
        <slot name="content">{{ text }}</slot>
      </span>
    </Transition>
  </span>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    text?: string
    placement?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
  }>(),
  {
    placement: 'top',
    delay: 150,
  },
)

const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const placementClass = computed(
  () =>
    ({
      top: 'bottom-[calc(100%_+_8px)] left-1/2 -translate-x-1/2',
      bottom: 'top-[calc(100%_+_8px)] left-1/2 -translate-x-1/2',
      left: 'right-[calc(100%_+_8px)] top-1/2 -translate-y-1/2',
      right: 'left-[calc(100%_+_8px)] top-1/2 -translate-y-1/2',
    })[props.placement],
)

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

<style scoped>
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>
