import { defineStore } from 'pinia'
import type { Session } from '@/lib/types'
import axios from 'axios'

interface StateSchema {
  session: Session | null
  sessions: Session[]
  sessions_count: number
  upcoming_sessions: Session[]
  upcoming_sessions_count: number
}

export const useSessionStore = defineStore('session', {
  state: (): StateSchema => ({
    session: null,
    sessions: [],
    sessions_count: 0,
    upcoming_sessions: [],
    upcoming_sessions_count: 0
  }),
  getters: {},
  actions: {
    async getSessions({ params }: { params?: string }) {
      return axios
        .get(`/api/v1/sessions/draft_sessions${params}`)
        .then(async ({ data }) => {
          this.sessions = data.sessions
          this.sessions_count = data.total_count
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, message: response.data.error }
        })
    },
    async getUpcomingSessions() {
      return axios
        .get('/api/v1/sessions/draft_sessions?upcoming=true')
        .then(async ({ data }) => {
          this.upcoming_sessions = data.sessions
          this.upcoming_sessions_count = data.total_count
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, message: response.data.error }
        })
    }
  }
})
