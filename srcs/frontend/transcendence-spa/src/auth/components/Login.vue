<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { httpClient,  HttpError } from '../auth.api'

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

  const email = ref()
  const password = ref()
  const errorFlag = ref(false)
  const message = ref('')
  const otpConfirmationRequired = ref(false)
  const otp = ref('')
  let callengeID: string

  const handleLogin = async () => {
    try {
      const data = await httpClient.post<LoginResponse>('login', {
        email: email.value,
        password: password.value
      })
      callengeID = data.challengeId
      otpConfirmationRequired.value = true
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 400) {
          errorFlag.value = true
          message.value = error.message
          console.log(error.message)
        } else if (error.status === 401) {
          console.log('Wrong email or password')
        } else {
          errorFlag.value = true
          message.value = error.message
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
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 400) {
          errorFlag.value = true
          message.value = error.message
          console.log(error.message)
        } else if (error.status === 401) {
          console.log('Wrong OTP')
        } else {
          errorFlag.value = true
          message.value = error.message
          console.log(`Request failed: ${error.status}`)
        }
        console.log(error.message)
      }
    }
  }
</script>


<template>
  <div class="login-container" v-if="!otpConfirmationRequired">
    <h1>Login</h1>
    <div v-if="errorFlag" class="error-message">
      {{ message }}
    </div>
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="email">E-mail:</label>
        <input type="text" id="email" v-model="email" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="text" id="password" v-model="password" required />
      </div>
      <button type="submit">Login</button>
    </form>
  </div>
  <div class="otp-confirm" v-if="otpConfirmationRequired">
    <h1>OTP Confirmation</h1>
    <form @submit.prevent="handleOtpConfirmation">
      <div class="form-group">
        <label for="otp">Enter OTP:</label>
        <input type="text" id="otp" v-model="otp" required />
      </div>
      <button type="submit">Confirm OTP</button>
    </form>
  </div>
</template>

<style scoped>
.login-container, .otp-confirm {
  width: 100%;
  max-width: 400px;
  margin: 80px auto;
  padding: 24px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.login-container h1 {
  margin-bottom: 24px;
  text-align: center;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-sizing: border-box;
}

.error-message {
  background-color: var(--error-color);
  margin: 10px 5px;
  text-align: center;

}

button {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 4px;
  background-color: var(--border-color);
  color: white;
  cursor: pointer;
}

button:hover {
  background-color: var(--active-color);
}
</style>
