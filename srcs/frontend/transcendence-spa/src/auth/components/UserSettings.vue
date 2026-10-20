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

async function changeAvatar() {
  // NOTE: Placeholder for avatar change functionality
  console.log('Change avatar clicked')
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

onMounted(loadProfile)
</script>

<template>
  <div class="box-border mx-auto w-full max-w-[520px] px-6 py-12">
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

    <Card v-if="pending" class="w-full">
      <p class="mt-4 text-center text-[13px] text-muted">Loading your profile…</p>
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
            <span class="text-lg font-semibold text-ink [overflow-wrap:anywhere]">{{
              user?.login
            }}</span>
            <div class="group relative inline-flex shrink-0 overflow-hidden rounded-full">
              <UserIcon
                class="transition-[filter] duration-[180ms] group-hover:blur-[2px]"
                avatar-url="https://thispersondoesnotexist.com/random-person.jpeg"
                size="large"
                @click="changeAvatar"
              />
              <span
                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 text-[28px] leading-none text-white opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100"
                aria-hidden="true"
                >+</span
              >
            </div>
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
            <Input label="Email" v-model="email" type="text" />
            <Input label="Username" v-model="login" type="text" />
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
            <Input label="OTP Code" v-model="otpCode" type="text" />
            <Button v-if="confirmationID" variant="elevated" type="submit">Confirm OTP</Button>
          </form>
        </div>
      </dl>

      <div v-if="user" class="mt-5 flex flex-col gap-4 border-t border-line-subtle pt-4">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-sm font-semibold text-ink">Privacy &amp; GDPR</span>
            <p class="m-0 text-[13px] leading-snug text-ink-secondary">
              Under GDPR Art. 15, you have the right to obtain a copy of your personal data.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2.5">
            <Button
              id="request-gdpr-btn"
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
              id="export-gdpr-csv-btn"
              variant="outlined"
              color="primary"
              :loading="gdprPending"
              @click="exportGdprData('csv')"
            >
              Export (CSV)
            </Button>
          </div>
          <p v-if="gdprSuccess" class="m-0 text-[13px] leading-snug font-medium text-success">
            {{ gdprSuccessMessage }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Button
            v-if="!deletionConfirmationID"
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
            />
            <Button
              type="submit"
              color="alert"
              :loading="deleting"
              :disabled="!deletionCode.trim()"
            >
              Confirm deletion
            </Button>
            <Button variant="outlined" color="default" :disabled="deleting" @click="cancelDeletion">
              Cancel
            </Button>
          </form>
        </div>
      </div>

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
</template>
