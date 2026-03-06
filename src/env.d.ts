/// <reference types="vite/client" />

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string
        themeParams?: Record<string, string>
      }
    }
  }
}

export {}
