<template>
  <a
    v-if="safeHref"
    class="hyperlink"
    :class="{ 'hyperlink--underline': underline }"
    :href="safeHref"
    :target="target"
    :rel="rel"
    :style="style"
  >
    <slot>{{ text }}</slot>
  </a>
  <span v-else class="hyperlink hyperlink--invalid" :style="style">
    <slot>{{ text }}</slot>
  </span>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  url: string
  text?: string
  color?: string
  size?: string
  underline?: boolean
  target?: '_self' | '_blank' | '_parent' | '_top'
}>(), {
  color: 'var(--color-primary)',
  size: 'inherit',
  underline: true,
  target: '_blank',
})

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

<style lang="css" scoped>
.hyperlink {
  color: var(--hyperlink-color, var(--color-primary));
  cursor: pointer;
  text-decoration: none;
  transition: color .15s ease-in-out;
}

.hyperlink--underline {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.hyperlink:hover {
  color: color-mix(in srgb, var(--hyperlink-color, var(--color-primary)) 80%, black);
  text-decoration: underline;
}

.hyperlink:focus-visible {
  outline: 2px solid var(--hyperlink-color, var(--color-primary));
  outline-offset: 2px;
}

.hyperlink--invalid {
  color: inherit;
  cursor: default;
}

.hyperlink--invalid:hover {
  color: inherit;
  text-decoration: none;
}
</style>
