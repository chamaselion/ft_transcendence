import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

import '@/assets/tailwind.css'

import App from './App.vue'
import router from './router'

async function bootstrap() {
  const app = createApp(App)

  app.use(createPinia())

  const authStore = useAuthStore()
  await authStore.checkForAuthentication()

  app.use(router)

  app.mount('#app')
}

bootstrap()
