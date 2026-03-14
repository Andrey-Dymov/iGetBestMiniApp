import { createI18n } from 'vue-i18n'
import ru from './locales/ru.json'
import en from './locales/en.json'
import zh from './locales/zh.json'
import hi from './locales/hi.json'
import es from './locales/es.json'
import bn from './locales/bn.json'
import pt from './locales/pt.json'
import ja from './locales/ja.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import ar from './locales/ar.json'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    ru,
    en,
    zh,
    hi,
    es,
    bn,
    pt,
    ja,
    fr,
    de,
    ar,
  },
})

export const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'ES' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'pt', label: 'PT' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'ar', label: 'العربية' },
] as const

const LOCALE_CODES = LOCALES.map((l) => l.code)

export type LocaleCode = (typeof LOCALES)[number]['code']

/** Определяет язык по умолчанию: сохранённый → системный → en */
export function getDefaultLocale(): LocaleCode {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('igetbest-locale')
    if (saved && (LOCALE_CODES as readonly string[]).includes(saved)) return saved as LocaleCode
  }
  const sys = typeof navigator !== 'undefined' && (navigator.language || (navigator as { userLanguage?: string }).userLanguage || '')
  const sysLang = sys ? sys.toLowerCase().slice(0, 2) : ''
  const map: Record<string, LocaleCode> = {
    ru: 'ru',
    zh: 'zh',
    hi: 'hi',
    es: 'es',
    bn: 'bn',
    pt: 'pt',
    ja: 'ja',
    fr: 'fr',
    de: 'de',
    ar: 'ar',
  }
  return map[sysLang] ?? 'en'
}
