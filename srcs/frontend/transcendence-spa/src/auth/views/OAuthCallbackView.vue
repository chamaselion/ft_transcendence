<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { validateOAuthCallback } from '@/auth/oauth'
import { httpClient, HttpError } from '@/auth/auth.api'
import { useAuthStore } from '@/stores/auth'
import type { Root } from '@/auth/types/user'
import Button from '@/app/components/Button.vue'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const errorMessage = ref('')
const canRetrySession = ref(false)
let started = false

async function loadSession() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await httpClient.get<Root>('me', {
      headers: { 'Cache-Control': 'no-cache' },
    })
    const user = response?.user
    if (response?.loggedIn !== true || !user || !user.id) {
      throw new Error('Invalid session response')
    }
    authStore.setStoreToApiResponse(response)
    await router.replace('/profile')
  } catch {
    errorMessage.value =
      'Sign-in completed, but your session could not be loaded. Retry loading your session or start again.'
    canRetrySession.value = true
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (started) return
  started = true

  try {
    const provider = route.params.provider // Github or 42
    const query = new URLSearchParams(window.location.search)
    await router.replace({ path: route.path, query: {}, hash: '' })

    const callback = validateOAuthCallback(provider, query)
    await httpClient.post(`oauth/${callback.provider}/exchange`, {
      code: callback.code,
      state: callback.state,
    })

    authStore.invalidate()
    await loadSession()
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 409) {
        errorMessage.value =
          'An account conflict requires explicit linking. Sign in and link the provider from settings.'
      } else if (error.status === 501) {
        errorMessage.value = 'This sign-in provider is not configured.'
      } else if (error.status === 400 || error.status === 401) {
        errorMessage.value = 'Sign-in could not be verified. Please start again.'
      } else {
        errorMessage.value = 'Unable to finish sign-in. Please start again.'
      }
    } else if (error instanceof TypeError) {
      errorMessage.value = 'A network error interrupted sign-in. Please start again.'
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to finish sign-in. Please start again.'
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="grid min-h-[60vh] place-items-center p-6" :aria-busy="loading">
    <section
      class="box-border w-full max-w-[440px] rounded-xl border border-line-subtle bg-surface p-8 text-center text-ink"
    >
      <template v-if="loading">
        <h1 class="mt-0 text-2xl">Completing sign-in</h1>
        <p class="leading-relaxed" role="status">Please wait while we verify your account.</p>
      </template>
      <template v-else-if="errorMessage">
        <h1 class="mt-0 text-2xl">Unable to finish sign-in</h1>
        <p class="leading-relaxed" role="alert">{{ errorMessage }}</p>
        <Button v-if="canRetrySession" @click="loadSession">Retry loading session</Button>
        <RouterLink to="/login" class="mt-4 block text-brand hover:text-brand-hover hover:underline"
          >Back to login</RouterLink
        >
      </template>
    </section>
  </main>
</template>
