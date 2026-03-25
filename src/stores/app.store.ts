import { defineStore } from 'pinia'
import { getAppStorage, setAccessStorage, setAppStorage } from '@/plugins/preferences.plugin'
import type { Branch, Session, Target, User } from '@/lib/types'
import axios from 'axios'
import { useSessionStore } from './session.store'
import { useClientStore } from './client.store'

export interface AppStateSchema {
  network_status: NetworkStatus
  account: User | null
  running_sessions: Session[]
  branches: Branch[]
  center_targets: Target[]
  total_center_targets: number
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
  device: {
    device_type: string // mobile or desktop
    app_type: string // browser or mobile_app
  }
}

export const useAppStore = defineStore('app', {
  state: (): AppStateSchema => ({
    network_status: { connected: false, connection_type: 'none' },
    account: null,
    running_sessions: [],
    branches: [],
    center_targets: [],
    total_center_targets: 0
  }),
  getters: {},
  actions: {
    resetAppStore() {
      const sessionStore = useSessionStore()
      const clientStore = useClientStore()
      sessionStore.resetSessionStore()
      clientStore.resetClientStore()

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
        branches: this.branches,
        center_targets: this.center_targets,
        total_center_targets: this.total_center_targets
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
          console.log(response)
          if (response?.status === 401) {
            this.resetAppStore()
          }
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async signin({ email, password, device }: SigninSchema): Promise<ResponseSchema> {
      return axios
        .post('/signin', { email, password, device })
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
      if (!this.network_status.connected) {
        // return { success: true, data: this.running_sessions }
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
      if (!this.network_status.connected) {
        // return { success: true, data: this.branches }
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
    },
    async getTargets({ params }: { params?: string }): Promise<ResponseSchema> {
      if (!this.network_status.connected) {
        // return {
        //   success: true,
        //   data: { targets: this.targets, total_count: this.targets_count }
        // }
      }

      return axios
        .get(`/api/v1/targets${params}`)
        .then(async ({ data }) => {
          this.center_targets = data.targets
          this.total_center_targets = data.total_count
          this.syncAppStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getTarget({
      id,
      plain = false
    }: {
      id?: Target['id']
      plain?: boolean
    }): Promise<ResponseSchema> {
      if (!this.network_status.connected && !plain) {
        // return { success: true, data: this.target }
      }

      return axios
        .get(`/api/v1/targets/${id}`)
        .then(async ({ data }) => {
          if (plain) {
            return { success: true, data }
          }
          this.syncAppStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getCurriculums({ params }: { params?: string }): Promise<ResponseSchema> {
      if (!this.network_status.connected) {
        // return {
        //   success: true,
        //   data: { curriculums: this.curriculums, total_count: this.curriculums_count }
        // }
      }

      return axios
        .get(`/api/v1/curriculums${params}`)
        .then(async ({ data }) => {
          return { success: true, data: data.curriculums }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },

    async actionGet({ url, options }: { url: string; options?: any }): Promise<ResponseSchema> {
      if (!this.network_status.connected) {
        // return { success: true, data: this.target }
      }

      return axios
        .get(url, options)
        .then(async ({ data }) => {
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async actionPost({ url, params }: { url: string; params?: unknown }): Promise<ResponseSchema> {
      if (!this.network_status.connected) {
        // return { success: true, data: this.target }
      }

      return axios
        .post(url, params)
        .then(async ({ data }) => {
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    }
  }
})
