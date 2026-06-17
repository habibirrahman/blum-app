import type { AppStateSchema } from '@/stores/app.store'
import type { ClientStateSchema } from '@/stores/client.store'
import type { SessionStateSchema } from '@/stores/session.store'
import { Preferences } from '@capacitor/preferences'

interface SetAccessStorageProps {
  access: string
  csrf: string
}

// ========================================
// ACCESS TOKEN — IN-MEMORY CACHE
// getAccessStorage() dipanggil di axios request interceptor untuk SETIAP
// HTTP request (2x native Preferences.get per call). Token jarang berubah
// (hanya saat login/refresh/logout), jadi kita cache di memory dan hanya
// invalidate saat set/remove dipanggil.
// ========================================
let accessCache: { access: string; csrf: string } | null = null
let accessCacheInitialized = false

export const setAccessStorage = async ({ access, csrf }: SetAccessStorageProps) => {
  try {
    await Preferences.set({ key: 'access', value: access })
    await Preferences.set({ key: 'csrf', value: csrf })
    // Update cache langsung, tidak perlu re-read dari storage
    accessCache = { access, csrf }
    accessCacheInitialized = true
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
export const getAccessStorage = async () => {
  // Native read hanya terjadi sekali (cold start), selanjutnya pakai cache di memory.
  if (accessCacheInitialized) {
    if (accessCache) {
      return { success: true, data: accessCache }
    }
    return { success: false, data: null }
  }

  try {
    const access = await Preferences.get({ key: 'access' })
    const csrf = await Preferences.get({ key: 'csrf' })
    accessCacheInitialized = true

    if (
      !access.value ||
      access.value === 'undefined' ||
      !csrf.value ||
      csrf.value === 'undefined'
    ) {
      accessCache = null
      return { success: false, data: null }
    } else {
      const data = {
        access: access.value || '',
        csrf: csrf.value || ''
      }
      accessCache = data
      return { success: true, data }
    }
  } catch (error) {
    console.error(error)
    return { success: false, data: null }
  }
}
export const removeAccessStorage = async () => {
  try {
    await Preferences.remove({ key: 'access' })
    await Preferences.remove({ key: 'csrf' })
    // Invalidate cache
    accessCache = null
    accessCacheInitialized = true
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}

export const setAppStorage = async (data: AppStateSchema) => {
  try {
    await Preferences.set({ key: 'app.storage', value: JSON.stringify(data) })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
export const getAppStorage = async () => {
  try {
    const storage = await Preferences.get({ key: 'app.storage' })
    if (!storage.value || storage.value === 'undefined') {
      return { success: false, data: null }
    } else {
      const data = JSON.parse(storage.value || '')
      return { success: true, data }
    }
  } catch (error) {
    console.error(error)
    return { success: false, data: null }
  }
}
export const removeAppStorage = async () => {
  try {
    await Preferences.remove({ key: 'app.storage' })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}

export const setStorage = async (data: { key: string; value: string }) => {
  try {
    await Preferences.set({ key: data.key, value: data.value })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
export const getStorage = async (key: string) => {
  try {
    const storage = await Preferences.get({ key })
    if (!storage.value || storage.value === 'undefined') {
      return { success: false, data: null }
    } else {
      const data = JSON.parse(storage.value || '')
      return { success: true, data }
    }
  } catch (error) {
    console.error(error)
    return { success: false, data: null }
  }
}
export const removeStorage = async (key: string) => {
  try {
    await Preferences.remove({ key })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}

// end session storage
export const setSessionStorage = async (data: SessionStateSchema) => {
  try {
    await Preferences.set({ key: 'session.store', value: JSON.stringify(data) })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
export const getSessionStorage = async () => {
  try {
    const storage = await Preferences.get({ key: 'session.store' })
    if (!storage.value || storage.value === 'undefined') {
      return { success: false, data: null }
    } else {
      const data = JSON.parse(storage.value || '')
      return { success: true, data }
    }
  } catch (error) {
    console.error(error)
    return { success: false, data: null }
  }
}
export const removeSessionStorage = async () => {
  try {
    await Preferences.remove({ key: 'session.store' })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
// end session storage

// ========================================
// SESSION STORE — SINGLE KEY (optimized)
// Menggabungkan 9 key terpisah menjadi 1 key agar
// hanya ada 1x Preferences.set per sync, bukan 9x.
// ========================================

const SESSION_STORE_KEY = 'session.full-store'

export type SessionFullStore = {
  session: any
  session_comments: any[]
  session_measurements: any[]
  upcoming_sessions: any[]
  upcoming_sessions_count: number
  sessions: any[]
  sessions_count: number
  pending_progress: any[]
}

export const setSessionFullStore = async (data: SessionFullStore) => {
  try {
    await Preferences.set({ key: SESSION_STORE_KEY, value: JSON.stringify(data) })
    return { success: true }
  } catch (error) {
    console.error('[setSessionFullStore] Failed:', error)
    return { success: false }
  }
}

export const getSessionFullStore = async (): Promise<{ success: boolean; data: SessionFullStore | null }> => {
  try {
    const storage = await Preferences.get({ key: SESSION_STORE_KEY })
    if (!storage.value || storage.value === 'undefined') {
      return { success: false, data: null }
    }
    const data = JSON.parse(storage.value) as SessionFullStore
    return { success: true, data }
  } catch (error) {
    console.error('[getSessionFullStore] Failed:', error)
    return { success: false, data: null }
  }
}

export const removeSessionFullStore = async () => {
  try {
    await Preferences.remove({ key: SESSION_STORE_KEY })
    return { success: true }
  } catch (error) {
    console.error('[removeSessionFullStore] Failed:', error)
    return { success: false }
  }
}

// ========================================
// SESSION ACTIVITIES — IN-MEMORY BATCH WRITE
// Menulis ke storage hanya saat flush, bukan setiap aksi.
// ========================================

export const flushSessionActivities = async (sessionId: number, activities: any[]) => {
  try {
    const key = `session_activities_${sessionId}`
    const data = {
      session_id: sessionId,
      activities,
      timestamp: Date.now()
    }
    await Preferences.set({ key, value: JSON.stringify(data) })
    return { success: true }
  } catch (error) {
    console.error('[flushSessionActivities] Failed:', error)
    return { success: false }
  }
}

export const getSessionActivities = async (sessionId: number) => {
  try {
    const key = `session_activities_${sessionId}`
    const storage = await Preferences.get({ key })
    if (!storage.value || storage.value === 'undefined') {
      return { success: false, data: null }
    }
    const data = JSON.parse(storage.value)
    return { success: true, data }
  } catch (error) {
    console.error('[getSessionActivities] Failed:', error)
    return { success: false, data: null }
  }
}

// client storage
export const setClientStorage = async (data: ClientStateSchema) => {
  try {
    await Preferences.set({ key: 'client.store', value: JSON.stringify(data) })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
export const getClientStorage = async () => {
  try {
    const storage = await Preferences.get({ key: 'client.store' })
    if (!storage.value || storage.value === 'undefined') {
      return { success: false, data: null }
    } else {
      const data = JSON.parse(storage.value || '')
      return { success: true, data }
    }
  } catch (error) {
    console.error(error)
    return { success: false, data: null }
  }
}
export const removeClientStorage = async () => {
  try {
    await Preferences.remove({ key: 'client.store' })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
// end client storage