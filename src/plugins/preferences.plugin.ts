import { Preferences } from '@capacitor/preferences'

export interface SetAccountStorageProps {
  access: string
  csrf: string
}

export const setAccountStorage = async ({ access, csrf }: SetAccountStorageProps) => {
  try {
    await Preferences.set({ key: 'access', value: access })
    await Preferences.set({ key: 'csrf', value: csrf })
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
        csrf: csrf.value || '',
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
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false }
  }
}
