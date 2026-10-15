import { createRouter, createWebHistory } from 'vue-router'
import { i18n } from '@/i18n'

const routeTitles = {
  home: 'routes.home',
  login: 'routes.login',
  register: 'routes.register',
  editor: 'routes.editor',
  settings: 'routes.settings',
  componentTest: 'routes.componentCatalogue',
  oauthCallback: 'routes.oauthCallback',
} as const

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: (typeof routeTitles)[keyof typeof routeTitles]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/auth/views/LoginView.vue'),
      meta: { titleKey: routeTitles.login },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/app/HomeView.vue'),
      meta: { titleKey: routeTitles.home },
    },
    {
      path: '/editor/:id?',
      name: 'editor',
      component: () => import('@/app/EditorView.vue'),
      meta: { titleKey: routeTitles.editor },
    },
    {
      path: '/test',
      name: 'Componenttest',
      component: () => import('@/app/components/ComponentCatalouge.vue'),
      meta: { titleKey: routeTitles.componentTest },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/auth/views/RegisterView.vue'),
      meta: { titleKey: routeTitles.register },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/auth/views/SettingsView.vue'),
      meta: { titleKey: routeTitles.settings },
    },
    {
      name: 'oauth-callback',
      path: '/auth/oauth/:provider/callback',
      component: () => import('@/auth/views/OAuthCallbackView.vue'),
      meta: { titleKey: routeTitles.oauthCallback },
    },
  ],
})

router.afterEach((to) => {
  const titleKey = to.meta.titleKey ?? 'common.appName'
  document.title = i18n.global.t(titleKey)
})

export default router
