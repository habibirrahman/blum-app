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

interface MeasurementParams {
  id: Measurement['id']
  measurement: Measurement
}
export interface MeasurementResultsParams {
  id: Measurement['id']
  results: Measurement['results']
}
export interface MeasurementMarkProbingParams {
  id: Measurement['id']
  visible: Measurement['visible']
  marked_as: Measurement['marked_as']
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
      return axios
        .get(`/api/v1/sessions/${slug}`)
        .then(async ({ data }) => {
          this.session = data
          await this.getSessionComments({ id: data.id })
          await this.getSessionMeasurements({ id: data.id })
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getSessionComments({ id }: { id?: string }) {
      return axios
        .get(`/api/v1/sessions/${id}/comments?filter_by=general`)
        .then(async ({ data }) => {
          this.session_comments = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getSessionMeasurements({ id }: { id?: string }) {
      return axios
        .get(`/api/v1/sessions/${id}/measurements`)
        .then(async ({ data }) => {
          this.session_measurements = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getSessions({ params }: { params?: string }) {
      return axios
        .get(`/api/v1/sessions/draft_sessions${params}`)
        .then(async ({ data }) => {
          this.sessions = data.sessions
          this.sessions_count = data.total_count
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
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
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async startSession() {
      return axios
        .patch(`/api/v1/sessions/${this.session?.id}`, { session: { status: 'ongoing' } })
        .then(async ({ data }) => {
          this.session = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async updateMeasurement({ id, measurement }: MeasurementParams) {
      return axios
        .patch(`/api/v1/measurements/${id}`, { measurement })
        .then(async ({ data }) => {
          const idx = this.session_measurements.findIndex((i) => i.id === id)
          this.session_measurements[idx] = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async updateMeasurementResults({ id, results }: MeasurementResultsParams) {
      return axios
        .patch(`/api/v1/measurements/${id}/update_results`, { results })
        .then(async ({ data }) => {
          const idx = this.session_measurements.findIndex((i) => i.id === id)
          this.session_measurements[idx] = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async updateMeasurementMarkProbing({ id, visible, marked_as }: MeasurementMarkProbingParams) {
      return axios
        .patch(`/api/v1/measurements/${id}/mark_probing`, { visible, marked_as })
        .then(async ({ data }) => {
          const idx = this.session_measurements.findIndex((i) => i.id === id)
          this.session_measurements[idx] = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    }
  }
})
