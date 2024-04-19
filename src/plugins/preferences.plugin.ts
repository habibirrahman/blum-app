import type { User } from '@/lib/types'
import { Preferences } from '@capacitor/preferences'

export interface SetAccountStorageProps {
  access: string
  csrf: string
  user: User
}
export const setAccountStorage = async ({ access, csrf, user }: SetAccountStorageProps) => {
  try {
    await Preferences.set({ key: 'access', value: access })
    await Preferences.set({ key: 'csrf', value: csrf })
    await Preferences.set({ key: 'user', value: JSON.stringify(user) })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}

export const getAccountStorage = async () => {
  try {
    const access = await Preferences.get({ key: 'access' })
    const csrf = await Preferences.get({ key: 'csrf' })
    const user = await Preferences.get({ key: 'user' })
    if (
      !access.value ||
      access.value === 'undefined' ||
      !csrf.value ||
      csrf.value === 'undefined' ||
      !user.value ||
      user.value === 'undefined' 
    ) {
      return { success: false, data: null }
    } else {
      const data = {
        access: access.value || '',
        csrf: csrf.value || '',
        user: JSON.parse(user.value || '')
      }
      return { success: true, data }
    }
  } catch (error) {
    console.error(error)
    return { success: false, data: null }
  }
}

export const removeAccountStorage = async () => {
  try {
    await Preferences.remove({ key: 'access' })
    await Preferences.remove({ key: 'csrf' })
    await Preferences.remove({ key: 'user' })
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
