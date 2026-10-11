<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getPendingOAuth } from '@/auth/oauth'
import { httpClient } from '../auth.api'
import { useAuthStore } from '@/stores/auth'
import type { Root } from '@/auth/types/user'

export interface OAuthState {
  sid: string
  n: string
  p: string
  m: string
  iat: string
}

const authStore = useAuthStore()

const route = useRoute()
const code = route.query.code as string | undefined // NOTE: short-lived authorization code, backend exchanges it with GitHub for an access token.

// NOTE: helper to decode the state base64URL encoded JSON string back to an object.
function decodeOAuthState(rawState: string): OAuthState {
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

const pendingOauth = getPendingOAuth()

console.log(code)
console.log(state.value)
console.log(pendingOauth)

onMounted(async () => {
  if (code && state.value) {
    if (!pendingOauth) {
      console.error('No pending OAuth request found. The state may not match.')
      return
    } else {
      if (pendingOauth.nonce !== state.value.n) {
        console.error('OAuth state nonce does not match the pending request.')
        return
      } else {
        try {
          const res = await httpClient.post<Root>('/api/auth/oauth/github/exchange', {
            code,
            state: state.value,
          })
          authStore.setStoreToApiResponse(res)
          window.location.href = '/settings'
        } catch (error) {
          console.error('Failed to exchange OAuth code for token:', error)
        }
      }
    }
    // Here you would typically send the code and state to your backend for verification and token exchange.
    console.log('OAuth code and state are ready to be sent to the backend.')
  } else {
    console.error('Missing OAuth code or state.')
  }
})
</script>

<template>
  <h1>Redirecting...</h1>
</template>
