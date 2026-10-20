<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { httpClient, HttpError } from '../auth.api'
import Button from '@/app/components/Button.vue'
import Card from '@/app/components/Card.vue'
import Icon from '@/app/components/Icon.vue'
import Input from '@/app/components/Input.vue'
import Toast from '@/app/components/Toast.vue'
import type { Root, User } from '../types/user'
import type { OtpConfirmationResponse } from '../types/auth.types'
import { useAuthStore } from '@/stores/auth'
import UserIcon from '@/app/components/UserIcon.vue'

const router = useRouter()
const authStore = useAuthStore()

const res = ref<Root | null>(null)
const user = ref<User | null>(null)
const email = ref<string | undefined>(undefined)
const login = ref<string | undefined>(undefined)

const pending = ref(true)
const failed = ref(false)
const errorFlag = ref(false)
const message = ref('')

const otpCode = ref('')
const displayOTP = ref(false)
const confirmationID = ref('')

const deletionConfirmationID = ref('')
const deletionCode = ref('')
const deleting = ref(false)

const updateSuccess = ref(false)
const updateSuccessMessage = ref('')

const gdprPending = ref(false)
const gdprSuccess = ref(false)
const gdprSuccessMessage = ref('')

const loggedIn = computed(() => res.value?.loggedIn === true)
const status = computed(() => (loggedIn.value ? 'good' : 'warn'))
const statusLabel = computed(() => (loggedIn.value ? 'You are logged in' : 'You are not logged in'))

const roleLabel = computed(() => {
  const role = user.value?.role
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : ''
})

async function loadProfile() {
  pending.value = true
  failed.value = false
  errorFlag.value = false

  try {
    const response = await httpClient.get<Root>('me')
    res.value = response
    user.value = response.user ?? null
    email.value = user.value?.email ?? undefined
    login.value = user.value?.login ?? undefined
    authStore.setStoreToApiResponse(response)
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

function isChanged(current: string | undefined, input: string | undefined): boolean {
  return current !== input
}

async function updateUserDetails(email: string | undefined, login: string | undefined) {
  try {
    const response = await httpClient.patch<OtpConfirmationResponse>('me', { email, login })
    confirmationID.value = response.confirmationId
    displayOTP.value = true
  } catch (error) {
    console.error('Error updating user details:', error)
    errorFlag.value = true
    message.value =
      error instanceof Error ? error.message : 'Something went wrong while updating user details'
  }
}

async function confirmUpdateDetails() {
  if (confirmationID.value == '') {
    console.error('No confirmation ID available for OTP confirmation.')
    return
  }

  try {
    const response = await httpClient.post<OtpConfirmationResponse>('me/update/confirm', {
      confirmationId: confirmationID.value,
      email: email.value,
      code: otpCode.value,
    })

    console.log('OTP confirmed successfully:', response)
    displayOTP.value = false
    confirmationID.value = ''
    updateSuccessMessage.value = 'Your details have been updated successfully.'
    updateSuccess.value = true
    loadProfile()
  } catch (error) {
    console.error('Error confirming OTP:', error)
    errorFlag.value = true
    message.value =
      error instanceof Error ? error.message : 'Something went wrong while confirming OTP'
  } finally {
    otpCode.value = ''
  }
}

const avatarInput = ref<HTMLInputElement | null>(null)
const avatarPending = ref(false)

async function changeAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || avatarPending.value) return
  avatarPending.value = true
  errorFlag.value = false
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('Icon must be at most 2 MiB')
    const body = new FormData()
    body.append('icon', file)
    const response = await httpClient.request<{ avatarUrl: string }>('me/icon', {
      method: 'PUT',
      body,
    })
    if (user.value) {
      user.value.avatarUrl = response.avatarUrl
      authStore.setUser({ ...user.value })
    }
    updateSuccessMessage.value = 'Your profile icon has been updated.'
    updateSuccess.value = true
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Failed to upload icon'
    errorFlag.value = true
  } finally {
    input.value = ''
    avatarPending.value = false
  }
}

async function removeAvatar() {
  if (avatarPending.value) return
  avatarPending.value = true
  errorFlag.value = false
  try {
    await httpClient.delete('me/icon')
    if (user.value) {
      user.value.avatarUrl = null
      authStore.setUser({ ...user.value })
    }
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Failed to remove icon'
    errorFlag.value = true
  } finally {
    avatarPending.value = false
  }
}

async function requestDeletion() {
  if (deleting.value) return
  deleting.value = true
  errorFlag.value = false
  try {
    const response = await httpClient.post<{ confirmationId: string }>(
      'me/data-deletion/request',
      {},
    )
    deletionConfirmationID.value = response.confirmationId
    deletionCode.value = ''
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Failed to request account deletion.'
    errorFlag.value = true
  } finally {
    deleting.value = false
  }
}

async function exportGdprData(format: 'json' | 'csv' = 'json') {
  gdprPending.value = true
  gdprSuccess.value = false
  errorFlag.value = false

  try {
    const endpoint = format === 'csv' ? 'me/data-export/csv' : 'me/data-export'
    const { blob, filename } = await httpClient.download(endpoint)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    gdprSuccessMessage.value = `Your GDPR data export (${format.toUpperCase()}) has been downloaded successfully.`
    gdprSuccess.value = true
  } catch (error) {
    console.error('Error exporting GDPR data:', error)
    errorFlag.value = true
    message.value =
      error instanceof Error ? error.message : 'Something went wrong while exporting GDPR data'
  } finally {
    gdprPending.value = false
  }
}

async function confirmDeletion() {
  if (deleting.value || !deletionConfirmationID.value || !deletionCode.value.trim()) return
  deleting.value = true
  errorFlag.value = false
  try {
    await httpClient.post('me/data-deletion/confirm', {
      confirmationId: deletionConfirmationID.value,
      code: deletionCode.value.trim(),
    })
    authStore.invalidate()
    res.value = { loggedIn: false }
    user.value = null
    await router.replace('/login')
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Failed to delete your account.'
    errorFlag.value = true
  } finally {
    deleting.value = false
  }
}

function cancelDeletion() {
  deletionConfirmationID.value = ''
  deletionCode.value = ''
}

onMounted(loadProfile)
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

    <Toast
      v-model="updateSuccess"
      type="info"
      :message="updateSuccessMessage"
      :duration="6000"
      fluid
      class="user-settings__toast"
    />

    <Toast
      v-model="gdprSuccess"
      type="good"
      :message="gdprSuccessMessage"
      :duration="6000"
      fluid
      class="user-settings__toast"
    />

    <Card
      v-if="pending"
      class="user-settings__card"
    >
      <p class="skeleton__caption">Loading your profile…</p>
    </Card>

    <Card
      v-else-if="failed"
      class="user-settings__card"
    >
      <div class="state">
        <span
          class="state__badge state__badge--alert"
          aria-hidden="true"
          >!</span
        >
        <p class="state__title">We couldn't load your profile</p>
        <p class="state__text">Something went wrong while contacting the server.</p>
        <Button
          variant="elevated"
          color="primary"
          @click="loadProfile"
          >Try again</Button
        >
      </div>
    </Card>

    <Card
      v-else-if="loggedIn"
      class="user-settings__card"
    >
      <div class="profile__identity">
        <div
          class="profile__meta"
          style="width: 100%"
        >
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 100%"
          >
            <span class="profile__login">{{ user?.login }}</span>
            <div class="profile__avatar">
              <input
                ref="avatarInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                :disabled="avatarPending"
                @change="changeAvatar"
              />
              <Button
                type="button"
                class="profile__avatar-button"
                aria-label="Change profile icon"
                :disabled="avatarPending"
                @click="avatarInput?.click()"
              >
                <UserIcon
                  class="profile__avatar-icon"
                  :avatar-url="user?.avatarUrl ?? undefined"
                  :name="user?.login"
                  size="large"
                />
              </Button>
              <span
                class="profile__avatar-overlay"
                aria-hidden="true"
                >+</span
              >
            </div>
          </div>
          <div class="profile__icon-options">
            <Button
              v-if="authStore.isAuthenticated && !user?.avatarUrl"
              :disabled="avatarPending"
              @click="avatarInput?.click()"
              class="add"
            >
              Add Profile Icon
            </Button>
            <Button
              v-else
              @click="avatarInput?.click()"
              :disabled="avatarPending"
              class="change"
            >
              Change Profile Icon
            </Button>
            <Button
              v-if="user?.avatarUrl"
              :disabled="avatarPending"
              @click="removeAvatar"
              class="remove"
            >
              Remove profile icon
            </Button>
            <p>JPEG, PNG or WebP, up to 2 MiB.</p>
          </div>
          <span
            v-if="roleLabel"
            class="profile__role"
            :class="`profile__role--${user?.role}`"
            >{{ roleLabel }}</span
          >
        </div>
      </div>

      <dl
        v-if="user"
        class="profile__details"
      >
        <div class="profile__detail">
          <form @submit.prevent="updateUserDetails(email, login)">
            <Input
              label="Email"
              v-model="email"
              type="text"
            />
            <Input
              label="Username"
              v-model="login"
              type="text"
            />
            <Button
              v-if="(isChanged(user.email, email) || isChanged(user.login, login)) && !displayOTP"
              variant="elevated"
              type="submit"
            >
              Update Settings
            </Button>
          </form>
        </div>

        <div
          v-if="displayOTP"
          class="profile__detail"
        >
          <form @submit.prevent="confirmUpdateDetails">
            <Input
              label="OTP Code"
              v-model="otpCode"
              type="text"
            />
            <Button
              v-if="confirmationID"
              variant="elevated"
              type="submit"
            >
              Confirm OTP
            </Button>
          </form>
        </div>
      </dl>

      <div
        v-if="user"
        class="profile__gdpr"
      >
        <div class="profile__gdpr-info">
          <span class="profile__gdpr-title">Privacy &amp; GDPR</span>
          <p class="profile__gdpr-description">
            Under GDPR Art. 15, you have the right to obtain a copy of your personal data.
          </p>
        </div>
        <div class="profile__gdpr-actions">
          <Button
            id="request-gdpr-btn"
            variant="outlined"
            color="primary"
            :loading="gdprPending"
            @click="exportGdprData('json')"
          >
            <template #prepend>
              <Icon
                name="ShieldCheck"
                :size="18"
              />
            </template>
            Export GDPR Data
          </Button>
          <Button
            id="export-gdpr-csv-btn"
            variant="outlined"
            color="primary"
            :loading="gdprPending"
            @click="exportGdprData('csv')"
          >
            Export (CSV)
          </Button>
        </div>
        <p
          v-if="gdprSuccess"
          class="profile__gdpr-success"
        >
          {{ gdprSuccessMessage }}
        </p>
      </div>
      <Button
        v-if="authStore.isAdmin()"
        variant="outlined"
        color="primary"
        @click="router.push('/admin')"
      >
        Go to Admin Panel
      </Button>

      <Button
        v-if="!deletionConfirmationID"
        color="alert"
        variant="outlined"
        :loading="deleting"
        @click="requestDeletion"
      >
        Delete account
      </Button>
      <form
        v-else
        @submit.prevent="confirmDeletion"
      >
        <p class="state__text">
          Enter the code sent to your email to permanently delete your account.
        </p>
        <Input
          v-model="deletionCode"
          label="Deletion confirmation code"
          type="text"
          :disabled="deleting"
        />
        <Button
          type="submit"
          color="alert"
          :loading="deleting"
          :disabled="!deletionCode.trim()"
        >
          Confirm deletion
        </Button>
        <Button
          variant="outlined"
          color="default"
          :disabled="deleting"
          @click="cancelDeletion"
        >
          Cancel
        </Button>
      </form>

      <template #footer>
        <div
          class="status"
          :class="`status--${status}`"
          role="status"
        >
          <span
            class="status__dot"
            aria-hidden="true"
          />
          <span class="status__text">{{ statusLabel }}</span>
        </div>
      </template>
    </Card>

    <Card
      v-else
      class="user-settings__card"
    >
      <div class="state">
        <span
          class="state__badge state__badge--warn"
          aria-hidden="true"
          >!</span
        >
        <p class="state__title">You're not logged in</p>
        <p class="state__text">Sign in to view and manage your account settings.</p>
        <Button
          variant="elevated"
          color="primary"
          @click="goToLogin"
          >Sign in</Button
        >
      </div>
    </Card>
  </div>
</template>

<style lang="css" scoped>
.profile__icon-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.add {
  background-color: var(--color-good);
}

.change {
  background-color: var(--color-warn);
  color: var(--color-primary-contrast);
}

.remove {
  background-color: var(--color-alert) !important;
}

form {
  display: grid;
  gap: 8px;
}

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

.profile__avatar {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
}

.profile__avatar-icon {
  transition: filter 180ms ease;
}

.profile__avatar-button {
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.profile__avatar-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.profile__avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgb(0 0 0 / 25%);
  color: #fff;
  font-size: 28px;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}

.profile__avatar:hover .profile__avatar-icon {
  filter: blur(2px);
}

.profile__avatar:hover .profile__avatar-overlay {
  opacity: 1;
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

.profile__role--admin {
  background-color: color-mix(in srgb, var(--color-alert) 12%, transparent);
  color: var(--color-alert);
}

.profile__details {
  display: flex;
  flex-direction: column;
}

.profile__id-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 2px;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
}

.profile__detail {
  align-items: baseline;
  margin-bottom: 8px;
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
  padding: 4px 8px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  text-align: right;
  overflow-wrap: anywhere;
}

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

.skeleton__caption {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.profile__gdpr {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile__gdpr-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile__gdpr-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.profile__gdpr-description {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.profile__gdpr-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.profile__gdpr-success {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-good);
  font-weight: 500;
}
</style>
