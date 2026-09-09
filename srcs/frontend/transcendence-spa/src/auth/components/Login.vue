<script setup lang="ts">
  import { ref } from 'vue'
  import { httpClient } from '../auth.api'

  const username = ref()
  const password = ref()

  const handleLogin = () => {
    httpClient.post('login', {
      username: username.value,
      password: password.value
    })
    .then(response => {
      console.log('Login successful:', response.data)
      // Handle successful login (e.g., store token, redirect, etc.)
    })
    .catch(error => {
      console.error('Login failed:', error)
      // Handle login error (e.g., show error message)
    })
  }
</script>


<template>
  <div class="login-container">
    <h1>Login</h1>
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="username">Username:</label>
        <input type="text" id="username" v-model="username" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="text" id="password" v-model="password" required />
      </div>
      <button type="submit">Login</button>
    </form>
  </div>
</template>

<style scoped>
.login-container {
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
