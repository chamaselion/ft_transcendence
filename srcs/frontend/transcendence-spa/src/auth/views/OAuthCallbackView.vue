<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const code = route.query.code as string | undefined // NOTE: short-lived authorization code, backend exchanges it with GitHub for an access token.

// NOTE: helper to decode the state base64URL encoded JSON string back to an object.
function decodeOAuthState(rawState: string): unknown {
  // Convert Base64URL to standard Base64.
  const base64 = rawState.replace(/-/g, '+').replace(/_/g, '/')

  // Restore padding.
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')

  // Decode Base64 bytes, then UTF-8 JSON.
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
  const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)

  return JSON.parse(json)
}

const state = computed(() => {
  const rawState = route.query.state as string | undefined
  if (!rawState) return null
  try {
    return decodeOAuthState(rawState)
  } catch (error) {
    console.error('Failed to decode OAuth state:', error)
    return null
  }
})

console.log(code)
console.log(state.value)
</script>

<template>
  <h1>Redirecting...</h1>
</template>
