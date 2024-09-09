import type { User } from '@/lib/types'
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

export const setAcccoutStorage = async ({ user }: { user: User }) => {
  try {
    await Preferences.set({ key: 'account', value: JSON.stringify(user) })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
export const getAcccoutStorage = async () => {
  try {
    const storage = await Preferences.get({ key: 'account' })
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
export const removeAcccoutStorage = async () => {
  try {
    await Preferences.remove({ key: 'account' })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}

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