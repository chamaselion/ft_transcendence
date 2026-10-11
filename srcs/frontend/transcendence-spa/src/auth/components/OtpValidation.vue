<script setup lang="ts">
  import { ref } from 'vue'
  import { httpClient,  HttpError } from '../auth.api'
  import Toast from '@/app/components/Toast.vue'
  import Input from '@/app/components/Input.vue'
  import Button from '@/app/components/Button.vue'

  const otp = ref('')
  const loggedInSuccess = ref(false)
  const errorFlag = ref(false)
  const message = ref('')// Error message

  const props = defineProps<{
    email: string
    challengeID: string
  }>()

// const emits = defineEmits<{
//   statusSuccess: [status: boolean]
//   errorFlag: [error: boolean]
//   errorMsg: [msg: string]
// }>()

  const handleOtpConfirmation = async () => {
    try {
      await httpClient.post('login/confirm', {
        challengeId: props.challengeID,
        email: props.email,
        code: otp.value
      })
      console.log('OTP confirmed successfully')
      loggedInSuccess.value = true
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    } catch (error) {
      errorFlag.value = true
      message.value = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong'
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
  <div class="otp-confirm" v-if="!loggedInSuccess">
      <h1>OTP Confirmation</h1>
      <div class="otp-confirm__body">
        <Toast
          v-model="errorFlag"
          type="alert"
          :message="message"
          :duration="6000"
          fluid
        />
        <form @submit.prevent="handleOtpConfirmation">
          <Input label="Enter OTP" type="text" v-model="otp" required />
          <Button type="submit">Confirm OTP</Button>
        </form>
      </div>
    </div>

  <div v-if="loggedInSuccess" class="otp-notice">
      <Toast
        v-model="loggedInSuccess"
        type="good"
        message="Login successful! Redirecting to the home page..."
        fluid
      />
    </div>
</template>

<style scoped>
.otp-notice {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.otp-confirm {
  box-sizing: border-box;
  width: 100%;
  max-width: 400px;
  padding: 32px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background-color: var(--bg-surface);
  box-shadow: var(--shadow-md);
}

.otp-confirm h1 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
}

.otp-confirm__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 24px;
}

.otp-confirm form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.otp-confirm :deep(.btn) {
  width: 100%;
  margin: 0;
}
</style>
