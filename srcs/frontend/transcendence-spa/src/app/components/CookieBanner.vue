<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'

export interface CookieInfo {
  name: string
  type: 'Cookie' | 'Local Storage'
  provider: string
  duration: string
  purpose: string
  category: 'Strictly Necessary' | 'Functionality'
  required: boolean
}

const STORAGE_KEY = 'cookie-consent'

const isVisible = ref(false)
const showDetails = ref(false)

const cookieInventory: CookieInfo[] = [
  {
    name: 'token',
    type: 'Cookie',
    provider: 'Transcendence (1st party)',
    duration: '7 days',
    purpose: 'Stores your authenticated session (JWT) to keep you logged in and secure real-time collaboration.',
    category: 'Strictly Necessary',
    required: true,
  },
  {
    name: 'app-theme',
    type: 'Local Storage',
    provider: 'Transcendence (1st party)',
    duration: 'Persistent',
    purpose: 'Remembers your interface display theme preference (light or dark mode) across browser visits.',
    category: 'Functionality',
    required: true,
  },
  {
    name: 'cookie-consent',
    type: 'Local Storage',
    provider: 'Transcendence (1st party)',
    duration: '1 year',
    purpose: 'Remembers your acknowledgment of this EU cookie disclosure to prevent repeated popups.',
    category: 'Strictly Necessary',
    required: true,
  },
]

function checkConsent() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      isVisible.value = true
    }
  } catch {
    isVisible.value = true
  }
}

function acceptAll() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accepted: true,
        timestamp: new Date().toISOString(),
        version: '1.0',
      }),
    )
  } catch (err) {
    console.error('Failed to save cookie consent:', err)
  }
  isVisible.value = false
}

function toggleDetails() {
  showDetails.value = !showDetails.value
}

function handleOpenEvent() {
  isVisible.value = true
}

onMounted(() => {
  checkConsent()
  window.addEventListener('open-cookie-banner', handleOpenEvent)
  window.addEventListener('transcendence:cookie-preferences', handleOpenEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener('open-cookie-banner', handleOpenEvent)
  window.removeEventListener('transcendence:cookie-preferences', handleOpenEvent)
})

defineExpose({
  open: handleOpenEvent,
})
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,transform] duration-300 ease-out"
    enter-from-class="translate-y-5 opacity-0"
    leave-active-class="transition-[opacity,transform] duration-300 ease-in"
    leave-to-class="translate-y-5 opacity-0"
  >
    <div
      v-if="isVisible"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex justify-center p-4"
      role="region"
      aria-label="EU Cookie Notice"
    >
      <div
        class="pointer-events-auto flex w-full max-w-[960px] flex-col gap-4 rounded-xl border border-line bg-surface/95 p-4 text-ink shadow-float backdrop-blur-md sm:px-6 sm:py-5"
      >
        <!-- Main Header & Notice -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span
              class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-brand/12 text-brand"
            >
              <Icon name="Cookie" :size="20" />
            </span>
            <div class="flex flex-wrap items-center gap-2.5">
              <h2 class="m-0 text-[1.05rem] font-bold text-ink">EU Cookie &amp; Privacy Notice</h2>
              <span
                class="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/15 px-2 py-0.5 text-[0.72rem] font-semibold text-success"
              >
                <Icon name="ShieldCheck" :size="13" />
                ePrivacy &amp; GDPR Compliant
              </span>
            </div>
          </div>
        </div>

        <div class="text-sm leading-normal text-ink-secondary">
          <p class="m-0">
            Trans Edit uses strictly functional cookies and local storage to provide essential
            services such as user authentication, session security, and theme preferences. In
            accordance with EU Directive 2002/58/EC (ePrivacy) and GDPR Art. 6, all cookies used on
            this site are strictly necessary for core functionality.
            <strong class="text-ink"
              >We do not use any advertising, profiling, or third-party tracking cookies.</strong
            >
          </p>
        </div>

        <!-- Expandable Details Section -->
        <Transition
          enter-active-class="max-h-[500px] overflow-hidden transition-[max-height,opacity,transform] duration-[250ms] ease-in-out"
          enter-from-class="max-h-0 -translate-y-2 opacity-0"
          leave-active-class="max-h-[500px] overflow-hidden transition-[max-height,opacity,transform] duration-[250ms] ease-in-out"
          leave-to-class="max-h-0 -translate-y-2 opacity-0"
        >
          <div
            v-if="showDetails"
            class="mt-1 flex flex-col gap-3 rounded-lg border border-line-subtle bg-subtle p-4"
          >
            <div class="flex flex-col gap-1">
              <h3 class="m-0 flex items-center gap-1.5 text-[0.9rem] font-semibold text-ink">
                <Icon name="InfoCircle" :size="16" />
                Active Storage &amp; Cookies Inventory
              </h3>
              <p class="m-0 text-[0.8rem] text-ink-secondary">
                The following technical storage items are set by this website for core site
                functionality:
              </p>
            </div>

            <div class="overflow-x-auto rounded-md">
              <table
                class="w-full border-collapse text-left text-[0.8rem] [&_td]:border-b [&_td]:border-line-subtle [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-line-subtle [&_th]:bg-[color-mix(in_srgb,var(--bg-surface)_60%,transparent)] [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:whitespace-nowrap [&_th]:text-ink-secondary"
              >
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Mechanism</th>
                    <th>Category</th>
                    <th>Duration</th>
                    <th>Purpose</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cookie in cookieInventory" :key="cookie.name">
                    <td>
                      <code
                        class="rounded bg-brand/10 px-1.5 py-0.5 font-mono font-semibold text-brand"
                        >{{ cookie.name }}</code
                      >
                    </td>
                    <td>{{ cookie.type }}</td>
                    <td>
                      <span
                        class="inline-block rounded-full bg-brand/12 px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap text-brand"
                        >{{ cookie.category }}</span
                      >
                    </td>
                    <td>{{ cookie.duration }}</td>
                    <td class="max-w-[320px] text-ink-secondary">{{ cookie.purpose }}</td>
                    <td>
                      <span
                        class="inline-block rounded-full bg-success/15 px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap text-success"
                        title="Essential for site operation"
                      >
                        Always Active
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Transition>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-3 pt-1 max-sm:flex-col-reverse max-sm:items-stretch">
          <Button
            variant="outlined"
            size="small"
            class="max-sm:w-full max-sm:justify-center"
            @click="toggleDetails"
          >
            {{ showDetails ? 'Hide Details' : 'View Cookie Details' }}
          </Button>

          <Button
            variant="elevated"
            color="primary"
            size="small"
            class="max-sm:w-full max-sm:justify-center"
            @click="acceptAll"
          >
            Got it &amp; Accept Functional Cookies
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>
