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
  <Transition name="cookie-banner-fade">
    <div
      v-if="isVisible"
      class="cookie-banner-overlay"
      role="region"
      aria-label="EU Cookie Notice"
    >
      <div class="cookie-banner">
        <!-- Main Header & Notice -->
        <div class="cookie-banner__header">
          <div class="cookie-banner__title-wrapper">
            <span class="cookie-banner__icon-badge">
              <Icon name="Cookie" :size="20" class="cookie-banner__icon" />
            </span>
            <div class="cookie-banner__titles">
              <h2 class="cookie-banner__title">EU Cookie &amp; Privacy Notice</h2>
              <span class="cookie-banner__badge">
                <Icon name="ShieldCheck" :size="13" />
                ePrivacy &amp; GDPR Compliant
              </span>
            </div>
          </div>
        </div>

        <div class="cookie-banner__body">
          <p class="cookie-banner__description">
            Trans Edit uses strictly functional cookies and local storage to provide essential services such as
            user authentication, session security, and theme preferences. In accordance with EU Directive 2002/58/EC
            (ePrivacy) and GDPR Art. 6, all cookies used on this site are strictly necessary for core functionality.
            <strong>We do not use any advertising, profiling, or third-party tracking cookies.</strong>
          </p>
        </div>

        <!-- Expandable Details Section -->
        <Transition name="cookie-expand">
          <div v-if="showDetails" class="cookie-banner__details">
            <div class="cookie-banner__details-header">
              <h3 class="cookie-banner__details-title">
                <Icon name="InfoCircle" :size="16" />
                Active Storage &amp; Cookies Inventory
              </h3>
              <p class="cookie-banner__details-subtitle">
                The following technical storage items are set by this website for core site functionality:
              </p>
            </div>

            <div class="cookie-banner__table-container">
              <table class="cookie-banner__table">
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
                      <code class="cookie-name">{{ cookie.name }}</code>
                    </td>
                    <td>{{ cookie.type }}</td>
                    <td>
                      <span class="category-pill">{{ cookie.category }}</span>
                    </td>
                    <td>{{ cookie.duration }}</td>
                    <td class="cookie-purpose">{{ cookie.purpose }}</td>
                    <td>
                      <span class="status-pill status-pill--required" title="Essential for site operation">
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
        <div class="cookie-banner__actions">
          <Button
            variant="outlined"
            size="small"
            class="cookie-banner__btn-details"
            @click="toggleDetails"
          >
            {{ showDetails ? 'Hide Details' : 'View Cookie Details' }}
          </Button>

          <Button
            variant="elevated"
            color="primary"
            size="small"
            class="cookie-banner__btn-accept"
            @click="acceptAll"
          >
            Got it &amp; Accept Functional Cookies
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cookie-banner-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 16px;
  pointer-events: none;
  display: flex;
  justify-content: center;
}

.cookie-banner {
  pointer-events: auto;
  width: 100%;
  max-width: 960px;
  background-color: color-mix(in srgb, var(--bg-surface) 96%, transparent);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: var(--shadow-xl);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-primary);
}

.cookie-banner__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cookie-banner__title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cookie-banner__icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  flex-shrink: 0;
}

.cookie-banner__titles {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cookie-banner__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.cookie-banner__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-good) 15%, transparent);
  color: var(--color-good);
  border: 1px solid color-mix(in srgb, var(--color-good) 25%, transparent);
}

.cookie-banner__body {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.cookie-banner__description {
  margin: 0;
}

.cookie-banner__description strong {
  color: var(--text-primary);
}

.cookie-banner__details {
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 16px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cookie-banner__details-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cookie-banner__details-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
}

.cookie-banner__details-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.cookie-banner__table-container {
  overflow-x: auto;
  border-radius: 6px;
}

.cookie-banner__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  text-align: left;
}

.cookie-banner__table th,
.cookie-banner__table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.cookie-banner__table th {
  background-color: color-mix(in srgb, var(--bg-surface) 60%, transparent);
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

.cookie-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}

.category-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  white-space: nowrap;
}

.cookie-purpose {
  color: var(--text-secondary);
  max-width: 320px;
}

.status-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-pill--required {
  background-color: color-mix(in srgb, var(--color-good) 15%, transparent);
  color: var(--color-good);
}

.cookie-banner__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}

/* Animations */
.cookie-banner-fade-enter-active,
.cookie-banner-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.cookie-banner-fade-enter-from,
.cookie-banner-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.cookie-expand-enter-active,
.cookie-expand-leave-active {
  transition: all 0.25s ease;
  max-height: 500px;
  overflow: hidden;
}

.cookie-expand-enter-from,
.cookie-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  transform: translateY(-8px);
}

@media (max-width: 640px) {
  .cookie-banner {
    padding: 16px;
  }

  .cookie-banner__actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .cookie-banner__btn-details,
  .cookie-banner__btn-accept {
    width: 100%;
    justify-content: center;
  }
}
</style>
