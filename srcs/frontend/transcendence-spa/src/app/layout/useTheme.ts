import { ref } from 'vue'

export type Theme = 'light' | 'dark'

const savedTheme =
  (localStorage.getItem('app-theme') as Theme) ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

const currentTheme = ref<Theme>(savedTheme)

export function useTheme() {
  const applyTheme = (theme: Theme) => {
    currentTheme.value = theme
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('app-theme', theme)
  }

  const toggleTheme = () => {
    applyTheme(currentTheme.value === 'light' ? 'dark' : 'light')
  }

  // Initialize on import
  applyTheme(currentTheme.value)

  return {
    currentTheme,
    toggleTheme,
    setTheme: applyTheme,
  }
}
