import { defineStore } from 'pinia'
import axios from 'axios'
import type { ActionRecommendation, Client, Session, Target } from '@/lib/types'
import { useAppStore, type ResponseSchema } from './app.store'
import { getClientStorage, setClientStorage } from '@/plugins/preferences.plugin'
import { getErrorMessage, onlyUniqueId } from '@/lib/func'

export interface ClientStateSchema {
  client: Client | null
  upcoming_sessions: Session[]
  upcoming_sessions_count: number
  draft_sessions: Session[]
  draft_sessions_count: number
  past_sessions: Session[]
  past_sessions_count: number
  target: Target | null
  targets: Target[]
  targets_count: number
  clients: Client[]
  clients_count: number
  client_target_job: any
}

export const useClientStore = defineStore('client', {
  state: (): ClientStateSchema => ({
    client: null,
    upcoming_sessions: [],
    upcoming_sessions_count: 0,
    draft_sessions: [],
    draft_sessions_count: 0,
    past_sessions: [],
    past_sessions_count: 0,
    target: null,
    targets: [],
    targets_count: 0,
    clients: [],
    clients_count: 0,
    client_target_job: null
  }),
  getters: {},
  actions: {
    resetClientStore() {
      this.client = null
      this.upcoming_sessions = []
      this.upcoming_sessions_count = 0
      this.draft_sessions = []
      this.draft_sessions_count = 0
      this.past_sessions = []
      this.past_sessions_count = 0
      this.target = null
      this.targets = []
      this.targets_count = 0
      this.clients = []
      this.clients_count = 0
      this.syncClientStore()
    },
    async generateClientStore(): Promise<ResponseSchema> {
      return getClientStorage().then(({ success, data }) => {
        if (!success) {
          return { success: false, data: null }
        }
        const storage = data as ClientStateSchema
        this.client = storage.client || null
        this.upcoming_sessions = storage.upcoming_sessions || []
        this.upcoming_sessions_count = storage.upcoming_sessions_count || 0
        this.draft_sessions = storage.draft_sessions || []
        this.draft_sessions_count = storage.draft_sessions_count || 0
        this.past_sessions = storage.past_sessions || []
        this.past_sessions_count = storage.past_sessions_count || 0
        this.target = storage.target || null
        this.targets = storage.targets || []
        this.targets_count = storage.targets_count || 0
        this.clients = storage.clients || []
        this.clients_count = storage.clients_count || 0
        return { success: true, data }
      })
    },
    async syncClientStore(): Promise<ResponseSchema> {
      const data: ClientStateSchema = {
        client: this.client,
        upcoming_sessions: this.upcoming_sessions,
        upcoming_sessions_count: this.upcoming_sessions_count,
        draft_sessions: this.draft_sessions,
        draft_sessions_count: this.draft_sessions_count,
        past_sessions: this.past_sessions,
        past_sessions_count: this.past_sessions_count,
        target: this.target,
        targets: this.targets,
        targets_count: this.targets_count,
        clients: this.clients,
        clients_count: this.clients_count,
        client_target_job: this.client_target_job
      }
      const { success } = await setClientStorage(data)
      return { success }
    },
    //
    setClient(data: Client) {
      this.client = data
      const idx = this.clients.findIndex((i) => i.id === data.id)
      if (idx > -1) this.clients[idx] = data
      this.syncClientStore()
    },
    //
    async getClient({ id }: { id: Client['id'] }): Promise<ResponseSchema> {
      const data = this.clients.find((i) => i.id === id)
      if (data) {
        this.setClient(data)
      }

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return { success: true, data: this.client }
      }

      return axios
        .get(`/api/v1/clients/${id}`)
        .then(async ({ data }) => {
          this.setClient(data)
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getClientUpcomingSessions({ id }: { id: Client['id'] }): Promise<ResponseSchema> {
      if (!id) return { success: false, data: null }
      this.upcoming_sessions = this.client?.upcoming_sessions || []

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return {
        //   success: true,
        //   data: { sessions: this.upcoming_sessions, total_count: this.upcoming_sessions_count }
        // }
      }

      return axios
        .get(
          `/api/v1/sessions/draft_sessions?client_id=${id}&upcoming=weekly&sort=earliest_schedule&page=1&per_page=5&outcome=targets`
        )
        .then(async ({ data }) => {
          this.upcoming_sessions = data.sessions
          this.upcoming_sessions_count = data.total_count
          const client: Client = {
            ...this.client,
            upcoming_sessions: [...data.sessions, ...(this.client?.upcoming_sessions || [])].filter(
              onlyUniqueId
            )
          }
          this.setClient(client)
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getClientDraftSessions({
      id,
      params
    }: {
      id: Client['id']
      params: string
    }): Promise<ResponseSchema> {
      if (!id) return { success: false, data: null }
      this.draft_sessions = this.client?.draft_sessions || []

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return {
        //   success: true,
        //   data: { sessions: this.draft_sessions, total_count: this.draft_sessions_count }
        // }
      }

      return axios
        .get(`/api/v1/clients/${id}/sessions${params}&outcome=targets`)
        .then(async ({ data }) => {
          this.draft_sessions = data.sessions
          this.draft_sessions_count = data.total_count
          const client: Client = {
            ...this.client,
            draft_sessions: [...data.sessions, ...(this.client?.draft_sessions || [])].filter(
              onlyUniqueId
            )
          }
          this.setClient(client)
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getClientPastSessions({
      id,
      params
    }: {
      id: Client['id']
      params: string
    }): Promise<ResponseSchema> {
      if (!id) return { success: false, data: null }
      this.past_sessions = this.client?.past_sessions || []

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return {
        //   success: true,
        //   data: { sessions: this.past_sessions, total_count: this.past_sessions_count }
        // }
      }

      return axios
        .get(`/api/v1/clients/${id}/sessions${params}&status=completed,cancelled&outcome=targets`)
        .then(async ({ data }) => {
          this.past_sessions = data.sessions
          this.past_sessions_count = data.total_count
          const client: Client = {
            ...this.client,
            past_sessions: [...data.sessions, ...(this.client?.past_sessions || [])].filter(
              onlyUniqueId
            )
          }
          this.setClient(client)
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getClients({ params }: { params?: string }): Promise<ResponseSchema> {
      const app = useAppStore()
      if (!app.network_status.connected) {
        // return {
        //   success: true,
        //   data: { clients: this.clients, total_clients: this.clients_count }
        // }
      }

      return axios
        .get(`/api/v1/clients${params}`)
        .then(async ({ data }) => {
          this.clients = data.clients
          this.clients_count = data.total_clients
          this.syncClientStore()
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
      const app = useAppStore()
      if (!app.network_status.connected && !plain) {
        // return { success: true, data: this.target }
      }

      return axios
        .get(`/api/v1/targets/${id}`)
        .then(async ({ data }) => {
          if (plain) {
            return { success: true, data }
          }
          this.target = data
          this.syncClientStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getTargets({ params }: { params?: string }): Promise<ResponseSchema> {
      const app = useAppStore()
      if (!app.network_status.connected) {
        // return {
        //   success: true,
        //   data: { targets: this.targets, total_count: this.targets_count }
        // }
      }

      return axios
        .get(`/api/v1/targets${params}`)
        .then(async ({ data }) => {
          this.targets = data.targets
          this.targets_count = data.total_count
          this.syncClientStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async createBulkTarget({
      data
    }: {
      data: {
        client_id: Client['id']
        target_ids: string
      }
    }): Promise<ResponseSchema> {
      return axios
        .post(`/api/v1/clients/${data.client_id}/bulk_create_targets`, {
          target_ids: data.target_ids
        })
        .then(async ({ data: response }) => {
          this.checkTargetJob({ data: { client_id: data.client_id, job_id: response.job_id } })
          return { success: true, data: response }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    /**
     * 10 target
     * 5 - offline (timeout) tidak call API checkTargetJob
     * akibat nya
     * 1. job selalu in_progress
     * 2. user tidak bisa add target lagi
     * expectasi nya
     * 1. job berhenti -> failed karena error timeout
     */
    async checkTargetJob({
      data
    }: {
      data: {
        client_id: Client['id']
        job_id: string
      }
    }): Promise<ResponseSchema> {
      const clientId = this.client?.id
      if (clientId !== data.client_id) return { success: false, data: null }

      return axios
        .get(`/api/v1/clients/${data.client_id}/check_duplicate_targets_job/${data.job_id}`)
        .then(async (response) => {
          if (!response.data.job) return { success: false, data: null }
          this.client_target_job = response.data.job
          const jobStatus = response.data.job.status
          if (jobStatus === 'in_progress' || jobStatus === 'pending') {
            setTimeout(() => {
              this.checkTargetJob({ data })
            }, 5000)
          }
          if (jobStatus === 'completed') {
            const createdTargets = response.data.targets.filter(
              (target: Target) => !target.group_id
            )
            this.targets = createdTargets
            this.targets_count = createdTargets.length
            this.syncClientStore()
          }
          return { success: true, data }
        })
        .catch((error) => {
          /**
           * 1. timeout
           * this.client_target_job = null
           * -> in_progress
           * change status -> close the banner
           * failed: toast
           */
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          if (message === 'Network Error') {
            this.client_target_job = null
            return { success: false, data: null, message }
          }
          return { success: false, data: null, message }
        })
    },
    async cancelTargetJob({
      data
    }: {
      data: {
        job_id: string
      }
    }): Promise<ResponseSchema> {
      return axios
        .patch(`/api/v1/cancel_duplicate_targets_job/${data.job_id}`)
        .then(async ({ data }) => {
          this.client_target_job = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },

    async updateTarget({
      id,
      data
    }: {
      id: Target['id']
      data: Partial<Target>
    }): Promise<ResponseSchema> {
      return axios
        .patch(`/api/v1/targets/${id}`, data)
        .then(async ({ data }) => {
          this.target = data
          this.syncClientStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },

    async createActionRecommendation({
      data
    }: {
      data: ActionRecommendation
    }): Promise<ResponseSchema> {
      return axios
        .post(`/api/v1/action_recommendations`, {
          action_recommendation: data
        })
        .then(async ({ data }) => {
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },

    async updateActionRecommendation({
      id,
      data
    }: {
      id: ActionRecommendation['id']
      data: Partial<ActionRecommendation>
    }): Promise<ResponseSchema> {
      return axios
        .patch(`/api/v1/action_recommendations/${id}`, {
          action_recommendation: data
        })
        .then(async ({ data }) => {
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    }
  }
})
