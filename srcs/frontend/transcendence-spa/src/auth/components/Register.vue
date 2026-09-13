<script setup lang="ts">
  import { ref } from 'vue'
  import { httpClient, HttpError } from '../auth.api'

  const username = ref('')
  const email = ref('')
  const password = ref('')

  const handleRegister = async () => {
    try {
      const response = await httpClient.post('register', {
        login: username.value,
        email: email.value,
        password: password.value
      })
      window.location.href = `/login?email=${email.value}&redirect=true`
      } catch (error) {
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
  <div class="register-container">
    <h1>Register</h1>
    <form @submit.prevent="handleRegister">
      <div class="form-group">
        <label for="username">Username:</label>
        <input type="text" id="username" v-model="username" required />
      </div>
      <div class="form-group">
        <label for="email">Email:</label>
        <input type="email" id="email" v-model="email" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="password" v-model="password" required />
      </div>
      <button type="submit">Register</button>
    </form>
    <p>Already have an account? <router-link to="/login">Login here</router-link></p>
  </div>
</template>

<style scoped>
  .register-container {
    max-width: 400px;
    margin: 0 auto;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    background-color: var(--bg-subtle);
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
  border: 1px solid var(--border-default);
  border-radius: 4px;
  box-sizing: border-box;
}
</style>
