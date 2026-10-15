import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { i18n, initI18n } from '@/i18n'

import App from './App.vue'
import router from './router'

const app = createApp(App)


app.use(createPinia())

const authStore = useAuthStore()
authStore.checkForAuthentication()

app.use(router)
app.use(i18n)

initI18n().finally(() => {
  const { titleKey } = router.currentRoute.value.meta
  if (titleKey) document.title = i18n.global.t(titleKey)
  app.mount('#app')
})
