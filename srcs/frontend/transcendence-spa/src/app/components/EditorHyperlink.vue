<template>
  <a
    v-if="safeHref"
    class="hyperlink cursor-pointer text-[color:var(--hyperlink-color)] transition-colors duration-150 hover:text-[color:color-mix(in_srgb,var(--hyperlink-color)_80%,black)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hyperlink-color)]"
    :class="underline ? 'underline underline-offset-2' : 'no-underline'"
    :href="safeHref"
    :target="target"
    :rel="rel"
    :style="style"
  >
    <slot>{{ text }}</slot>
  </a>
  <span v-else class="hyperlink hyperlink--invalid cursor-default text-inherit" :style="style">
    <slot>{{ text }}</slot>
  </span>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    url: string
    text?: string
    color?: string
    size?: string
    underline?: boolean
    target?: '_self' | '_blank' | '_parent' | '_top'
  }>(),
  {
    color: 'var(--color-primary)',
    size: 'inherit',
    underline: true,
    target: '_blank',
  },
)

// Only http(s) URLs are accepted, so schemes like `javascript:` or `data:`
// can never reach the `href` and turn the link into an XSS vector. The URL
// constructor also rejects relative and malformed values.
const safeHref = computed(() => {
  try {
    const parsed = new URL(props.url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
})

const rel = computed(() => (props.target === '_blank' ? 'noopener noreferrer' : undefined))

const style = computed(() => ({
  '--hyperlink-color': props.color,
  fontSize: props.size,
}))
</script>
