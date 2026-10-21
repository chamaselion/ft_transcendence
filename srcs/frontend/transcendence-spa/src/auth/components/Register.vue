<script setup lang="ts">
import { ref } from 'vue'
import { httpClient, HttpError } from '../auth.api'
import PasswordResetModal from './PasswordResetModal.vue'
import Toast from '@/app/components/Toast.vue'
import Input from '@/app/components/Input.vue'
import Button from '@/app/components/Button.vue'
import TermsOfServiceModal from '@/app/components/TermsOfServiceModal.vue'
import { rememberTermsAcceptance } from '../terms'
import { validateEmail, validateLogin, validatePassword } from '@/utils/validation'

const username = ref('')
const email = ref('')
const password = ref('')
const acceptedTerms = ref(false)
const termsError = ref('')
const termsOpen = ref(false)
const resetOpen = ref(false)
const emailInUse = ref(false)
const errorFlag = ref(false)
const msg = ref('')
const errors = ref({ username: '', email: '', password: '' })

const validateField = (field: 'username' | 'email' | 'password') => {
  const result =
    field === 'username'
      ? validateLogin(username.value)
      : field === 'email'
        ? validateEmail(email.value)
        : validatePassword(password.value)
  errors.value[field] = result.error ?? ''
  return result
}

const validateForm = () => {
  const usernameResult = validateField('username')
  const emailResult = validateField('email')
  const passwordResult = validateField('password')
  termsError.value = acceptedTerms.value ? '' : 'You must accept the Terms of Service to register.'
  return !usernameResult.error && !emailResult.error && !passwordResult.error && acceptedTerms.value
}

const acceptTerms = () => {
  acceptedTerms.value = true
  termsError.value = ''
  rememberTermsAcceptance()
}

const handleTermsChange = () => {
  termsError.value = ''
  if (acceptedTerms.value) rememberTermsAcceptance()
}

const handleRegister = async () => {
  if (!validateForm()) return
  rememberTermsAcceptance()
  emailInUse.value = false
  try {
    await httpClient.post('register', {
      login: username.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })
    window.location.href = `/login?email=${email.value}&redirect=true`
  } catch (error) {
    errorFlag.value = true
    msg.value =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Something went wrong'
    if (error instanceof HttpError) {
      if (error.status === 400) {
        console.log('Invalid data:', error.message)
      } else if (error.status === 409) {
        emailInUse.value = /email/i.test(error.message)
        console.log('User already exists:', error.message)
      } else {
        console.log(`Request failed: ${error.status}`, error.message)
      }
    } else {
      console.log('An unexpected error occurred:', error)
    }
  }
}
</script>

<template>
  <div
    class="box-border w-full max-w-[400px] rounded-xl border border-line-subtle bg-surface p-8 shadow-card"
  >
    <header class="mb-6 text-center">
      <h1 class="m-0 mb-1.5 text-[26px] leading-tight font-semibold text-ink">Register</h1>
      <p class="m-0 text-sm text-ink-secondary">Create an account to get started.</p>
    </header>
    <div class="flex flex-col gap-6">
      <Toast v-model="errorFlag" type="alert" :message="msg" :duration="6000" fluid />
      <form class="flex flex-col gap-4" @submit.prevent="handleRegister">
        <Input
          label="Username"
          type="text"
          v-model="username"
          required
          :error="errors.username"
          @blur="validateField('username')"
        />
        <Input
          label="Email"
          type="email"
          v-model="email"
          required
          :error="errors.email"
          @blur="validateField('email')"
          @input="emailInUse = false"
        />
        <Input
          label="Password"
          type="password"
          v-model="password"
          required
          :error="errors.password"
          @blur="validateField('password')"
        />
        <div class="flex flex-col gap-1.5">
          <label class="flex items-start gap-2 text-sm leading-normal text-ink-secondary">
            <input
              v-model="acceptedTerms"
              type="checkbox"
              class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--color-primary)]"
              @change="handleTermsChange"
            />
            <span>
              I agree to the
              <button
                type="button"
                class="m-0 cursor-pointer border-0 bg-transparent p-0 text-brand hover:bg-transparent hover:text-brand-hover hover:underline"
                @click.prevent.stop="termsOpen = true"
              >
                Terms of Service</button
              >.
            </span>
          </label>
          <p v-if="termsError" class="m-0 text-[13px] text-danger">{{ termsError }}</p>
        </div>
        <Button type="submit" size="large" class="w-full">Register</Button>
      </form>

      <div
        v-if="emailInUse"
        class="flex flex-col gap-2 rounded-md border border-warning bg-warning/12 px-3 py-2.5"
      >
        <p class="m-0 text-sm leading-normal text-ink">
          An account with this email already exists. You can reset its password instead.
        </p>
        <Button
          variant="outlined"
          color="warning"
          size="small"
          class="self-start"
          @click="resetOpen = true"
        >
          Reset password
        </Button>
      </div>
    </div>
    <p class="mt-5 text-center text-sm text-ink-secondary">
      Already have an account?
      <router-link
        to="/login"
        class="font-medium text-brand no-underline hover:text-brand-hover hover:underline"
        >Login here</router-link
      >
    </p>
  </div>

  <PasswordResetModal v-model="resetOpen" :initial-email="email" />
  <TermsOfServiceModal v-model="termsOpen" show-accept @accept="acceptTerms" />
</template>
