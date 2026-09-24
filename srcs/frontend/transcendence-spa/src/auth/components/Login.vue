<script setup lang="ts">
  import { ref } from 'vue'
  import { httpClient,  HttpError } from '../auth.api'
  import Toast from '@/app/components/Toast.vue'
  import Input from '@/app/components/Input.vue'

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
  
  const email = ref(props.email ?? '');
  const password = ref()
  const errorFlag = ref(false)
  const message = ref('')
  const otpConfirmationRequired = ref(false)
  const otp = ref('')
  let callengeID: string
  const loggeInSuccess = ref(false)
  const registerRedirectFlag = ref(Boolean(props.isRegisterRedirect))

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
      message.value = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong'
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
      message.value = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong'
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

  <Toast
    v-model="registerRedirectFlag"
    type="info"
    message="Registered successfully!"
    hint="Please login to receive an OTP validaiton code."
    :duration="8000"
    fluid
    class="auth-toast"
  />

  <div class="login-container" v-if="!otpConfirmationRequired">
    <h1>Login</h1>
    <Toast
      v-model="errorFlag"
      type="alert"
      :message="message"
      :duration="6000"
      fluid
      class="auth-toast"
    />
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="email">E-mail:</label>
        <Input type="text" id="email" v-model="email" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <Input type="password" id="password" v-model="password" required />
      </div>
      <button type="submit">Login</button>
    </form>
    <p v-if="!registerRedirectFlag">Don't have an account? <router-link to="/register">Register here</router-link></p>
  </div>

  <div class="otp-confirm" v-if="otpConfirmationRequired && !loggeInSuccess">
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
    v-model="loggeInSuccess"
    type="good"
    message="Login successful!"
    hint="Redirecting to home page..."
    :duration="2500"
    fluid
    class="auth-toast"
  />
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

.auth-toast {
  margin: 16px auto;
  max-width: 400px;
}
</style>
