<script setup lang="ts">
import router from '@/router';
import { useTheme } from '@/app/layout/useTheme'
// import UserIcon from '@/app/layout/UserIcon.vue'
import { useAuthStore } from '@/stores/auth'

const { currentTheme, toggleTheme } = useTheme();
const authStore = useAuthStore();
// const currentUser = {
//   avatarUrl: 'https://thispersondoesnotexist.com/random-person.jpeg',
//   name: 'John Doe'
// };
</script>

<template>
  <header>
    <nav>
      <router-link to="/">Home</router-link>
      <router-link to="/editor">Editor</router-link>
      <router-link to="/login" v-if="!authStore.isAuthenticated">Login</router-link>
      <router-link to="/register" v-if="!authStore.isAuthenticated">Register</router-link>
      <button @click.prevent="authStore.logout" v-else>Logout</button>
    </nav>
    <span style="flex: 1"></span>
    <button class="theme-toggle" @click="toggleTheme">
      {{ currentTheme === 'light' ? 'Dark' : 'Light' }}
    </button>
    <!-- <UserIcon :user="currentUser" /> -->
  </header>
</template>

<style scoped>
  header {
    display: flex;
    align-items: center;
    background-color: var(--bg-header);
    padding: 10px 24px;
  }

  /* :deep(a) targets <router-link> through Vue's scoped styles */
  :deep(a), button {
    display: inline-block;
    background-color: var(--bg-surface);
    border: none;
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 16px;
    font-family: inherit;
    text-decoration: none;
    cursor: pointer;
    margin-right: 10px;
    padding: 6px 12px;
    line-height: 1.5;
  }

  :deep(a):hover, button:hover {
    color: var(--color-primary-hover);
  }
</style>
