<script setup lang="ts">
import { ref } from 'vue'
import { httpClient, HttpError } from '../auth.api'
import Toast from '@/app/components/Toast.vue'
import Input from '@/app/components/Input.vue'
import Button from '@/app/components/Button.vue'

const username = ref('')
const email = ref('')
const password = ref('')
const errorFlag = ref(false)
const msg = ref('')

const handleRegister = async () => {
  try {
    await httpClient.post('register', {
      login: username.value,
      email: email.value,
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
        <Input label="Username" type="text" v-model="username" required />
        <Input label="Email" type="email" v-model="email" required />
        <Input label="Password" type="password" v-model="password" required />
        <Button type="submit" size="large" class="w-full">Register</Button>
      </form>
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
</template>
