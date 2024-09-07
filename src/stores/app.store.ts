import { defineStore } from 'pinia'
import { removeAccountStorage, setAccountStorage } from '@/plugins/preferences.plugin'
import type { User } from '@/lib/types'
import axios from 'axios'

interface StateSchema {
  user: User | null
  network_status: NetworkStatus
}

export interface NetworkStatus {
  connected: boolean
  connection_type: 'wifi' | 'cellular' | 'none' | 'unknown'
}
interface SigninSchema {
  email: User['email']
  password: string
}

export const useAppStore = defineStore('app', {
  state: (): StateSchema => ({
    user: null,
    network_status: { connected: false, connection_type: 'none' }
  }),
  getters: {},
  actions: {
    async getAccount() {
      return axios
        .get('/api/v1/current_user')
        .then(({ data }) => {
          this.user = data
          return { success: true, data, message: 'You have signed in' }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async signin({ email, password }: SigninSchema) {
      return axios
        .post('/signin', { email, password })
        .then(async ({ data }) => {
          const { success } = await setAccountStorage(data)
          if (!success) return { success: false }
          this.user = data.user
          return { success: true, message: 'Successfully signed in' }
        })
        .catch(({ response }) => {
          return { success: false, message: response?.data?.error }
        })
    },
    async signout() {
      const { status } = await axios.delete('/signin')
      if (status !== 200) return { success: false }
      const { success } = await removeAccountStorage()
      if (!success) return { success: false }
      this.user = null
      return { success: true }
    }
  }
})
