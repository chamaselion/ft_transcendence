<script setup lang="ts">
  import { ref } from 'vue'
  import { httpClient,  HttpError } from '../auth.api'
  import Toast from '@/app/components/Toast.vue'

  const otp = ref('')
  const loggedInSuccess = ref(false)
  const errorFlag = ref(false)
  const message = ref('')// Error message

  const props = defineProps<{
    email: string
    callengeID: string
  }>()

// const emits = defineEmits<{
//   statusSuccess: [status: boolean]
//   errorFlag: [error: boolean]
//   errorMsg: [msg: string]
// }>()

  const handleOtpConfirmation = async () => {
    try {
      await httpClient.post('login/confirm', {
        challengeId: props.callengeID,
        email: props.email,
        code: otp.value
      })
      console.log('OTP confirmed successfully')
      loggedInSuccess.value = true
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
      <Toast
        v-model="errorFlag"
        type="alert"
        :message="message"
        :duration="6000"
        fluid
        class="auth-toast"
      />
      <form @submit.prevent="handleOtpConfirmation">
        <div class="form-group">
          <label for="otp">Enter OTP:</label>
          <input type="text" id="otp" v-model="otp" required />
        </div>
        <button type="submit">Confirm OTP</button>
      </form>
    </div>

  <Toast
      v-model="loggedInSuccess"
      type="good"
      message="Login successful!"
      fluid
      class="auth-toast"
    />
</template>

<style scoped>
.otp-confirm {
  width: 100%;
  max-width: 400px;
  margin: 80px auto;
  padding: 24px;
  border: 1px solid var(--border-default);
  background-color: var(--bg-subtle);
  border-radius: 8px;
}

.auth-toast {
  margin: 16px auto;
  max-width: 400px;
}
</style>
