/// <reference types="vite/client" />

import type en from './i18n/locales/en.json'

type EnMessages = typeof en

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends EnMessages {}
}
