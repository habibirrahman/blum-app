import { defineStore } from 'pinia'
import type { Session, Comment, Measurement } from '@/lib/types'
import axios from 'axios'

interface StateSchema {
  session: Session | null
  session_comments: Comment[]
  session_measurements: Measurement[]
  sessions: Session[]
  sessions_count: number
  upcoming_sessions: Session[]
  upcoming_sessions_count: number
}

export const useSessionStore = defineStore('session', {
  state: (): StateSchema => ({
    session: null,
    session_comments: [],
    session_measurements: [],
    sessions: [],
    sessions_count: 0,
    upcoming_sessions: [],
    upcoming_sessions_count: 0
  }),
  getters: {},
  actions: {
    async getSession({ slug }: { slug?: string }) {
      this.session = null
      return axios
        .get(`/api/v1/sessions/${slug}`)
        .then(async ({ data }) => {
          this.session = data
          await this.getSessionComments({ id: data.id })
          await this.getSessionMeasurements({ id: data.id })
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, message: response.data.error }
        })
    },
    async getSessionComments({ id }: { id?: string }) {
      this.session_comments = []
      return axios
        .get(`/api/v1/sessions/${id}/comments?filter_by=general`)
        .then(async ({ data }) => {
          this.session_comments = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, message: response.data.error }
        })
    },
    async getSessionMeasurements({ id }: { id?: string }) {
      this.session_measurements = []
      return axios
        .get(`/api/v1/sessions/${id}/measurements`)
        .then(async ({ data }) => {
          this.session_measurements = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, message: response.data.error }
        })
    },
    async getSessions({ params }: { params?: string }) {
      this.sessions = []
      this.sessions_count = 0
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
      this.upcoming_sessions = []
      this.upcoming_sessions_count = 0
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
