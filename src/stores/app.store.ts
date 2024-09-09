import { defineStore } from 'pinia'
import {
  removeAcccoutStorage,
  removeAccessStorage,
  setAcccoutStorage,
  setAccessStorage
} from '@/plugins/preferences.plugin'
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
    async setNetworkStatus(networkStatus: NetworkStatus) {
      this.network_status = networkStatus
    },
    async getAccount() {
      return axios
        .get('/api/v1/current_user')
        .then(async ({ data }) => {
          await setAcccoutStorage({ user: data })
          this.user = data
          return { success: true, data, message: 'You have signed in' }
        })
        .catch(async ({ response }) => {
          if (response.status === 401) await removeAcccoutStorage()
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async signin({ email, password }: SigninSchema) {
      return axios
        .post('/signin', { email, password })
        .then(async ({ data }) => {
          await setAccessStorage(data)
          await setAcccoutStorage({ user: data.user })
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
      await removeAcccoutStorage()
      await removeAccessStorage()
      this.user = null
      return { success: true }
    }
  }
})
