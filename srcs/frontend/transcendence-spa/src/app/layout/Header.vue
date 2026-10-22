<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useTheme } from '@/app/layout/useTheme'
import UserIcon from '@/app/components/UserIcon.vue'
import Icon from '@/app/components/Icon.vue'
import LanguageSwitcher from '@/app/layout/LanguageSwitcher.vue'
import { useAuthStore } from '@/stores/auth'

const { currentTheme, toggleTheme } = useTheme()
const route = useRoute()
const authStore = useAuthStore()

const isActive = (path: string) => (path === '/' ? route.path === '/' : route.path.startsWith(path))

const linkBase =
  'inline-flex items-center gap-2 m-0 whitespace-nowrap rounded-lg border px-3.5 py-2 text-[15px] font-medium leading-[1.4] no-underline cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-sm:gap-0 max-sm:px-2'
const navLink = `${linkBase} border-transparent hover:bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] hover:text-ink`
const ghostLink = `${navLink} bg-transparent`
const navIdle = 'border-transparent bg-transparent text-ink-secondary'
const navActive = 'border-transparent bg-surface text-ink shadow-[var(--shadow-sm)]'
const primaryLink = `${linkBase} border-transparent bg-brand text-brand-contrast shadow-card hover:bg-brand-hover hover:text-brand-contrast`
const logoutLink = `${linkBase} border-[color:color-mix(in_srgb,var(--color-alert)_45%,transparent)] bg-transparent text-danger hover:border-danger hover:bg-[color-mix(in_srgb,var(--color-alert)_12%,transparent)] hover:text-danger-hover`
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--bg-header)_88%,transparent)] px-6 py-2.5 shadow-[var(--shadow-sm)] backdrop-blur-[10px] max-sm:px-3"
  >
    <nav class="flex items-center gap-1">
      <router-link
        to="/"
        :class="[navLink, isActive('/') ? navActive : navIdle]"
        :title="$t('nav.home')"
        :aria-label="$t('nav.home')"
      >
        <Icon name="Home" :size="18" />
        <span class="btn--lable max-sm:hidden">{{ $t('nav.home') }}</span>
      </router-link>
      <router-link
        to="/editor"
        :class="[navLink, isActive('/editor') ? navActive : navIdle]"
        :title="$t('nav.editor')"
        :aria-label="$t('nav.editor')"
      >
        <Icon name="Pencil" :size="18" />
        <span class="btn--lable max-sm:hidden">{{ $t('nav.editor') }}</span>
      </router-link>
    </nav>

    <span class="flex-1" />

    <nav class="flex items-center gap-1">
      <template v-if="!authStore.isAuthenticated">
        <router-link
          to="/register"
          :class="[navLink, isActive('/register') ? navActive : navIdle]"
          :title="$t('nav.register')"
          :aria-label="$t('nav.register')"
        >
          <Icon name="PencilPlus" :size="18" />
          <span class="btn--lable max-sm:hidden">{{ $t('nav.register') }}</span>
        </router-link>
        <router-link
          to="/login"
          :class="primaryLink"
          :title="$t('nav.login')"
          :aria-label="$t('nav.login')"
        >
          <Icon name="Login" :size="18" />
          <span class="btn--lable max-sm:hidden">{{ $t('nav.login') }}</span>
        </router-link>
      </template>

      <button
        v-else
        :class="logoutLink"
        :title="$t('nav.logoutTitle')"
        :aria-label="$t('nav.logout')"
        @click.prevent="authStore.logout"
      >
        <Icon name="Logout" :size="18" />
        <span class="btn--lable max-sm:hidden">{{ $t('nav.logout') }}</span>
      </button>

      <button
        :class="ghostLink"
        :title="currentTheme === 'light' ? $t('nav.switchToDark') : $t('nav.switchToLight')"
        :aria-label="currentTheme === 'light' ? $t('nav.switchToDark') : $t('nav.switchToLight')"
        @click="toggleTheme"
      >
        <Icon :name="currentTheme === 'light' ? 'Moon' : 'Sun'" :size="18" />
        <span class="btn--lable max-sm:hidden">{{
          currentTheme === 'light' ? $t('nav.dark') : $t('nav.light')
        }}</span>
      </button>

      <LanguageSwitcher />
    </nav>
    <router-link v-if="authStore.isAuthenticated" to="/profile">
      <UserIcon
        :avatar-url="authStore.user?.avatarUrl ?? undefined"
        :name="authStore.user?.login"
      />
    </router-link>
    <router-link v-else to="/login">
      <UserIcon avatar-url="/user-default-avatar.png" />
    </router-link>
  </header>
</template>
