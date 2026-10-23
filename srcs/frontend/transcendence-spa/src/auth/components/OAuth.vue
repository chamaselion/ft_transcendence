<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { startOAuth, type OAuthProvider } from '@/auth/oauth'
import { hasAcceptedTerms } from '@/auth/terms'

const router = useRouter()

function beginOAuth(provider: OAuthProvider) {
  if (hasAcceptedTerms()) {
    startOAuth(provider)
    return
  }

  router.push({ name: 'oauth-consent', params: { provider } })
}

function showExplainer(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const explainerId = target.classList.contains('github')
    ? 'gh-provider-explainer'
    : '42-provider-explainer'
  const explainer = document.getElementById(explainerId!)
  if (explainer) {
    explainer.style.display = 'flex'
    setTimeout(() => {
      explainer.style.display = 'none'
    }, 10000)
  }
}

function hideExplainer() {
  const explainers = document.querySelectorAll('.provider-explainer')
  explainers.forEach((explainer) => {
    explainer.setAttribute('style', 'display: none;')
  })
}
</script>

<template>
  <div class="relative flex items-center justify-center">
    <div class="relative flex max-[480px]:static">
      <Button
        class="oauth-btn github rounded! border-0! bg-subtle! px-4! py-2! text-ink! shadow-[0px_4px_6px_rgba(0,0,0,0.1)]! duration-300! hover:bg-brand-hover! dark:bg-[#24292e]! dark:hover:bg-brand-hover!"
        @click="beginOAuth('github')"
        @mouseenter="showExplainer"
        @mouseleave="hideExplainer"
      >
        {{ $t('auth.oauth.signInWith') }} <Icon name="Github" />
      </Button>
      <div
        id="gh-provider-explainer"
        class="provider-explainer pointer-events-none absolute bottom-[calc(100%_+_0.75rem)] left-1/2 z-10 box-border hidden w-[22rem] max-w-[calc(100vw_-_2rem)] -translate-x-1/2 items-start gap-3 rounded-xl border border-black/10 bg-subtle p-4 text-left text-[0.8125rem] leading-relaxed text-ink"
      >
        <p class="m-0">
          {{ $t('auth.oauth.githubExplainer') }}
        </p>
      </div>
    </div>
    <div class="relative flex max-[480px]:static">
      <Button
        class="oauth-btn rounded! border-0! bg-subtle! px-4! py-2! text-ink! shadow-[0px_4px_6px_rgba(0,0,0,0.1)]! duration-300! hover:bg-brand-hover! dark:bg-[#24292e]! dark:hover:bg-brand-hover!"
        @click="beginOAuth('42')"
        @mouseenter="showExplainer"
        @mouseleave="hideExplainer"
      >
        {{ $t('auth.oauth.signInWith') }} <Icon name="FortyTwo" />
      </Button>
      <div
        id="42-provider-explainer"
        class="provider-explainer pointer-events-none absolute bottom-[calc(100%_+_0.75rem)] left-1/2 z-10 box-border hidden w-[22rem] max-w-[calc(100vw_-_2rem)] -translate-x-1/2 items-start gap-3 rounded-xl border border-black/10 bg-subtle p-4 text-left text-[0.8125rem] leading-relaxed text-ink"
      >
        <p class="m-0">
          {{ $t('auth.oauth.fortyTwoExplainer') }}
        </p>
      </div>
    </div>
  </div>
</template>
