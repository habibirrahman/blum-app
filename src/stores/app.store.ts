import { defineStore } from 'pinia'
import { getAppStorage, setAccessStorage, setAppStorage } from '@/plugins/preferences.plugin'
import type { Branch, Session, User } from '@/lib/types'
import axios from 'axios'
import { useSessionStore } from './session.store'
import { useClientStore } from './client.store'

export interface AppStateSchema {
  network_status: NetworkStatus
  account: User | null
  running_sessions: Session[]
  branches: Branch[]
}

export interface ResponseSchema {
  success: boolean
  data?: any
  message?: string
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
  state: (): AppStateSchema => ({
    network_status: { connected: false, connection_type: 'none' },
    account: null,
    running_sessions: [],
    branches: []
  }),
  getters: {},
  actions: {
    resetAppStore() {
      const { resetSessionStore } = useSessionStore()
      const { resetClientStore } = useClientStore()
      resetSessionStore()
      resetClientStore()

      this.account = null
      this.running_sessions = []
      this.branches = []
      this.syncAppStore()
    },
    async generateAppStore(): Promise<ResponseSchema> {
      return getAppStorage().then(({ success, data }) => {
        if (!success) {
          return { success: false, data: null }
        }
        const storage = data as AppStateSchema
        this.network_status = storage.network_status
        this.account = storage.account
        this.running_sessions = storage.running_sessions
        this.branches = storage.branches
        return { success: true, data }
      })
    },
    async syncAppStore(): Promise<ResponseSchema> {
      const data: AppStateSchema = {
        network_status: this.network_status,
        account: this.account,
        running_sessions: this.running_sessions,
        branches: this.branches
      }
      const { success } = await setAppStorage(data)
      return { success }
    },
    //
    setNetworkStatus(networkStatus: NetworkStatus) {
      this.network_status = networkStatus
    },
    //
    async getAccount(): Promise<ResponseSchema> {
      if (!this.network_status.connected) {
        return this.generateAppStore()
      }
      return axios
        .get('/api/v1/current_user')
        .then(async ({ data }) => {
          this.account = data
          this.syncAppStore()
          return { success: true, data, message: 'You have signed in' }
        })
        .catch(async ({ response }) => {
          if (response?.status === 401) {
            this.resetAppStore()
          }
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async signin({ email, password }: SigninSchema): Promise<ResponseSchema> {
      return axios
        .post('/signin', { email, password })
        .then(async ({ data }) => {
          await setAccessStorage(data)
          this.account = data.user
          this.syncAppStore()
          return { success: true, message: 'Successfully signed in' }
        })
        .catch(({ response }) => {
          return { success: false, message: response?.data?.error }
        })
    },
    async signout(): Promise<ResponseSchema> {
      const { status } = await axios.delete('/signin')
      if (status !== 200) return { success: false }
      this.resetAppStore()
      return { success: true }
    },
    async getRunningSessions(): Promise<ResponseSchema> {
      const { network_status } = useAppStore()
      if (!network_status.connected) {
        return { success: true, data: this.running_sessions }
      }

      return axios
        .get(`/api/v1/current_user/running_sessions?outcome=targets`)
        .then(async ({ data }) => {
          this.running_sessions = data
          this.syncAppStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getBranches(): Promise<ResponseSchema> {
      if (!this.account?.center_enable_branch) {
        this.branches = []
        return { success: true, data: [] }
      }
      const { network_status } = useAppStore()
      if (!network_status.connected) {
        return { success: true, data: this.branches }
      }

      return axios
        .get(`/api/v1/branches?sort=name_asc`)
        .then(async ({ data }) => {
          this.branches = data.branches
          // this.branches_count = data.total_count
          this.syncAppStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    }
  }
})
