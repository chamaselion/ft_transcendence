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
      const response = await httpClient.post('register', {
        login: username.value,
        email: email.value,
        password: password.value
      })
      window.location.href = `/login?email=${email.value}&redirect=true`
      } catch (error) {
        errorFlag.value = true
        msg.value = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong'
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
  <div class="register-card">
    <header class="register-card__header">
      <h1 class="register-card__title">Register</h1>
      <p class="register-card__subtitle">Create an account to get started.</p>
    </header>
    <div class="register-card__body">
      <Toast
        v-model="errorFlag"
        type="alert"
        :message="msg"
        :duration="6000"
        fluid
      />
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="username">Username:</label>
          <Input type="text" id="username" v-model="username" required />
        </div>
        <div class="form-group">
          <label for="email">Email:</label>
          <Input type="email" id="email" v-model="email" required />
        </div>
        <div class="form-group">
          <label for="password">Password:</label>
          <Input type="password" v-model="password" required />
        </div>
        <Button type="submit" size="large" class="register-card__submit">Register</Button>
      </form>
    </div>
    <p class="register-card__footer">
      Already have an account? <router-link to="/login">Login here</router-link>
    </p>
  </div>
</template>

<style scoped>
  .register-card {
    box-sizing: border-box;
    width: 100%;
    max-width: 400px;
    padding: 32px;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    background-color: var(--bg-surface);
    box-shadow: var(--shadow-md);
  }

  .register-card__header {
    margin-bottom: 24px;
    text-align: center;
  }

  .register-card__title {
    margin: 0 0 6px;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text-primary);
  }

  .register-card__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .register-card__body {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .register-card__submit {
    width: 100%;
    margin: 0;
  }

  .register-card__footer {
    margin: 20px 0 0;
    font-size: 14px;
    text-align: center;
    color: var(--text-secondary);
  }

  .register-card__footer :deep(a) {
    color: var(--color-primary);
    font-weight: 500;
    text-decoration: none;
  }

  .register-card__footer :deep(a):hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }
</style>
