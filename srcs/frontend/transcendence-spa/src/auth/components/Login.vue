<script setup lang="ts">
  import { ref } from 'vue'
  import { httpClient,  HttpError } from '../auth.api'
  import MessageCard from '@/app/components/MessageCard.vue'

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

  const email = ref(props.email)
  const password = ref()
  const errorFlag = ref(false)
  const message = ref('')
  const otpConfirmationRequired = ref(false)
  const otp = ref('')
  let callengeID: string
  const loggeInSuccess = ref(false)
  const registerRedirectFlag = ref(props.isRegisterRedirect)

  const handleLogin = async () => {
    try {
      const data = await httpClient.post<LoginResponse>('login', {
        email: email.value,
        password: password.value
      })
      callengeID = data.challengeId
      otpConfirmationRequired.value = true
    } catch (error) {
      errorFlag.value = true
      // message.value = error.message // TODO
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
    }
  }

  const handleOtpConfirmation = async () => {
    try {
      const data = await httpClient.post('login/confirm', {
        challengeId: callengeID,
        email: email.value,
        code: otp.value
      })
      console.log('OTP confirmed successfully')
      loggeInSuccess.value = true
      redirectToHome();
    } catch (error) {
      errorFlag.value = true
      // message.value = error.message // TODO
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

  const redirectToHome = () => {
    setTimeout(() => {
    window.location.href = '/'
    }, 2500)
  }
</script>


<template>

  <MessageCard v-if="registerRedirectFlag"
               message="Registered successfully!"
               hint="Please login to receive an OTP validaiton code."/>

  <div class="login-container" v-if="!otpConfirmationRequired">
    <h1>Login</h1>
    <MessageCard v-if="errorFlag"
                :message="message"
                 :errorMsg="true"/>
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="email">E-mail:</label>
        <input type="text" id="email" v-model="email" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="password" id="password" v-model="password" required />
      </div>
      <button type="submit">Login</button>
    </form>
    <p v-if="!registerRedirectFlag">Don't have an account? <router-link to="/register">Register here</router-link></p>
  </div>

  <div class="otp-confirm" v-if="otpConfirmationRequired && !loggeInSuccess">
    <h1>OTP Confirmation</h1>
    <form @submit.prevent="handleOtpConfirmation">
      <div class="form-group">
        <label for="otp">Enter OTP:</label>
        <input type="text" id="otp" v-model="otp" required />
      </div>
      <button type="submit">Confirm OTP</button>
    </form>
  </div>

  <MessageCard v-if="loggeInSuccess"
               message="Login successful!"
               hint="Redirecting to home page..."/>
</template>

<style scoped>
.login-container, .otp-confirm, .login-success {
  width: 100%;
  max-width: 400px;
  margin: 80px auto;
  padding: 24px;
  border: 1px solid var(--border-default);
  background-color: var(--bg-subtle);
  border-radius: 8px;
}

.login-container h1 {
  margin-bottom: 24px;
  text-align: center;
}

.error-message {
  background-color: red;
  margin: 10px 5px;
  text-align: center;

}
</style>
