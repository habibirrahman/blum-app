import { defineStore } from 'pinia'
import { getAppStorage, setAccessStorage, setAppStorage } from '@/plugins/preferences.plugin'
import type { Branch, Center, DeviceDetailsInput, Session, Target, User } from '@/lib/types'
import axios from '@/backend/axios'
import { isAxiosError, type AxiosRequestConfig } from 'axios'
import { useSessionStore } from './session.store'
import { useClientStore } from './client.store'
import { getErrorMessage } from '@/lib/func'

export interface AppStateSchema {
  networkStatus: NetworkStatus
  currentUser: User | null
  center: Center | null
  //
  runningSessions: Session[]
  branches: Branch[]
  centerTargets: Target[]
  totalCenterTargets: number
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
  email: string
  password: string
  device: {
    device_type: string // mobile or desktop
    app_type: string // browser or mobile_app
    device_id: string
    device_details: DeviceDetailsInput
  }
}

export const useAppStore = defineStore('app', {
  state: (): AppStateSchema => ({
    networkStatus: { connected: false, connection_type: 'none' },
    currentUser: null,
    center: null,
    //
    runningSessions: [],
    branches: [],
    centerTargets: [],
    totalCenterTargets: 0
  }),
  getters: {},
  actions: {
    resetAppStore() {
      const sessionStore = useSessionStore()
      const clientStore = useClientStore()
      sessionStore.resetSessionStore()
      clientStore.resetClientStore()

      this.currentUser = null
      this.center = null
      //
      this.runningSessions = []
      this.branches = []
      this.centerTargets = []
      this.totalCenterTargets = 0
      this.syncAppStore()
    },

    async generateAppStore(): Promise<ResponseSchema> {
      return getAppStorage().then(({ success, data }) => {
        if (!success) {
          return { success: false, data: null }
        }
        const storage = data as AppStateSchema

        this.networkStatus = storage.networkStatus
        this.currentUser = storage.currentUser
        this.center = storage.center

        return { success: true, data }
      })
    },

    async syncAppStore(): Promise<ResponseSchema> {
      const data: Partial<AppStateSchema> = {
        networkStatus: this.networkStatus,
        currentUser: this.currentUser,
        center: this.center
      }

      const { success } = await setAppStorage(data)
      return { success }
    },

    setNetworkStatus(networkStatus: NetworkStatus) {
      this.networkStatus = networkStatus
    },

    // === ACTION ===

    async getCurrentUser(): Promise<ResponseSchema> {
      if (!this.networkStatus.connected) {
        return this.generateAppStore()
      }

      try {
        const res = await axios.get('/api/v1/current_user')

        this.currentUser = res?.data
        await this.getCenter()
        this.syncAppStore()

        return { success: true, data: res?.data, message: 'You have signed in' }
      } catch (error) {
        if (isAxiosError(error)) {
          if (error.response?.status === 401) {
            this.resetAppStore()
          }

          return { success: false, message: 'You have signed out' }
        }
        return { success: false, message: 'Unexpected error' }
      }
    },

    async getCenter(): Promise<ResponseSchema> {
      if (!this.networkStatus.connected) {
        return this.generateAppStore()
      }

      try {
        const res = await axios.get('/api/v1/center')

        this.center = res?.data

        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          if (error.response?.status === 401) {
            this.resetAppStore()
          }

          const message = getErrorMessage(error?.response?.data)

          return {
            success: false,
            message: message || 'Unable to fetch current center from server'
          }
        }
        return { success: false, message: 'Unexpected error' }
      }
    },

    // === AUTHENTICATION ===

    async signin(payload: { params: SigninSchema }): Promise<ResponseSchema> {
      try {
        const res = await axios.post('/signin', payload.params)

        await setAccessStorage(res?.data)
        await this.getCurrentUser()

        return { success: true, message: 'You have signed in', data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error?.response?.data)
          return {
            success: false,
            message: message || 'Request failed',
            data: error?.response?.data
          }
        }
        return { success: false, message: 'Unexpected error', data: null }
      }
    },

    async signout(): Promise<ResponseSchema> {
      try {
        const res = await axios.delete('/signin')

        if (res?.status !== 200) return { success: false }

        this.resetAppStore()

        return { success: true, message: 'You have signed out' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error?.response?.data)
          return {
            success: false,
            message: message || 'Request failed'
          }
        }
        return { success: false, message: 'Unexpected error' }
      }
    },

    async signoutByDevice(payload: { deviceId: number }): Promise<ResponseSchema> {
      try {
        const res = await axios.delete(`/signout_by_device?device_id=${payload.deviceId}`)

        return { success: true, message: 'You have signed out', data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error?.response?.data)
          return {
            success: false,
            message: message || 'Request failed'
          }
        }
        return { success: false, message: 'Unexpected error' }
      }
    },

    // === OTHERS ===

    async getRunningSessions(): Promise<ResponseSchema> {
      if (!this.networkStatus.connected) {
        // return { success: true, data: this.runningSessions }
      }

      return axios
        .get(`/api/v1/current_user/runningSessions?outcome=targets`)
        .then(async ({ data }) => {
          this.runningSessions = data
          this.syncAppStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },

    async getBranches(): Promise<ResponseSchema> {
      if (!this.center?.enable_branch) {
        this.branches = []
        return { success: true, data: [] }
      }
      if (!this.networkStatus.connected) {
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
      if (!this.networkStatus.connected) {
        // return {
        //   success: true,
        //   data: { targets: this.targets, total_count: this.targets_count }
        // }
      }

      return axios
        .get(`/api/v1/targets${params}`)
        .then(async ({ data }) => {
          this.centerTargets = data.targets
          this.totalCenterTargets = data.total_count
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
      if (!this.networkStatus.connected && !plain) {
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
      if (!this.networkStatus.connected) {
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

    // === GENERAL ACTION ===

    async actionGet(payload: {
      url: string
      option?: AxiosRequestConfig<unknown>
    }): Promise<ResponseSchema> {
      if (!this.networkStatus.connected) {
        // return { success: true, data: this.target }
      }

      try {
        const res = await axios.get(payload.url, payload.option)

        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error?.response?.data)
          return {
            success: false,
            message: message || 'Request failed',
            data: null
          }
        }
        return { success: false, message: 'Unexpected error', data: null }
      }
    },

    async actionPost(payload: { url: string; params?: unknown }): Promise<ResponseSchema> {
      if (!this.networkStatus.connected) {
        // return { success: true, data: this.target }
      }

      try {
        const res = await axios.post(payload.url, payload.params)
        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error?.response?.data)
          return {
            success: false,
            message: message || 'Request failed',
            data: null
          }
        }
        return { success: false, message: 'Unexpected error', data: null }
      }
    }
  }
})
