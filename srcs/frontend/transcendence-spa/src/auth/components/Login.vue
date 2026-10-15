<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { httpClient, HttpError } from '../auth.api'
import OtpValidation from './OtpValidation.vue'
import Toast from '@/app/components/Toast.vue'
import Input from '@/app/components/Input.vue'
import Button from '@/app/components/Button.vue'
import OAuth from './OAuth.vue'

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

const handleLogin = async () => {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorFlag.value = false
  try {
    const data = await httpClient.post<LoginResponse>('login', {
      email: email.value,
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
        console.log(error.message)
      } else if (error.status === 401) {
        console.log('Wrong email or password')
      } else {
        console.log(`Request failed: ${error.status}`)
      }
      console.log(error.message)
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div
    v-if="registerRedirectFlag"
    class="login-notice"
  >
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
    class="login-card"
    v-if="!otpConfirmationRequired"
  >
    <header class="login-card__header">
      <h1 class="login-card__title">{{ $t('auth.login.title') }}</h1>
      <p class="login-card__subtitle">{{ $t('auth.login.subtitle') }}</p>
    </header>
    <div class="login-card__body">
      <Toast
        v-model="errorFlag"
        type="alert"
        :message="message"
        :duration="6000"
        fluid
      />
      <OAuth />
      <form @submit.prevent="handleLogin">
        <Input
          :label="$t('auth.login.emailLabel')"
          type="email"
          v-model="email"
          required
        />
        <Input
          :label="$t('auth.login.passwordLabel')"
          type="password"
          v-model="password"
          required
        />
        <Button
          type="submit"
          size="large"
          class="login-card__submit"
          :loading="isSubmitting"
        >
          {{ isSubmitting ? $t('auth.login.submitting') : $t('auth.login.submit') }}
        </Button>
      </form>
    </div>
    <p
      v-if="!registerRedirectFlag"
      class="login-card__footer"
    >
      {{ $t('auth.login.footerText') }}
      <router-link to="/register">{{ $t('auth.login.footerLink') }}</router-link>
    </p>
  </div>

  <OtpValidation
    v-if="otpConfirmationRequired"
    :email="email"
    :challengeID="challengeID"
  />
</template>

<style scoped>
.login-notice {
  width: 100%;
  max-width: 400px;
  margin: 0 auto 20px;
}

.login-card {
  box-sizing: border-box;
  width: 100%;
  max-width: 400px;
  padding: 32px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background-color: var(--bg-surface);
  box-shadow: var(--shadow-md);
}

.login-card__header {
  text-align: center;
}

.login-card__title {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-primary);
}

.login-card__subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.login-card__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 24px;
}

.login-card__body form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-card__submit {
  width: 100%;
  margin: 0;
}

.login-card__footer {
  margin: 20px 0 0;
  font-size: 14px;
  text-align: center;
  color: var(--text-secondary);
}

.login-card__footer :deep(a) {
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;
}

.login-card__footer :deep(a):hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}
</style>
