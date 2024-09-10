import { defineStore } from 'pinia'
import axios from 'axios'
import type { Client } from '@/lib/types'
import { useAppStore, type ResponseSchema } from './app.store'
import { getClientStorage, setClientStorage } from '@/plugins/preferences.plugin'

export interface ClientStateSchema {
  client: Client | null
  clients: Client[]
  clients_count: number
}

export const useClientStore = defineStore('client', {
  state: (): ClientStateSchema => ({
    client: null,
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
        this.clients = storage.clients || []
        this.clients_count = storage.clients_count || 0
        return { success: true, data }
      })
    },
    async syncClientStore(): Promise<ResponseSchema> {
      const data: ClientStateSchema = {
        client: this.client,
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
    }
  }
})
