import type { User } from '@/lib/types'
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

interface SetAccountStorageProps {
  user: User
}
export const setAcccoutStorage = async ({ user }: SetAccountStorageProps) => {
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
    const account = await Preferences.get({ key: 'account' })
    console.log('account', account)
    if (!account.value || account.value === 'undefined') {
      return { success: false, data: null }
    } else {
      const data = {
        account: JSON.parse(account.value || '')
      }
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
