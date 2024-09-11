import { defineStore } from 'pinia'
import axios from 'axios'
import type { Client, Session, Target } from '@/lib/types'
import { useAppStore, type ResponseSchema } from './app.store'
import { getClientStorage, setClientStorage } from '@/plugins/preferences.plugin'
import { onlyUniqueId } from '@/lib/func'
import moment from 'moment'

export interface ClientStateSchema {
  client: Client | null
  upcoming_sessions: Session[]
  upcoming_sessions_count: number
  draft_sessions: Session[]
  draft_sessions_count: number
  past_sessions: Session[]
  past_sessions_count: number
  targets: Target[]
  targets_count: number
  clients: Client[]
  clients_count: number
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
    targets: [],
    targets_count: 0,
    clients: [],
    clients_count: 0
  }),
  getters: {},
  actions: {
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
        targets: this.targets,
        targets_count: this.targets_count,
        clients: this.clients,
        clients_count: this.clients_count
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

      const { network_status } = useAppStore()
      if (!network_status.connected) {
        return { success: true, data: this.client }
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

      const { network_status } = useAppStore()
      if (!network_status.connected) {
        return {
          success: true,
          data: { sessions: this.upcoming_sessions, total_count: this.upcoming_sessions_count }
        }
      }

      return axios
        .get(`/api/v1/sessions/draft_sessions?client_id=${id}&upcoming=weekly&page=1&per_page=5`)
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

      const { network_status } = useAppStore()
      if (!network_status.connected) {
        return {
          success: true,
          data: { sessions: this.draft_sessions, total_count: this.draft_sessions_count }
        }
      }

      return axios
        .get(`/api/v1/clients/${id}/sessions${params}`)
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

      const { network_status } = useAppStore()
      if (!network_status.connected) {
        return {
          success: true,
          data: { sessions: this.past_sessions, total_count: this.past_sessions_count }
        }
      }

      return axios
        .get(`/api/v1/clients/${id}/sessions${params}&status=completed,cancelled`)
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
      const { network_status } = useAppStore()
      if (!network_status.connected) {
        return {
          success: true,
          data: { clients: this.clients, total_clients: this.clients_count }
        }
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
    async getTargets({ params }: { params?: string }): Promise<ResponseSchema> {
      const { network_status } = useAppStore()
      if (!network_status.connected) {
        return {
          success: true,
          data: { targets: this.targets, total_count: this.targets_count }
        }
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
    }
  }
})
