<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import DocumentDirectory from '@/app/components/DocumentDirectory.vue'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

function openCookieBanner() {
  window.dispatchEvent(new CustomEvent('open-cookie-banner'))
}
</script>

<template>
  <main class="box-border flex min-h-[calc(100vh_-_61px)] w-full flex-col px-6 py-10">
    <template v-if="authStore.isAuthenticated">
      <DocumentDirectory />
    </template>

    <template v-else>
      <section
        class="mx-auto mt-[60px] flex max-w-[640px] flex-col items-center rounded-2xl border border-line-subtle bg-surface px-8 py-12 text-center shadow-card"
      >
        <div
          class="mb-5 inline-flex items-center gap-1.5 rounded-full bg-brand/12 px-3 py-1 text-[0.8rem] font-semibold text-brand"
        >
          <Icon name="Sparkles" :size="16" />
          <span>New</span>
        </div>
        <h1 class="m-0 mb-3 text-[2.4rem] leading-tight font-bold text-ink">
          Welcome to Trans Edit
        </h1>
        <p class="m-0 mb-8 text-[1.1rem] leading-relaxed text-ink-secondary">
          A collaborative document editor built for teams. Create, edit, and share documents in
          real-time with your team members.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-4">
          <Button @click="router.push('/register')">Get Started</Button>
          <Button @click="router.push('/login')">Login</Button>
        </div>
      </section>
    </template>

    <footer
      class="mt-auto flex w-full flex-wrap items-center justify-between gap-4 border-t border-line-subtle pt-6 text-[0.8125rem] text-muted"
    >
      <span>Trans Edit © 2026 · EU GDPR &amp; ePrivacy Compliant</span>
      <button
        class="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[0.8125rem] font-medium text-brand underline underline-offset-[3px] transition-opacity duration-150 hover:opacity-80"
        @click="openCookieBanner"
      >
        Cookie Policy &amp; Preferences
      </button>
    </footer>
  </main>
</template>
