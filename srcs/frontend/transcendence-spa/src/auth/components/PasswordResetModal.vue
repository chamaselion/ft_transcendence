<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { httpClient } from '../auth.api'
import Modal from '@/app/components/Modal.vue'
import Input from '@/app/components/Input.vue'
import Button from '@/app/components/Button.vue'
import { validateEmail, validateOtpCode, validatePassword } from '@/utils/validation'
import type {
  PasswordResetConfirmResponse,
  PasswordResetRequestResponse,
} from '../types/auth.types'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    initialEmail?: string | null
  }>(),
  {
    initialEmail: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: [email: string]
}>()

type Step = 'request' | 'confirm' | 'success'

const step = ref<Step>('request')
const email = ref('')
const confirmationID = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const codeLength = ref<number | undefined>(undefined)
const infoMessage = ref('')
const errorMessage = ref('')
const submitting = ref(false)

const emailError = ref('')
const codeError = ref('')
const newPasswordError = ref('')
const confirmPasswordError = ref('')

const validateEmailField = () => {
  emailError.value = validateEmail(email.value).error ?? ''
  return emailError.value
}

const validateCodeField = () => {
  codeError.value = validateOtpCode(code.value, t('auth.passwordReset.resetCodeLabel')).error ?? ''
  return codeError.value
}

const validateNewPasswordField = () => {
  newPasswordError.value =
    validatePassword(newPassword.value, t('auth.passwordReset.newPasswordLabel')).error ?? ''
  return newPasswordError.value
}

const validateConfirmPasswordField = () => {
  confirmPasswordError.value = !confirmPassword.value
    ? t('auth.passwordReset.confirmRequired')
    : confirmPassword.value !== newPassword.value
      ? t('auth.passwordReset.passwordMismatch')
      : ''
  return confirmPasswordError.value
}

function resetFlow() {
  step.value = 'request'
  email.value = props.initialEmail ?? ''
  confirmationID.value = ''
  code.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  codeLength.value = undefined
  infoMessage.value = ''
  errorMessage.value = ''
  emailError.value = ''
  codeError.value = ''
  newPasswordError.value = ''
  confirmPasswordError.value = ''
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetFlow()
  },
)

const close = () => emit('update:modelValue', false)

async function requestReset() {
  if (submitting.value || validateEmailField()) return
  submitting.value = true
  errorMessage.value = ''
  try {
    const response = await httpClient.post<PasswordResetRequestResponse>('password-reset/request', {
      email: email.value.trim(),
    })
    confirmationID.value = response.confirmationId
    infoMessage.value = response.message
    codeLength.value = response.codeLength
    code.value = ''
    step.value = 'confirm'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('auth.passwordReset.error')
  } finally {
    submitting.value = false
  }
}

async function confirmReset() {
  if (submitting.value) return
  const hasCodeError = validateCodeField()
  const hasPasswordError = validateNewPasswordField()
  const hasConfirmError = validateConfirmPasswordField()
  if (hasCodeError || hasPasswordError || hasConfirmError) return

  submitting.value = true
  errorMessage.value = ''
  try {
    await httpClient.post<PasswordResetConfirmResponse>('password-reset/confirm', {
      confirmationId: confirmationID.value,
      email: email.value.trim(),
      code: code.value.trim(),
      newPassword: newPassword.value,
    })
    step.value = 'success'
    emit('success', email.value.trim())
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('auth.passwordReset.error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Modal
    :model-value="props.modelValue"
    :title="$t('auth.passwordReset.title')"
    size="small"
    :close-on-overlay="!submitting"
    :close-on-esc="!submitting"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="step === 'request'" class="flex flex-col gap-4">
      <p class="m-0 text-sm leading-normal text-ink-secondary">
        {{ $t('auth.passwordReset.requestDescription') }}
      </p>
      <form
        id="password-reset-request-form"
        class="flex flex-col gap-4"
        @submit.prevent="requestReset"
      >
        <Input
          v-model="email"
          :label="$t('auth.passwordReset.emailLabel')"
          type="email"
          autocomplete="email"
          required
          :disabled="submitting"
          :error="emailError"
          @blur="validateEmailField"
        />
      </form>
    </div>

    <div v-else-if="step === 'confirm'" class="flex flex-col gap-4">
      <p class="m-0 text-sm leading-normal text-ink-secondary">{{ infoMessage }}</p>
      <p class="m-0 text-sm leading-normal text-ink-secondary">
        <i18n-t
          v-if="codeLength"
          keypath="auth.passwordReset.codePrompt"
          tag="span"
          :length="codeLength"
        >
          <template #email>
            <strong>{{ email }}</strong>
          </template>
        </i18n-t>
        <i18n-t v-else keypath="auth.passwordReset.codePromptGeneric" tag="span">
          <template #email>
            <strong>{{ email }}</strong>
          </template>
        </i18n-t>
      </p>
      <form
        id="password-reset-confirm-form"
        class="flex flex-col gap-4"
        @submit.prevent="confirmReset"
      >
        <Input
          v-model="code"
          :label="$t('auth.passwordReset.resetCodeLabel')"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          required
          :disabled="submitting"
          :error="codeError"
          @blur="validateCodeField"
        />
        <Input
          v-model="newPassword"
          :label="$t('auth.passwordReset.newPasswordLabel')"
          type="password"
          autocomplete="new-password"
          required
          :disabled="submitting"
          :error="newPasswordError"
          @blur="validateNewPasswordField"
        />
        <Input
          v-model="confirmPassword"
          :label="$t('auth.passwordReset.confirmPasswordLabel')"
          type="password"
          autocomplete="new-password"
          required
          :disabled="submitting"
          :error="confirmPasswordError"
          @blur="validateConfirmPasswordField"
        />
      </form>
    </div>

    <div v-else class="flex flex-col gap-2 py-3 text-center">
      <p class="m-0 text-base font-semibold text-ink">
        {{ $t('auth.passwordReset.successTitle') }}
      </p>
      <p class="m-0 text-sm leading-normal text-ink-secondary">
        {{ $t('auth.passwordReset.successText') }}
      </p>
    </div>

    <p
      v-if="errorMessage"
      class="m-0 mt-4 rounded-md border border-danger bg-danger/12 px-3 py-2 text-[0.85rem] text-danger"
    >
      {{ errorMessage }}
    </p>

    <template #footer>
      <template v-if="step === 'success'">
        <Button size="small" @click="close">{{ $t('auth.passwordReset.done') }}</Button>
      </template>
      <template v-else>
        <Button variant="outlined" size="small" :disabled="submitting" @click="close">
          {{ $t('common.cancel') }}
        </Button>
        <Button
          type="submit"
          :form="step === 'request' ? 'password-reset-request-form' : 'password-reset-confirm-form'"
          size="small"
          :loading="submitting"
        >
          {{
            step === 'request' ? $t('auth.passwordReset.sendCode') : $t('auth.passwordReset.submit')
          }}
        </Button>
      </template>
    </template>
  </Modal>
</template>
