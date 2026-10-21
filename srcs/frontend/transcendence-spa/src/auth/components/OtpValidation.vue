<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { httpClient, HttpError } from '../auth.api'
import Toast from '@/app/components/Toast.vue'
import Input from '@/app/components/Input.vue'
import Button from '@/app/components/Button.vue'
import { validateOtpCode } from '@/utils/validation'

const { t } = useI18n()

const otp = ref('')
const loggedInSuccess = ref(false)
const errorFlag = ref(false)
const message = ref('')
const codeError = ref('')

const validateCode = () => {
  const result = validateOtpCode(otp.value, t('settings.otpCodeLabel'))
  codeError.value = result.error ?? ''
  return result
}

const props = defineProps<{
  email: string
  challengeID: string
}>()

const handleOtpConfirmation = async () => {
  if (validateCode().error) return
  try {
    await httpClient.post('login/confirm', {
      challengeId: props.challengeID,
      email: props.email,
      code: otp.value.trim(),
    })
    console.log('OTP confirmed successfully')
    loggedInSuccess.value = true
    setTimeout(() => {
      window.location.href = '/'
    }, 1000)
  } catch (error) {
    errorFlag.value = true
    message.value =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : t('common.somethingWentWrong')
    loggedInSuccess.value = false
    if (error instanceof HttpError) {
      if (error.status === 400) {
        console.log(error.message)
      } else if (error.status === 401) {
        console.log('Wrong OTP')
      } else {
        console.log(`Request failed: ${error.status}`)
      }
      console.log(error.message)
    }
  }
}
</script>

<template>
  <div
    v-if="!loggedInSuccess"
    class="box-border w-full max-w-[400px] rounded-xl border border-line-subtle bg-surface p-8 shadow-card"
  >
    <h1 class="m-0 mb-1.5 text-center text-[26px] font-semibold text-ink">{{ $t('auth.otp.title') }}</h1>
    <div class="mt-6 flex flex-col gap-6">
      <Toast v-model="errorFlag" type="alert" :message="message" :duration="6000" fluid />
      <form class="flex flex-col gap-4" @submit.prevent="handleOtpConfirmation">
        <Input :label="$t('auth.otp.codeLabel')" type="text" v-model="otp" required :error="codeError" @blur="validateCode"/>
        <Button type="submit" class="w-full">{{ $t('auth.otp.submit') }}</Button>
      </form>
    </div>
  </div>

  <div v-if="loggedInSuccess" class="mx-auto w-full max-w-[400px]">
    <Toast
      v-model="loggedInSuccess"
      type="good"
      :message="$t('auth.otp.success')"
      fluid
    />
  </div>
</template>
