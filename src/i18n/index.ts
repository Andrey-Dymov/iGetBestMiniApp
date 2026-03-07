import { createI18n } from 'vue-i18n'
import ru from './locales/ru.json'
import en from './locales/en.json'
import zh from './locales/zh.json'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    ru,
    en,
    zh,
  },
})

export const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'zh', label: '中文' },
] as const

const LOCALE_CODES = LOCALES.map((l) => l.code)

/** Определяет язык по умолчанию: сохранённый → системный → en */
export function getDefaultLocale(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('igetbest-locale')
    if (saved && LOCALE_CODES.includes(saved)) return saved
  }
  const sys = typeof navigator !== 'undefined' && (navigator.language || (navigator as { userLanguage?: string }).userLanguage || '')
  const sysLang = sys ? sys.toLowerCase().slice(0, 2) : ''
  if (sysLang === 'ru') return 'ru'
  if (sysLang === 'zh') return 'zh'
  return 'en'
}
