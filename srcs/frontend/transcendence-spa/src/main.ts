import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { i18n, initI18n } from '@/i18n'

import '@/assets/tailwind.css'

import App from './App.vue'
import router from './router'

async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())
  const authStore = useAuthStore()
  await authStore.checkForAuthentication()
  await initI18n()
  app.use(router)
  app.use(i18n)
  await router.isReady()
  const { titleKey } = router.currentRoute.value.meta
  if (titleKey) document.title = i18n.global.t(titleKey)
  app.mount('#app')
}

bootstrap()
