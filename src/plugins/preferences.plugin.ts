import type { AppStateSchema } from '@/stores/app.store'
import type { ClientStateSchema } from '@/stores/client.store'
import type { SessionStateSchema } from '@/stores/session.store'
import { Preferences } from '@capacitor/preferences'

interface SetAccessStorageProps {
  access: string
  csrf: string
}
export const setAccessStorage = async ({ access, csrf }: SetAccessStorageProps) => {
  try {
    await Preferences.set({ key: 'access', value: access })
    await Preferences.set({ key: 'csrf', value: csrf })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
export const getAccessStorage = async () => {
  try {
    const access = await Preferences.get({ key: 'access' })
    const csrf = await Preferences.get({ key: 'csrf' })
    if (
      !access.value ||
      access.value === 'undefined' ||
      !csrf.value ||
      csrf.value === 'undefined'
    ) {
      return { success: false, data: null }
    } else {
      const data = {
        access: access.value || '',
        csrf: csrf.value || ''
      }
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
