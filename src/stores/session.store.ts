import { defineStore } from 'pinia'
import axios from 'axios'
import { getSessionStorage, setSessionStorage } from '@/plugins/preferences.plugin'
import { useAppStore, type ResponseSchema } from './app.store'
import { getErrorMessage, getRandomString, onlyUniqueId } from '@/lib/func'
import type { Session, Comment, Measurement, User, Client, ActionRecommendation } from '@/lib/types'

interface SessionPendingProgress {
  key: string
  name:
    | 'update_measurement'
    | 'update_measurement_result'
    | 'create_comment'
    | 'update_comment'
    | 'delete_comment'
    | 'duplicate_images'
  params:
    | UpdateMeasurementParams
    | UpdateMeasurementResultsParams
    | CreateSessionCommentParams
    | UpdateSessionCommentParams
    | DeleteSessionCommentParams
    | DuplicateImagesToClientDocumentParams
}

export interface SessionStateSchema {
  session: Session | null
  session_comments: Comment[]
  session_measurements: Measurement[]
  session_recommendations: ActionRecommendation[]
  upcoming_sessions: Session[]
  upcoming_sessions_count: number
  sessions: Session[]
  sessions_count: number
  pending_progress: SessionPendingProgress[]
}

export type SessionCommentFilter = '' | 'general' | 'assessment' | 'target' | 'mine'
export interface UpdateMeasurementParams {
  id: Measurement['id']
  measurement: Measurement
  data_result: Measurement
}

export interface ResolveAllMeasurementsParams {
  params: {
    id: Measurement['id']
    results: Measurement['results']
  }[]
}
export interface UpdateMeasurementResultsParams {
  id: Measurement['id']
  results: Measurement['results']
  data_result: Measurement
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
  images?: Comment['images']

  data_result: Comment
}
export interface UpdateSessionCommentParams {
  client_id?: Client['id']
  comment_id: Comment['id']
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
  data_result: Comment
}
export interface DeleteSessionCommentParams {
  client_id?: Client['id']
  comment_id: Comment['id']
  type: 'general' | 'assessment'
}

export interface DuplicateImagesToClientDocumentParams {
  client_id: Client['id']
  documents: any[]
  session_id: Session['id']
  session_slug: Session['slug']
}

export const useSessionStore = defineStore('session', {
  state: (): SessionStateSchema => ({
    session: null,
    session_comments: [],
    session_measurements: [],
    session_recommendations: [],
    upcoming_sessions: [],
    upcoming_sessions_count: 0,
    sessions: [],
    sessions_count: 0,
    // to handle offline mode in 1 active session
    pending_progress: []
  }),
  getters: {},
  actions: {
    resetSessionStore() {
      this.session = null
      this.session_comments = []
      this.session_measurements = []
      this.session_recommendations = []
      this.upcoming_sessions = []
      this.upcoming_sessions_count = 0
      this.sessions = []
      this.sessions_count = 0
      this.pending_progress = []
      this.syncSessionStore()
    },
    async generateSessionStore(): Promise<ResponseSchema> {
      return getSessionStorage().then(({ success, data }) => {
        if (!success) {
          return { success: false, data: null }
        }
        const storage = data as SessionStateSchema
        this.session = storage?.session || null
        this.session_comments = storage?.session_comments || []
        this.session_measurements = storage?.session_measurements || []
        this.session_recommendations = []
        this.upcoming_sessions = storage?.upcoming_sessions || []
        this.upcoming_sessions_count = storage?.upcoming_sessions_count || 0
        this.sessions = storage?.sessions || []
        this.sessions_count = storage?.sessions_count || 0
        this.pending_progress = storage?.pending_progress || []
        return { success: true, data }
      })
    },
    async syncSessionStore(): Promise<ResponseSchema> {
      const data: SessionStateSchema = {
        session: this.session,
        session_comments: this.session_comments,
        session_measurements: this.session_measurements,
        session_recommendations: [],
        upcoming_sessions: this.upcoming_sessions,
        upcoming_sessions_count: this.upcoming_sessions_count,
        sessions: this.sessions,
        sessions_count: this.sessions_count,
        pending_progress: this.pending_progress
      }
      const { success } = await setSessionStorage(data)
      return { success }
    },
    async resolvePendingProgress(): Promise<ResponseSchema> {
      const progress = [...this.pending_progress]
      const succeedIndexes: string[] = []
      for (const p of progress) {
        const app = useAppStore()
        if (!app.network_status.connected) continue

        if (p.name === 'update_measurement') {
          const { success } = await this.updateMeasurement(p.params as UpdateMeasurementParams)
          if (success) succeedIndexes.push(p.key)
        }
        if (p.name === 'update_measurement_result') {
          const { success } = await this.updateMeasurementResults(
            p.params as UpdateMeasurementResultsParams
          )
          if (success) succeedIndexes.push(p.key)
        }
        if (p.name === 'create_comment') {
          const { success } = await this.createSessionComment(
            p.params as CreateSessionCommentParams
          )
          if (success) succeedIndexes.push(p.key)
        }
        if (p.name === 'update_comment') {
          const { success } = await this.updateSessionComment(
            p.params as UpdateSessionCommentParams
          )
          if (success) succeedIndexes.push(p.key)
        }
        if (p.name === 'delete_comment') {
          const { success } = await this.deleteSessionComment(
            p.params as DeleteSessionCommentParams
          )
          if (success) succeedIndexes.push(p.key)
        }
        if (p.name === 'duplicate_images') {
          const { success } = await this.duplicateImagesToClientDocument(
            p.params as DuplicateImagesToClientDocumentParams
          )
          if (success) succeedIndexes.push(p.key)
        }
      }
      const arr = progress.filter((i) => !succeedIndexes.includes(i.key))
      this.pending_progress = [...arr]
      this.syncSessionStore()
      return { success: true }
    },

    setSession(data: Session) {
      this.session = data
      const idx = this.sessions.findIndex((i) => i.id === data.id)
      if (idx > -1) this.sessions[idx] = data
      this.syncSessionStore()
    },
    setSessionMeasurement(data: Measurement) {
      const idx = this.session_measurements.findIndex((i) => i.target?.id === data.target?.id)
      if (idx > -1) this.session_measurements[idx] = data
      this.syncSessionStore()
    },
    addSessionComment(data: Comment, check: boolean = false) {
      let arr = [...this.session_comments, data]
      if (check) {
        arr = arr.filter((i) => typeof i.id === 'number')
      }
      this.session_comments = arr
      this.syncSessionStore()
    },
    setSessionComment(data: Comment) {
      const idx = this.session_comments.findIndex((i) => i.id === data.id)
      if (idx > -1) this.session_comments[idx] = data
      this.syncSessionStore()
    },
    removeSessionComment(id: Comment['id']) {
      this.session_comments = this.session_comments.filter((i) => i.id !== id)
      this.syncSessionStore()
    },

    async getSession({ slug }: { slug: Session['slug'] }): Promise<ResponseSchema> {
      const data = this.sessions.find((i) => i.slug === slug)
      if (data) {
        this.session_measurements = data?.measurements || []
        this.setSession(data)
      }

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return { success: true, data: this.session }
      }

      return axios
        .get(`/api/v1/sessions/${slug}`)
        .then(async ({ data }) => {
          this.setSession(data)
          await this.getSessionMeasurements({ id: data.id })
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getSessionComments({
      id,
      filter
    }: {
      id: Session['id']
      filter?: SessionCommentFilter
    }): Promise<ResponseSchema> {
      if (!id) return { success: false, data: null }
      this.session_comments = this.session?.comments || []

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return { success: true, data: this.session_comments }
      }

      const params = filter ? `?filter_by=${filter}` : ''
      return axios
        .get(`/api/v1/sessions/${id}/comments${params}`)
        .then(async ({ data }) => {
          this.session_comments = data
          const session: Session = {
            ...this.session,
            comments: [...data, ...(this.session?.comments || [])].filter(onlyUniqueId)
          }
          this.setSession(session)
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getSessionMeasurements({ id }: { id: Session['id'] }): Promise<ResponseSchema> {
      if (!id) return { success: false, data: null }
      this.session_measurements = this.session?.measurements || []

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return { success: true, data: this.session_measurements }
      }

      return axios
        .get(`/api/v1/sessions/${id}/measurements`)
        .then(async ({ data }) => {
          this.session_measurements = data
          const session: Session = {
            ...this.session,
            measurements: [...data, ...(this.session?.measurements || [])].filter(onlyUniqueId)
          }
          this.setSession(session)
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getSessions({ params }: { params?: string }) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        // return {
        //   success: true,
        //   data: { sessions: this.sessions, total_count: this.sessions_count }
        // }
      }

      return axios
        .get(`/api/v1/sessions/draft_sessions${params}&outcome=targets`)
        .then(async ({ data }) => {
          this.sessions = data.sessions
          this.sessions_count = data.total_count
          this.syncSessionStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async getUpcomingSessions() {
      const app = useAppStore()
      if (!app.network_status.connected) {
        // return {
        //   success: true,
        //   data: { sessions: this.upcoming_sessions, total_count: this.upcoming_sessions_count }
        // }
      }

      return axios
        .get(
          '/api/v1/sessions/draft_sessions?upcoming=daily&sort=earliest_schedule&page=1&per_page=5&outcome=targets'
        )
        .then(async ({ data }) => {
          this.upcoming_sessions = data.sessions
          this.upcoming_sessions_count = data.total_count
          this.syncSessionStore()
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

          // reset offline mode data
          this.pending_progress = []

          this.syncSessionStore()
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },
    async resolveAllMeasurements({ params }: ResolveAllMeasurementsParams) {
      return axios
        .patch(`/api/v1/measurements/resolve_all`, params)
        .then(async ({ data }) => {
          console.log('resolve_all', data)

          // reset offline mode data
          // this.pending_progress = []

          this.syncSessionStore()
          return { success: true, data }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },
    async endSession() {
      const { getRunningSessions } = useAppStore()

      return axios
        .patch(`/api/v1/sessions/${this.session?.id}`, { session: { status: 'completed' } })
        .then(async ({ data }) => {
          await getRunningSessions()
          this.session = data
          this.syncSessionStore()
          return { success: true, data }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },

    async getSessionRecommendations() {
      this.session_recommendations = []
      return axios
        .get(
          `/api/v1/clients/${this.session?.client_id}/action_recommendations?page=1&per_page=999&session_id=${this.session?.id}`
        )
        .then(async ({ data }) => {
          this.session_recommendations = data.action_recommendations
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },

    async updateMeasurement({ id, measurement, data_result }: UpdateMeasurementParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        // this.pending_progress.push({
        //   name: 'update_measurement',
        //   params: { id, measurement, data_result }
        // })
        // this.setSessionMeasurement(data_result)
        // return { success: true, data: data_result }
        console.log(data_result)
      }

      return axios
        .patch(`/api/v1/measurements/${id}`, { measurement })
        .then(async ({ data }) => {
          this.setSessionMeasurement(data)
          return { success: true, data, message: '' }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },
    async updateMeasurementResults({
      id,
      results,
      data_result
    }: UpdateMeasurementResultsParams): Promise<ResponseSchema> {
      const app = useAppStore()
      if (!app.network_status.connected) {
        const key = `update_measurement_${data_result.id}`
        const newParams = { id, measurement: { results: data_result.results }, data_result }

        const index = this.pending_progress.findIndex((i) => i.key === key)
        if (index > -1) {
          this.pending_progress[index].params = newParams
        } else {
          this.pending_progress.push({ key, name: 'update_measurement', params: newParams })
        }

        this.setSessionMeasurement(data_result)
        return { success: true, data: data_result, message: '' }
      }

      return axios
        .patch(`/api/v1/measurements/${id}/update_results`, { results })
        .then(async ({ data }) => {
          this.setSessionMeasurement(data)
          return { success: true, data, message: '' }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },
    async updateMeasurementMarkProbing({
      id,
      visible,
      marked_as
    }: UpdateMeasurementMarkProbingParams): Promise<ResponseSchema> {
      return axios
        .patch(`/api/v1/measurements/${id}/mark_probing`, { visible, marked_as })
        .then(async ({ data }) => {
          this.setSessionMeasurement(data)
          return { success: true, data, message: '' }
        })
        .catch((error) => {
          console.log(error)
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },

    async createSessionComment({
      client_id,
      session_id,
      type,
      session_comment,
      assessment,
      data_result,
      images = []
    }: CreateSessionCommentParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        this.pending_progress.push({
          key: getRandomString('create_comment'),
          name: 'create_comment',
          params: { client_id, session_id, type, session_comment, assessment, data_result, images }
        })
        this.addSessionComment(data_result, false)
        return { success: true, data: data_result }
      }

      if (type === 'general') {
        const payload = {
          session_comment: {
            user_id: session_comment?.user_id,
            body: session_comment?.body,
            images: images
          }
        }

        return axios
          .post(`/api/v1/sessions/${session_id}/session_comments`, payload, {
            headers: {
              'X-Platform': 'mobile'
            }
          })
          .then(async ({ data }) => {
            this.addSessionComment(data, true)
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }

      if (type === 'assessment') {
        return axios
          .post(
            `/api/v1/clients/${client_id}/assessments`,
            {
              assessment: {
                ...assessment,
                images: images
              }
            },
            {
              headers: {
                'X-Platform': 'mobile'
              }
            }
          )
          .then(async ({ data }) => {
            this.addSessionComment(data, true)
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }

      return { success: false, data: null }
    },
    async updateSessionComment({
      client_id,
      comment_id,
      type,
      session_comment,
      assessment,
      data_result
    }: UpdateSessionCommentParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        if (typeof comment_id === 'number') {
          const key = `update_comment_${data_result.id}`
          const newParams = {
            client_id,
            comment_id,
            type,
            session_comment,
            assessment,
            data_result
          }

          const index = this.pending_progress.findIndex((i) => i.key === key)
          if (index > -1) {
            this.pending_progress[index].params = newParams
          } else {
            this.pending_progress.push({ key, name: 'update_comment', params: newParams })
          }
        } else {
          type CreateParams = CreateSessionCommentParams
          const idx = this.pending_progress.findIndex((i) => {
            return (i.params as CreateParams).data_result.id === comment_id
          })
          if (idx > -1) {
            const newParams = { ...(this.pending_progress[idx].params as CreateParams) }
            newParams.session_comment = session_comment as CreateParams['session_comment']
            newParams.assessment = assessment as CreateParams['assessment']
            newParams.data_result = data_result as CreateParams['data_result']

            this.pending_progress[idx].params = newParams
          }
        }
        this.setSessionComment(data_result)
        return { success: true, data: data_result }
      }

      if (typeof comment_id === 'string') {
        this.setSessionComment(data_result)
        return { success: true, data: null }
      }

      if (type === 'general') {
        return axios
          .patch(`/api/v1/session_comments/${comment_id}`, { session_comment })
          .then(async ({ data }) => {
            this.setSessionComment(data)
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
            this.setSessionComment(data)
            return { success: true, data }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }
      return { success: false, data: null }
    },

    async duplicateImagesToClientDocument({
      documents,
      client_id,
      session_id,
      session_slug
    }: DuplicateImagesToClientDocumentParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        this.pending_progress.push({
          key: `duplicate_images_${session_id}`,
          name: 'duplicate_images',
          params: { documents, client_id, session_id, session_slug }
        })
        return { success: true, data: null }
      }

      return axios
        .post(`/api/v1/clients/${client_id}/duplicate_documents`, {
          documents,
          session_id,
          session_slug
        })
        .then(async ({ data }) => {
          return { success: true, data }
        })
        .catch(({ response }) => {
          return { success: false, data: null, message: response?.data?.error }
        })
    },

    async deleteSessionComment({ client_id, comment_id, type }: DeleteSessionCommentParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        if (typeof comment_id === 'number') {
          const key = `delete_comment_${comment_id}`
          const newParams = { client_id, comment_id, type }

          const index = this.pending_progress.findIndex((i) => i.key === key)
          if (index > -1) {
            this.pending_progress[index].params = newParams
          } else {
            this.pending_progress.push({ key, name: 'delete_comment', params: newParams })
          }
        } else {
          const arr = this.pending_progress.filter((i) => {
            return (i.params as CreateSessionCommentParams).data_result.id !== comment_id
          })
          this.pending_progress = arr
        }
        this.removeSessionComment(comment_id)
        return { success: true }
      }

      if (typeof comment_id === 'string') {
        this.removeSessionComment(comment_id)
        return { success: true }
      }

      if (type === 'general') {
        return axios
          .delete(`/api/v1/session_comments/${comment_id}`)
          .then(async () => {
            this.removeSessionComment(comment_id)
            return { success: true }
          })
          .catch(({ response }) => {
            return { success: false, data: null, message: response?.data?.error }
          })
      }
      if (type === 'assessment') {
        return axios
          .delete(`/api/v1/clients/${client_id}/assessments/${comment_id}`)
          .then(async () => {
            this.removeSessionComment(comment_id)
            return { success: true }
          })
          .catch(({ response }) => {
            return { success: false, message: response?.data?.error }
          })
      }
      return { success: false }
    }
  }
})
