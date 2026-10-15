<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import DocumentDirectory from '@/app/components/DocumentDirectory.vue'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
</script>

<template>
  <main class="home-view">
    <!-- Logged in: show DocumentDirectory -->
    <template v-if="authStore.isAuthenticated">
      <DocumentDirectory />
    </template>

    <!-- Logged out: Welcome hero -->
    <template v-else>
      <section class="home-hero">
        <div class="home-hero__badge">
          <Icon name="Sparkles" :size="16" />
          <span>{{ $t('home.badge') }}</span>
        </div>
        <h1 class="home-hero__title">{{ $t('home.title') }}</h1>
        <p class="home-hero__subtitle">
          {{ $t('home.subtitle') }}
        </p>
        <div class="home-hero__actions">
          <Button @click="router.push('/register')">{{ $t('home.getStarted') }}</Button>
          <Button @click="router.push('/login')">{{ $t('home.login') }}</Button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.home-view {
  box-sizing: border-box;
  width: 100%;
  min-height: calc(100vh - 61px);
  padding: 40px 24px;
}

.home-view__loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.home-view__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-default);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.home-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 640px;
  margin: 60px auto 0;
  padding: 48px 32px;
  border-radius: 16px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-md);
}

.home-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 9999px;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 20px;
}

.home-hero__title {
  margin: 0 0 12px;
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.home-hero__subtitle {
  margin: 0 0 32px;
  font-size: 1.1rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.home-hero__actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
