import { Preferences } from '@capacitor/preferences'

export interface SetAccountProps {
  access: string
  email: string
}
export const setAccount = async ({ access, email }: SetAccountProps) => {
  try {
    await Preferences.set({ key: 'access', value: access })
    await Preferences.set({ key: 'email', value: email })
    return { succces: true }
  } catch (error) {
    console.error(error)
    return { succces: false }
  }
}

export const getAccount = async () => {
  try {
    const access = await Preferences.get({ key: 'access' })
    const email = await Preferences.get({ key: 'email' })
    if (!access.value && !email.value) {
      return { success: false, data: null }
    }
    return { success: true, data: { access: access.value, email: email.value } }
  } catch (error) {
    console.error(error)
    return { success: false, data: null }
  }
}

export const removeAccount = async () => {
  try {
    await Preferences.remove({ key: 'access' })
    await Preferences.remove({ key: 'email' })
    return { succces: true }
  } catch (error) {
    console.error(error)
    return { succces: false }
  }
}
