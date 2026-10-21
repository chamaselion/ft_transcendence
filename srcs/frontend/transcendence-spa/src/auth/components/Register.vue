<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { httpClient, HttpError } from '../auth.api'
import Toast from '@/app/components/Toast.vue'
import Input from '@/app/components/Input.vue'
import Button from '@/app/components/Button.vue'
import { validateEmail, validateLogin, validatePassword } from '@/utils/validation'

const { t } = useI18n()

const username = ref('')
const email = ref('')
const password = ref('')
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
  return !usernameResult.error && !emailResult.error && !passwordResult.error
}

const handleRegister = async () => {
  if (!validateForm()) return
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
          : t('common.somethingWentWrong')
    if (error instanceof HttpError) {
      if (error.status === 400) {
        console.log('Invalid data:', error.message)
      } else if (error.status === 409) {
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
      <h1 class="m-0 mb-1.5 text-[26px] leading-tight font-semibold text-ink">{{ $t('auth.register.title') }}</h1>
      <p class="m-0 text-sm text-ink-secondary">{{ $t('auth.register.subtitle') }}</p>
    </header>
    <div class="flex flex-col gap-6">
      <Toast v-model="errorFlag" type="alert" :message="msg" :duration="6000" fluid />
      <form class="flex flex-col gap-4" @submit.prevent="handleRegister">
        <Input :label="$t('auth.register.usernameLabel')" type="text" v-model="username" required :error="errors.username" @blur="validateField('username')"/>
        <Input :label="$t('auth.register.emailLabel')" type="email" v-model="email" required :error="errors.email" @blur="validateField('email')"/>
        <Input :label="$t('auth.register.passwordLabel')" type="password" v-model="password" required :error="errors.password" @blur="validateField('password')" />
        <Button type="submit" size="large" class="w-full">{{ $t('auth.register.submit') }}</Button>
      </form>
    </div>
    <p class="mt-5 text-center text-sm text-ink-secondary">
      {{ $t('auth.register.footerText') }}
      <router-link
        to="/login"
        class="font-medium text-brand no-underline hover:text-brand-hover hover:underline"
        >{{ $t('auth.register.footerLink') }}</router-link
      >
    </p>
  </div>
</template>
