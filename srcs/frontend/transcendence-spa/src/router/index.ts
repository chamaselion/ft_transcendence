import { useAuthStore } from '@/stores/auth'
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
  notFound: 'routes.notFound',
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
      name: 'oauth-consent',
      path: '/auth/oauth/:provider/consent',
      component: () => import('@/auth/views/OAuthConsentView.vue'),
    },
    {
      name: 'oauth-callback',
      path: '/auth/oauth/:provider/callback',
      component: () => import('@/auth/views/OAuthCallbackView.vue'),
      meta: { titleKey: routeTitles.oauthCallback },
    },
    {
      path: '/profile',
      name: 'Profile',
      component: () => import('@/app/ProfileView.vue'),
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/app/AdminView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/app/NotFoundView.vue'),
      meta: { titleKey: routeTitles.notFound },
    },
  ],
})

router.afterEach((to) => {
  const titleKey = to.meta.titleKey ?? 'common.appName'
  document.title = i18n.global.t(titleKey)
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.name === 'Admin') {
    if (authStore.isAdmin()) return true
    else return { name: 'home' }
  }
  if (to.name === 'editor' && !authStore.isAuthenticated) {
    return { name: 'login' }
  }
  return true
})

export default router
