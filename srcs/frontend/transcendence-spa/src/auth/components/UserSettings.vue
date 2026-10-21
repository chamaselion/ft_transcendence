<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { httpClient, HttpError } from '../auth.api'
import PasswordResetModal from './PasswordResetModal.vue'
import Button from '@/app/components/Button.vue'
import Card from '@/app/components/Card.vue'
import Icon from '@/app/components/Icon.vue'
import Input from '@/app/components/Input.vue'
import TermsOfServiceModal from '@/app/components/TermsOfServiceModal.vue'
import Toast from '@/app/components/Toast.vue'
import type { Root, User } from '../types/user'
import type { OtpConfirmationResponse } from '../types/auth.types'
import { useAuthStore } from '@/stores/auth'
import UserIcon from '@/app/components/UserIcon.vue'
import { validateEmail, validateLogin, validateOtpCode } from '@/utils/validation'

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
const errors = ref({ email: '', login: '', otp: '', deletion: '' })

const passwordResetOpen = ref(false)
const passwordResetSucceeded = ref(false)
const termsOpen = ref(false)

watch(passwordResetOpen, (open) => {
  if (!open && passwordResetSucceeded.value) {
    authStore.invalidate()
    router.replace('/login')
  }
})

function openPasswordReset() {
  passwordResetSucceeded.value = false
  passwordResetOpen.value = true
}

function handlePasswordResetSuccess() {
  passwordResetSucceeded.value = true
}

function validateEmailField() {
  errors.value.email = validateEmail(email.value ?? '').error ?? ''
}

function validateLoginField() {
  errors.value.login = validateLogin(login.value ?? '').error ?? ''
}

function validateOtpField() {
  errors.value.otp = validateOtpCode(otpCode.value, 'OTP code').error ?? ''
}

function validateDeletionField() {
  errors.value.deletion = validateOtpCode(deletionCode.value, 'Deletion code').error ?? ''
}

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
  const emailResult = validateEmail(email ?? '')
  const loginResult = validateLogin(login ?? '')
  errors.value.email = emailResult.error ?? ''
  errors.value.login = loginResult.error ?? ''
  if (emailResult.error || loginResult.error) return

  try {
    const response = await httpClient.patch<OtpConfirmationResponse>('me', {
      email: emailResult.value,
      login: loginResult.value,
    })
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

  const codeResult = validateOtpCode(otpCode.value, 'OTP code')
  errors.value.otp = codeResult.error ?? ''
  if (codeResult.error) return

  try {
    const response = await httpClient.post<OtpConfirmationResponse>('me/update/confirm', {
      confirmationId: confirmationID.value,
      email: email.value,
      code: codeResult.value,
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
  if (deleting.value || !deletionConfirmationID.value) return
  const codeResult = validateOtpCode(deletionCode.value, 'Deletion code')
  errors.value.deletion = codeResult.error ?? ''
  if (codeResult.error) return
  deleting.value = true
  errorFlag.value = false
  try {
    await httpClient.post('me/data-deletion/confirm', {
      confirmationId: deletionConfirmationID.value,
      code: codeResult.value,
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
  errors.value.deletion = ''
}

onMounted(loadProfile)
</script>

<template>
  <div class="box-border mx-auto w-full max-w-[1080px] px-6 py-12">
    <header class="mb-6">
      <h1 class="m-0 mb-1.5 text-[1.6rem] font-bold text-ink">User Settings</h1>
      <p class="m-0 text-sm text-ink-secondary">Your account details and session status.</p>
    </header>

    <Toast
      v-model="errorFlag"
      type="alert"
      :message="message"
      :duration="6000"
      fluid
      class="mb-4"
    />

    <Toast
      v-model="updateSuccess"
      type="info"
      :message="updateSuccessMessage"
      :duration="6000"
      fluid
      class="mb-4"
    />

    <Toast
      v-model="gdprSuccess"
      type="good"
      :message="gdprSuccessMessage"
      :duration="6000"
      fluid
      class="mb-4"
    />

    <Card v-if="pending" class="w-full :deep(.btn):mr-0">
      <p class="m-0 mt-4 text-[0.75rem] text-muted text-center">Loading your profile…</p>
    </Card>

    <Card v-else-if="failed" class="w-full">
      <div class="flex flex-col items-center gap-2.5 px-0 pt-3 pb-1 text-center">
        <span
          class="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-danger/15 text-xl leading-none font-bold text-danger"
          aria-hidden="true"
          >!</span
        >
        <p class="m-0 text-base font-semibold text-ink">We couldn't load your profile</p>
        <p class="m-0 mb-2 max-w-[34ch] text-sm leading-normal text-ink-secondary">
          Something went wrong while contacting the server.
        </p>
        <Button variant="elevated" color="primary" @click="loadProfile">Try again</Button>
      </div>
    </Card>

    <Card v-else-if="loggedIn" class="w-full">
      <div class="flex items-center gap-4 border-b border-line-subtle pb-4">
        <div class="flex w-full min-w-0 flex-col items-start gap-1.5">
          <div class="flex w-full items-center justify-between">
            <span class="text-lg font-semibold text-ink wrap-anywhere">{{ user?.login }}</span>
            <div class="group relative inline-flex shrink-0 overflow-hidden rounded-full">
              <input
                ref="avatarInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                :disabled="avatarPending"
                @change="changeAvatar"
              />
              <!-- <Button
                type="button"
                class="profile__avatar-button"
                aria-label="Change profile icon"
                :disabled="avatarPending"
              > -->
              <UserIcon
                class="profile__avatar-icon"
                :avatar-url="user?.avatarUrl ?? undefined"
                :name="user?.login"
                @click="avatarInput?.click()"
                size="large"
              />
              <!-- </Button> -->
              <span
                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 text-[28px] leading-none text-white opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100"
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
            <Button v-else @click="avatarInput?.click()" :disabled="avatarPending" class="change">
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
            <p>JPEG, PNG or WebP, up to 2 MiB. Maximum 16 Million pixels</p>
          </div>
          <span
            v-if="roleLabel"
            class="rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase"
            :class="user?.role === 'admin' ? 'bg-danger/12 text-danger' : 'bg-brand/12 text-brand'"
            >{{ roleLabel }}</span
          >
        </div>
      </div>

      <dl v-if="user" class="flex flex-col">
        <div class="mb-2">
          <form class="grid gap-2" @submit.prevent="updateUserDetails(email, login)">
            <Input
              label="Email"
              v-model="email"
              type="text"
              :error="errors.email"
              @blur="validateEmailField"
            />
            <Input
              label="Username"
              v-model="login"
              type="text"
              :error="errors.login"
              @blur="validateLoginField"
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

        <div v-if="displayOTP" class="mb-2">
          <form class="grid gap-2" @submit.prevent="confirmUpdateDetails">
            <Input
              label="OTP Code"
              v-model="otpCode"
              type="text"
              :error="errors.otp"
              @blur="validateOtpField"
            />
            <Button v-if="confirmationID" variant="elevated" type="submit">Confirm OTP</Button>
          </form>
        </div>
      </dl>

      <div v-if="user" class="mt-6 flex flex-col gap-2.5 border-t border-line-subtle pt-4">
        <div class="flex flex-col gap-1.5">
          <span class="font-semibold text-[0.875rem] text-brand">Privacy &amp; GDPR</span>
          <p class="m-0 text-[0.875rem] text-ink-secondary">
            Under GDPR Art. 15, you have the right to obtain a copy of your personal data.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            class="flex mt-2 items-center gap-2 flex-wrap"
            variant="outlined"
            color="primary"
            :loading="gdprPending"
            @click="exportGdprData('json')"
          >
            <template #prepend>
              <Icon name="ShieldCheck" :size="18" />
            </template>
            Export GDPR Data
          </Button>
          <Button
            class="flex mt-2 items-center gap-2 flex-wrap"
            id="export-gdpr-csv-btn"
            variant="outlined"
            color="primary"
            :loading="gdprPending"
            @click="exportGdprData('csv')"
          >
            Export (CSV)
          </Button>
        </div>
        <p v-if="gdprSuccess" class="m-0 text-[0.875rem] text-success font-medium">
          {{ gdprSuccessMessage }}
        </p>
      </div>

      <div v-if="user" class="mt-6 flex flex-col gap-2.5 border-t border-line-subtle pt-4">
        <div class="flex flex-col gap-1.5">
          <span class="font-semibold text-[0.875rem] text-brand">Password</span>
          <p class="m-0 text-[0.875rem] text-ink-secondary">
            Reset your password with a code sent to your email. You will need to sign in again
            afterwards.
          </p>
        </div>
        <Button
          class="flex mt-2 items-center gap-2 self-start"
          variant="outlined"
          color="primary"
          @click="openPasswordReset"
        >
          <template #prepend>
            <Icon name="Key" :size="18" />
          </template>
          Reset password
        </Button>
      </div>

      <div v-if="user" class="mt-6 flex flex-col gap-2.5 border-t border-line-subtle pt-4">
        <div class="flex flex-col gap-1.5">
          <span class="font-semibold text-[0.875rem] text-brand">Legal</span>
          <p class="m-0 text-[0.875rem] text-ink-secondary">
            Read the Terms of Service that apply to your use of Trans Edit.
          </p>
        </div>
        <Button
          class="flex mt-2 items-center gap-2 self-start"
          variant="outlined"
          color="primary"
          @click="termsOpen = true"
        >
          <template #prepend>
            <Icon name="FileText" :size="18" />
          </template>
          Terms of Service
        </Button>
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
        class="flex mt-2 items-center gap-2 flex-wrap"
        color="alert"
        variant="outlined"
        :loading="deleting"
        @click="requestDeletion"
      >
        Delete account
      </Button>
      <form v-else class="grid gap-2" @submit.prevent="confirmDeletion">
        <p class="m-0 mb-2 max-w-[34ch] text-sm leading-normal text-ink-secondary">
          Enter the code sent to your email to permanently delete your account.
        </p>
        <Input
          v-model="deletionCode"
          label="Deletion confirmation code"
          type="text"
          :disabled="deleting"
          :error="errors.deletion"
          @blur="validateDeletionField"
        />
        <Button type="submit" color="alert" :loading="deleting" :disabled="!deletionCode.trim()">
          Confirm deletion
        </Button>
        <Button variant="outlined" color="default" :disabled="deleting" @click="cancelDeletion">
          Cancel
        </Button>
      </form>

      <template #footer>
        <div
          class="flex items-center gap-2 text-sm font-medium"
          :class="status === 'good' ? 'text-success' : 'text-warning'"
          role="status"
        >
          <span
            class="h-2.5 w-2.5 shrink-0 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_22%,transparent)]"
            aria-hidden="true"
          />
          <span>{{ statusLabel }}</span>
        </div>
      </template>
    </Card>

    <Card v-else class="w-full">
      <div class="flex flex-col items-center gap-2.5 px-0 pt-3 pb-1 text-center">
        <span
          class="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-warning/[18%] text-xl leading-none font-bold text-warning"
          aria-hidden="true"
          >!</span
        >
        <p class="m-0 text-base font-semibold text-ink">You're not logged in</p>
        <p class="m-0 mb-2 max-w-[34ch] text-sm leading-normal text-ink-secondary">
          Sign in to view and manage your account settings.
        </p>
        <Button variant="elevated" color="primary" @click="goToLogin">Sign in</Button>
      </div>
    </Card>
  </div>

  <PasswordResetModal
    v-model="passwordResetOpen"
    :initial-email="email"
    @success="handlePasswordResetSuccess"
  />
  <TermsOfServiceModal v-model="termsOpen" />
</template>
