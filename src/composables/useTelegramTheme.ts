import { computed } from 'vue'
import type { GlobalThemeOverrides } from 'naive-ui'

/**
 * Тема Naive UI на основе Telegram ThemeParams.
 * Локально — светлая тема по умолчанию.
 */
export function useTelegramTheme() {
  return computed<GlobalThemeOverrides | null>(() => {
    const tg = window.Telegram?.WebApp
    if (!tg?.themeParams) return null

    const p = tg.themeParams
    return {
      common: {
        primaryColor: p.button_color || '#2481cc',
        primaryColorHover: p.button_color ? adjustBrightness(p.button_color, 1.1) : '#2a8fd4',
        primaryColorPressed: p.button_color ? adjustBrightness(p.button_color, 0.9) : '#1e6fa8',
        bodyColor: p.bg_color || '#ffffff',
        textColor: p.text_color || '#000000',
        textColor3: p.hint_color || '#999999',
      },
    }
  })
}

function adjustBrightness(hex: string, factor: number): string {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.floor(((num >> 16) & 0xff) * factor))
  const g = Math.min(255, Math.floor(((num >> 8) & 0xff) * factor))
  const b = Math.min(255, Math.floor((num & 0xff) * factor))
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}
