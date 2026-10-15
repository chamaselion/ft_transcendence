<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useTheme } from '@/app/layout/useTheme'
// import UserIcon from '@/app/layout/UserIcon.vue'
import Icon from '@/app/components/Icon.vue'
import LanguageSwitcher from '@/app/layout/LanguageSwitcher.vue'
import { useAuthStore } from '@/stores/auth'

const { currentTheme, toggleTheme } = useTheme()
const route = useRoute()
const authStore = useAuthStore()
// const currentUser = {
//   avatarUrl: 'https://thispersondoesnotexist.com/random-person.jpeg',
//   name: 'John Doe'
// };

const isActive = (path: string) =>
  path === '/' ? route.path === '/' : route.path.startsWith(path)
</script>

<template>
  <header class="header">
    <nav class="header__nav">
      <router-link
        to="/"
        class="header__link"
        :class="{ 'header__link--active': isActive('/') }"
      >Home</router-link>
      <router-link
        to="/editor"
        class="header__link"
        :class="{ 'header__link--active': isActive('/editor') }"
      >Editor</router-link>
    </nav>

    <span class="header__spacer" />

    <nav class="header__nav header__nav--end">
      <template v-if="!authStore.isAuthenticated">
        <router-link
          to="/register"
          class="header__link"
          :class="{ 'header__link--active': isActive('/register') }"
        >Register</router-link>
        <router-link
          to="/login"
          class="header__link header__link--primary"
        >
          <Icon name="Login" :size="18" />
          <span>Login</span>
        </router-link>
      </template>

      <button
        v-else
        class="header__link header__link--logout"
        title="Log out of your account"
        @click.prevent="authStore.logout"
      >
        <Icon name="Logout" :size="18" />
        <span>Logout</span>
      </button>

      <button
        class="header__link header__link--ghost"
        :title="currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
        @click="toggleTheme"
      >
        <Icon :name="currentTheme === 'light' ? 'Moon' : 'Sun'" :size="18" />
        <span>{{ currentTheme === 'light' ? 'Dark' : 'Light' }}</span>
      </button>

      <LanguageSwitcher />
    </nav>
    <!-- <UserIcon :user="currentUser" /> -->
  </header>
</template>

<style scoped>
  .header {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background-color: color-mix(in srgb, var(--bg-header) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-default);
    box-shadow: var(--shadow-sm);
  }

  .header__nav {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header__spacer {
    flex: 1;
  }

  /* Neutral pill shared by nav links and icon buttons */
  .header__link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 8px 14px;
    border: 1px solid transparent;
    border-radius: 8px;
    background-color: transparent;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.4;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease,
      border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .header__link :deep(.icon) {
    flex-shrink: 0;
  }

  .header__link:hover {
    background-color: color-mix(in srgb, var(--text-primary) 8%, transparent);
    color: var(--text-primary);
  }

  .header__link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .header__link--active {
    background-color: var(--bg-surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  /* Main call to action while logged out */
  .header__link--primary {
    background-color: var(--color-primary);
    color: var(--color-primary-contrast);
    box-shadow: var(--shadow-md);
  }

  .header__link--primary:hover {
    background-color: var(--color-primary-hover);
    color: var(--color-primary-contrast);
  }

  /* Destructive action, deliberately not a nav link */
  .header__link--logout {
    border-color: color-mix(in srgb, var(--color-alert) 45%, transparent);
    color: var(--color-alert);
  }

  .header__link--logout:hover {
    background-color: color-mix(in srgb, var(--color-alert) 12%, transparent);
    border-color: var(--color-alert);
    color: var(--color-alert-hover);
  }
</style>
