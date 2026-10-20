<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useTheme } from '@/app/layout/useTheme'
import UserIcon from '@/app/components/UserIcon.vue'
import Icon from '@/app/components/Icon.vue'
import { useAuthStore } from '@/stores/auth'

const { currentTheme, toggleTheme } = useTheme()
const route = useRoute()
const authStore = useAuthStore()
const currentUser = {
  avatarUrl: 'https://thispersondoesnotexist.com/random-person.jpeg',
  name: 'John Doe',
}

const isActive = (path: string) => (path === '/' ? route.path === '/' : route.path.startsWith(path))

const linkBase =
  'inline-flex items-center gap-2 m-0 whitespace-nowrap rounded-lg border px-3.5 py-2 text-[15px] font-medium leading-[1.4] no-underline cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const navLink = `${linkBase} border-transparent hover:bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] hover:text-ink`
const ghostLink = `${navLink} bg-transparent`
const navIdle = 'border-transparent bg-transparent text-ink-secondary'
const navActive = 'border-transparent bg-surface text-ink shadow-[var(--shadow-sm)]'
const primaryLink = `${linkBase} border-transparent bg-brand text-brand-contrast shadow-card hover:bg-brand-hover hover:text-brand-contrast`
const logoutLink = `${linkBase} border-[color:color-mix(in_srgb,var(--color-alert)_45%,transparent)] bg-transparent text-danger hover:border-danger hover:bg-[color-mix(in_srgb,var(--color-alert)_12%,transparent)] hover:text-danger-hover`
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--bg-header)_88%,transparent)] px-6 py-2.5 shadow-[var(--shadow-sm)] backdrop-blur-[10px]"
  >
    <nav class="flex items-center gap-1">
      <router-link to="/" :class="[navLink, isActive('/') ? navActive : navIdle]">Home</router-link>
      <router-link to="/editor" :class="[navLink, isActive('/editor') ? navActive : navIdle]"
        >Editor</router-link
      >
    </nav>

    <span class="flex-1" />

    <nav class="flex items-center gap-1">
      <template v-if="!authStore.isAuthenticated">
        <router-link to="/register" :class="[navLink, isActive('/register') ? navActive : navIdle]"
          >Register</router-link
        >
        <router-link to="/login" :class="primaryLink">
          <Icon name="Login" :size="18" />
          <span>Login</span>
        </router-link>
      </template>

      <button
        v-else
        :class="logoutLink"
        title="Log out of your account"
        @click.prevent="authStore.logout"
      >
        <Icon name="Logout" :size="18" />
        <span>Logout</span>
      </button>

      <button
        :class="ghostLink"
        :title="currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
        @click="toggleTheme"
      >
        <Icon :name="currentTheme === 'light' ? 'Moon' : 'Sun'" :size="18" />
        <span>{{ currentTheme === 'light' ? 'Dark' : 'Light' }}</span>
      </button>
    </nav>
    <router-link v-if="authStore.isAuthenticated" to="/profile">
      <UserIcon :avatar-url="currentUser.avatarUrl" />
    </router-link>
    <router-link v-else to="/login">
      <UserIcon avatar-url="/user-default-avatar.png" />
    </router-link>
  </header>
</template>
