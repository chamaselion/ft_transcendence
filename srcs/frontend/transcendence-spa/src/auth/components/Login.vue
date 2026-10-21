<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { httpClient, HttpError } from '../auth.api'
import OtpValidation from './OtpValidation.vue'
import PasswordResetModal from './PasswordResetModal.vue'
import Toast from '@/app/components/Toast.vue'
import Input from '@/app/components/Input.vue'
import Button from '@/app/components/Button.vue'
import OAuth from './OAuth.vue'
import { validateEmail, validatePassword } from '@/utils/validation'
import { logger } from '@/utils/logger'

const { t } = useI18n()

const props = defineProps<{
  email?: string | null
  isRegisterRedirect?: boolean
}>()

export interface LoginResponse {
  loginChallenge: boolean
  challengeId: string
  email: string
  emailMasked: string
  attemptsRemaining: number
  codeLength: number
  expiresAt: number
  codeSent: boolean
  message: string
}

const email = ref(props.email ?? '')
const password = ref()
const errorFlag = ref(false)
const message = ref('')
const challengeID = ref('')
const registerRedirectFlag = ref(Boolean(props.isRegisterRedirect))
const otpConfirmationRequired = ref(false)
const isSubmitting = ref(false)
const resetOpen = ref(false)
const errors = ref({ email: '', password: '' })

const validateField = (field: 'email' | 'password') => {
  const result = field === 'email' ? validateEmail(email.value) : validatePassword(password.value)
  errors.value[field] = result.error ?? ''
  return result
}

const validateForm = () => {
  const emailResult = validateField('email')
  const passwordResult = validateField('password')
  return !emailResult.error && !passwordResult.error
}

const handleLogin = async () => {
  if (isSubmitting.value || !validateForm()) return
  isSubmitting.value = true
  errorFlag.value = false
  try {
    const data = await httpClient.post<LoginResponse>('login', {
      email: email.value.trim(),
      password: password.value,
    })
    challengeID.value = data.challengeId
    otpConfirmationRequired.value = true
  } catch (error) {
    errorFlag.value = true
    message.value =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : t('common.somethingWentWrong')
    if (error instanceof HttpError) {
      if (error.status === 400) {
        logger.debug(error.message)
      } else if (error.status === 401) {
        logger.debug('Wrong email or password')
      } else {
        logger.debug(`Request failed: ${error.status}`)
      }
      logger.debug(error.message)
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="registerRedirectFlag" class="mx-auto mb-5 w-full max-w-[400px]">
    <Toast
      v-model="registerRedirectFlag"
      type="info"
      :message="$t('auth.login.registeredToast')"
      :hint="$t('auth.login.registeredHint')"
      :duration="8000"
      fluid
    />
  </div>

  <div
    v-if="!otpConfirmationRequired"
    class="box-border w-full max-w-[400px] rounded-xl border border-line-subtle bg-surface p-8 shadow-card"
  >
    <header class="text-center">
      <h1 class="m-0 mb-1.5 text-[26px] leading-tight font-semibold text-ink">
        {{ $t('auth.login.title') }}
      </h1>
      <p class="m-0 text-sm text-ink-secondary">{{ $t('auth.login.subtitle') }}</p>
    </header>
    <div class="mt-6 flex flex-col gap-6">
      <Toast v-model="errorFlag" type="alert" :message="message" :duration="6000" fluid />
      <OAuth />

      <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
        <Input
          :label="$t('auth.login.emailLabel')"
          type="email"
          v-model="email"
          required
          :error="errors.email"
          @blur="validateField('email')"
        />
        <Input
          :label="$t('auth.login.passwordLabel')"
          type="password"
          v-model="password"
          required
          :error="errors.password"
          @blur="validateField('password')"
        />
        <div class="-mt-2 flex justify-end">
          <button
            type="button"
            class="m-0 cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-brand hover:bg-transparent hover:text-brand-hover hover:underline"
            @click="resetOpen = true"
          >
            {{ $t('auth.login.forgotPassword') }}
          </button>
        </div>
        <Button type="submit" size="large" class="w-full" :loading="isSubmitting">
          {{ isSubmitting ? $t('auth.login.submitting') : $t('auth.login.submit') }}
        </Button>
      </form>
    </div>
    <p v-if="!registerRedirectFlag" class="mt-5 text-center text-sm text-ink-secondary">
      {{ $t('auth.login.footerText') }}
      <router-link
        to="/register"
        class="font-medium text-brand no-underline hover:text-brand-hover hover:underline"
        >{{ $t('auth.login.footerLink') }}</router-link
      >
    </p>
  </div>

  <OtpValidation v-if="otpConfirmationRequired" :email="email" :challengeID="challengeID" />

  <PasswordResetModal v-model="resetOpen" :initial-email="email" />
</template>
