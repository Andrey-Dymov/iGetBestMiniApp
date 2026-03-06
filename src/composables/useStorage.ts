/**
 * Хранилище: Telegram Cloud Storage или localStorage (fallback для локальной разработки).
 */
const STORAGE_KEY = 'igetbest_data'

export interface StoredData {
  schemaVersion: number
  comparisons: unknown[]
}

const defaultData: StoredData = {
  schemaVersion: 1,
  comparisons: [],
}

async function getCloudStorage(): Promise<{ getItem: (k: string) => Promise<string>; setItem: (k: string, v: string) => Promise<void> } | null> {
  try {
    const { cloudStorage, init } = await import('@tma.js/sdk')
    await init()
    const supported = typeof cloudStorage.isSupported === 'function' ? cloudStorage.isSupported() : cloudStorage.isSupported
    if (!supported) return null
    return {
      getItem: (key: string) => cloudStorage.getItem(key),
      setItem: (key: string, value: string) => cloudStorage.setItem(key, value),
    }
  } catch {
    return null
  }
}

function getLocalStorage(): { getItem: (k: string) => string; setItem: (k: string, v: string) => void } {
  return {
    getItem: (key: string) => localStorage.getItem(key) ?? '',
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
  }
}

let storageBackend: { getItem: (k: string) => string | Promise<string>; setItem: (k: string, v: string) => void | Promise<void> } | null = null

async function initStorage() {
  if (storageBackend) return storageBackend
  const cloud = await getCloudStorage()
  storageBackend = cloud ?? getLocalStorage()
  return storageBackend
}

export async function loadData(): Promise<StoredData> {
  const storage = await initStorage()
  const raw = await Promise.resolve(storage.getItem(STORAGE_KEY))
  if (!raw) return { ...defaultData }
  try {
    const parsed = JSON.parse(raw) as StoredData
    return { schemaVersion: 1, comparisons: parsed.comparisons ?? [] }
  } catch {
    return { ...defaultData }
  }
}

export async function saveData(data: StoredData): Promise<void> {
  const storage = await initStorage()
  await Promise.resolve(storage.setItem(STORAGE_KEY, JSON.stringify(data)))
}
