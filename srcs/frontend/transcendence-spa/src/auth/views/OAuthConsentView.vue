<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isOAuthProvider, startOAuth, type OAuthProvider } from '@/auth/oauth'
import { rememberTermsAcceptance } from '@/auth/terms'
import Button from '@/app/components/Button.vue'
import Icon, { type IconName } from '@/app/components/Icon.vue'
import TermsOfServiceModal from '@/app/components/TermsOfServiceModal.vue'

const route = useRoute()
const router = useRouter()

const provider = computed<OAuthProvider | null>(() => {
  const param = route.params.provider
  return isOAuthProvider(param) ? param : null
})

const providerName = computed(() => (provider.value === 'github' ? 'GitHub' : '42'))
const providerIcon = computed<IconName>(() => (provider.value === 'github' ? 'Github' : 'FortyTwo'))

const accepted = ref(false)
const termsOpen = ref(false)

onMounted(() => {
  if (!provider.value) router.replace('/login')
})

function continueWithProvider() {
  if (!provider.value || !accepted.value) return
  rememberTermsAcceptance()
  startOAuth(provider.value)
}
</script>

<template>
  <main
    class="box-border flex min-h-[calc(100vh_-_61px)] flex-col items-center justify-center px-6 py-10"
  >
    <section
      v-if="provider"
      class="box-border w-full max-w-[480px] rounded-xl border border-line-subtle bg-surface p-8 text-ink shadow-card"
    >
      <header class="text-center">
        <div class="mb-4 flex justify-center">
          <span
            class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-subtle text-ink"
          >
            <Icon :name="providerIcon" :size="30" />
          </span>
        </div>
        <h1 class="m-0 mb-1.5 text-[26px] leading-tight font-semibold text-ink">
          Continue with {{ providerName }}
        </h1>
        <p class="m-0 text-sm leading-normal text-ink-secondary">
          You are about to leave Trans Edit to sign in with {{ providerName }}.
        </p>
      </header>

      <div class="mt-6 flex flex-col gap-4">
        <p class="m-0 text-sm leading-normal text-ink-secondary">
          Before continuing, please review and accept our Terms of Service.
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <Button variant="outlined" color="primary" size="small" @click="termsOpen = true">
            <template #prepend>
              <Icon name="FileText" :size="18" />
            </template>
            Read Terms of Service
          </Button>
        </div>

        <label class="flex items-start gap-2 text-sm leading-normal text-ink-secondary">
          <input
            v-model="accepted"
            type="checkbox"
            class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--color-primary)]"
          />
          <span>I have read and agree to the Terms of Service.</span>
        </label>

        <Button size="large" class="w-full" :disabled="!accepted" @click="continueWithProvider">
          Continue with {{ providerName }}
        </Button>

        <router-link
          to="/login"
          class="text-center text-sm font-medium text-brand no-underline hover:text-brand-hover hover:underline"
        >
          Cancel
        </router-link>
      </div>
    </section>

    <TermsOfServiceModal v-model="termsOpen" />
  </main>
</template>
