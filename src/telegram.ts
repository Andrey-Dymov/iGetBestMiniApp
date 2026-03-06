/**
 * Инициализация Telegram Mini App SDK.
 * В браузере (localhost) — не инициализируется, приложение работает с fallback.
 */
export async function initTelegram() {
  try {
    const { init } = await import('@tma.js/sdk')
    init()
    return true
  } catch {
    return false
  }
}

export function isInTelegram(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData
}
