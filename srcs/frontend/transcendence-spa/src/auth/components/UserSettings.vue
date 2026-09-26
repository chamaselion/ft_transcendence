<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { httpClient, HttpError } from '../auth.api'
import Card from '@/app/components/Card.vue'
import Toast from '@/app/components/Toast.vue'
// import UserIcon from '@/app/components/UserIcon.vue'
import Button from '@/app/components/Button.vue'
import { type Root, type User } from '../types/user'

const router = useRouter()

const res = ref<Root | null>(null)
const user = ref<User | null>(null)

const pending = ref(true)
const failed = ref(false)
const errorFlag = ref(false)
const message = ref('')

const loggedIn = computed(() => res.value?.loggedIn === true)

const status = computed(() => (loggedIn.value ? 'good' : 'warn'))

const statusLabel = computed(() => (loggedIn.value ? 'You are logged in' : 'You are not logged in'))

const roleLabel = computed(() => {
  const role = user.value?.role
  if (!role) return ''
  return role.charAt(0).toUpperCase() + role.slice(1)
})

const details = computed(() => [
  { label: 'E-mail', value: user.value?.email },
  { label: 'Role', value: roleLabel.value },
  { label: 'User ID', value: user.value?.id },
])

const loadProfile = async () => {
  pending.value = true
  failed.value = false
  errorFlag.value = false
  try {
    const response = await httpClient.get<Root>('me')
    res.value = response
    user.value = response.user ?? null
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 401) {
      failed.value = true
      errorFlag.value = true
      message.value = error instanceof Error ? error.message : 'Something went wrong'
    }
  } finally {
    pending.value = false
  }
}

const goToLogin = () => router.push('/login')

onMounted(loadProfile)

function updateProfile(newProfile: User) {
  user.value = newProfile
}
</script>

<template>
  <div class="user-settings">
    <header class="user-settings__header">
      <h1 class="user-settings__title">User Settings</h1>
      <p class="user-settings__subtitle">Your account details and session status.</p>
    </header>

    <Toast
      v-model="errorFlag"
      type="alert"
      :message="message"
      :duration="6000"
      fluid
      class="user-settings__toast"
    />

    <Card v-if="pending" class="user-settings__card">
      <div class="skeleton" aria-hidden="true">
        <div class="skeleton__identity">
          <div class="skeleton__avatar" />
          <div class="skeleton__lines">
            <div class="skeleton__line skeleton__line--title" />
            <div class="skeleton__line skeleton__line--sub" />
          </div>
        </div>
        <div class="skeleton__line" />
        <div class="skeleton__line" />
        <div class="skeleton__line" />
      </div>
      <p class="skeleton__caption">Loading your profile…</p>
    </Card>

    <Card v-else-if="failed" class="user-settings__card">
      <div class="state">
        <span class="state__badge state__badge--alert" aria-hidden="true">!</span>
        <p class="state__title">We couldn't load your profile</p>
        <p class="state__text">Something went wrong while contacting the server.</p>
        <Button variant="elevated" color="primary" @click="loadProfile">Try again</Button>
      </div>
    </Card>

    <Card v-else-if="loggedIn" class="user-settings__card">
      <div class="profile__identity">
        <!-- <UserIcon :name="user?.login" size="large" /> -->
        <div class="profile__meta">
          <span class="profile__login">{{ user?.login }}</span>
          <span v-if="roleLabel" class="profile__role">{{ roleLabel }}</span>
        </div>
      </div>

      <dl class="profile__details">
        <div v-for="detail in details" :key="detail.label" class="profile__detail">
          <label :for="detail.label" class="profile__detail-label">{{ detail.label }}</label>
          <input type="text" class="profile__detail-value" :id="detail.label" :value="detail.value"/>
        </div>
      </dl>



      <template #footer>
        <div class="status" :class="`status--${status}`" role="status">
          <span class="status__dot" aria-hidden="true" />
          <span class="status__text">{{ statusLabel }}</span>
        </div>
      </template>
    </Card>

    <Card v-else class="user-settings__card">
      <div class="state">
        <span class="state__badge state__badge--warn" aria-hidden="true">!</span>
        <p class="state__title">You're not logged in</p>
        <p class="state__text">Sign in to view and manage your account settings.</p>
        <Button variant="elevated" color="primary" @click="goToLogin">Sign in</Button>
      </div>
    </Card>
  </div>
</template>

<style lang="css" scoped>
.user-settings {
  box-sizing: border-box;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  padding: 48px 24px;
}

.user-settings__header {
  margin-bottom: 24px;
}

.user-settings__title {
  margin: 0 0 6px;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-primary);
}

.user-settings__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.user-settings__toast {
  margin-bottom: 16px;
}

.user-settings__card {
  width: 100%;
}

.user-settings :deep(.btn) {
  margin-right: 0;
}

/* Profile */

.profile__identity {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.profile__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.profile__login {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.profile__role {
  padding: 2px 10px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.profile__details {
  margin: 16px 0 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile__detail {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.profile__detail-label {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.profile__detail-value {
  margin: 0;
  min-width: 0;
  font-size: 14px;
  color: var(--text-primary);
  text-align: right;
  overflow-wrap: anywhere;
}

/* Status pill */

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.status__dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--status-color);
}

.status--good {
  --status-color: var(--color-good);
  color: var(--color-good);
}

.status--warn {
  --status-color: var(--color-warn);
  color: var(--color-warn-contrast);
}

.status--good .status__dot,
.status--warn .status__dot {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-color) 22%, transparent);
}

/* Empty / error states */

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 0 4px;
  text-align: center;
}

.state__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 4px;
  border-radius: 50%;
  color: var(--badge-contrast);
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.state__badge--alert {
  --badge-contrast: var(--color-alert-contrast);
  background-color: color-mix(in srgb, var(--color-alert) 15%, transparent);
  color: var(--color-alert);
}

.state__badge--warn {
  --badge-contrast: var(--color-warn-contrast);
  background-color: color-mix(in srgb, var(--color-warn) 18%, transparent);
  color: var(--color-warn);
}

.state__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.state__text {
  margin: 0 0 8px;
  max-width: 34ch;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
}

/* Loading skeleton */

.skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton__identity {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-subtle);
}

.skeleton__avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--bg-subtle);
}

.skeleton__lines {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.skeleton__line {
  height: 12px;
  border-radius: 6px;
  background-color: var(--bg-subtle);
}

.skeleton__line--title {
  width: 40%;
  height: 16px;
}

.skeleton__line--sub {
  width: 65%;
}

.skeleton__caption {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.5;
  }

  50% {
    opacity: 0.9;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    opacity: 0.7;
  }
}
</style>
