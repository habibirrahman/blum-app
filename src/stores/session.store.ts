import { defineStore } from 'pinia'
import type { Session, Comment, Measurement, User, Client } from '@/lib/types'
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

export type SessionCommentFilter = '' | 'general' | 'assessment' | 'target' | 'mine'
interface UpdateMeasurementParams {
  id: Measurement['id']
  measurement: Measurement
}
export interface UpdateMeasurementResultsParams {
  id: Measurement['id']
  results: Measurement['results']
}
export interface UpdateMeasurementMarkProbingParams {
  id: Measurement['id']
  visible: Measurement['visible']
  marked_as: Measurement['marked_as']
}
export interface CreateSessionCommentParams {
  session_id?: Session['id']
  client_id?: Client['id']
  type: 'general' | 'assessment'
  session_comment?: {
    user_id: User['id']
    body: Comment['body']
  }
  assessment?: {
    session_id: Session['id']
    antecedent: Comment['antecedent']
    behavior: Comment['behavior']
    consequence: Comment['consequence']
    type: Comment['type']
  }
}
export interface UpdateSessionCommentParams {
  client_id?: Client['id']
  comment_id: Comment['id']
  type: 'general' | 'assessment'
  session_comment?: {
    body: Comment['body']
  }
  assessment?: {
    antecedent: Comment['antecedent']
    behavior: Comment['behavior']
    consequence: Comment['consequence']
  }
}
export interface DeleteSessionCommentParams {
  client_id?: Client['id']
  comment_id: Comment['id']
  type: 'general' | 'assessment'
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
    async getSession({ slug }: { slug: Session['slug'] }) {
      return axios
        .get(`/api/v1/sessions/${slug}`)
        .then(async ({ data }) => {
          this.session = data
          await this.getSessionMeasurements({ id: data.id })
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getSessionComments({ id, filter }: { id: Session['id']; filter?: SessionCommentFilter }) {
      if (!id) return { success: false, data: null, message: '' }
      const params = filter ? `?filter_by=${filter}` : ''
      return axios
        .get(`/api/v1/sessions/${id}/comments${params}`)
        .then(async ({ data }) => {
          this.session_comments = data
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getSessionMeasurements({ id }: { id: Session['id'] }) {
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
    async updateMeasurement({ id, measurement }: UpdateMeasurementParams) {
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
    async updateMeasurementResults({ id, results }: UpdateMeasurementResultsParams) {
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
    async updateMeasurementMarkProbing({
      id,
      visible,
      marked_as
    }: UpdateMeasurementMarkProbingParams) {
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
    },
    async createSessionComment({
      client_id,
      session_id,
      type,
      session_comment,
      assessment
    }: CreateSessionCommentParams) {
      if (type === 'general') {
        return axios
          .post(`/api/v1/sessions/${session_id}/session_comments`, { session_comment })
          .then(async ({ data }) => {
            this.session_comments = [...this.session_comments, data]
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }
      if (type === 'assessment') {
        return axios
          .post(`/api/v1/clients/${client_id}/assessments`, { assessment })
          .then(async ({ data }) => {
            this.session_comments = [...this.session_comments, data]
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }
      return { success: false, data: null, message: '' }
    },
    async updateSessionComment({
      client_id,
      comment_id,
      type,
      session_comment,
      assessment
    }: UpdateSessionCommentParams) {
      if (type === 'general') {
        return axios
          .patch(`/api/v1/session_comments/${comment_id}`, { session_comment })
          .then(async ({ data }) => {
            const idx = this.session_comments.findIndex((i) => i.id === comment_id)
            this.session_comments[idx] = data
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }
      if (type === 'assessment') {
        return axios
          .patch(`/api/v1/clients/${client_id}/assessments/${comment_id}`, { assessment })
          .then(async ({ data }) => {
            const idx = this.session_comments.findIndex((i) => i.id === comment_id)
            this.session_comments[idx] = data
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }
      return { success: false, data: null, message: '' }
    },
    async deleteSessionComment({ client_id, comment_id, type }: DeleteSessionCommentParams) {
      if (type === 'general') {
        return axios
          .delete(`/api/v1/session_comments/${comment_id}`)
          .then(async ({ data }) => {
            this.session_comments = this.session_comments.filter((i) => i.id !== comment_id)
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }
      if (type === 'assessment') {
        return axios
          .delete(`/api/v1/clients/${client_id}/assessments/${comment_id}`)
          .then(async ({ data }) => {
            this.session_comments = this.session_comments.filter((i) => i.id !== comment_id)
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }
      return { success: false, data: null, message: '' }
    }
  }
})
