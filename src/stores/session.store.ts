import { defineStore } from 'pinia'
import axios, { isAxiosError } from 'axios'
import {
  getStorage,
  setStorage,
  setSessionFullStore,
  getSessionFullStore,
  flushSessionActivities
} from '@/plugins/preferences.plugin'
import { useAppStore, type ResponseSchema } from './app.store'
import { getErrorMessage, getRandomString, onlyUniqueId } from '@/lib/func'
import { Preferences } from '@capacitor/preferences'

import type {
  Session,
  Comment,
  Measurement,
  User,
  Client,
  ActionRecommendation,
  Target
} from '@/lib/types'

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
  timestamp?: number
  retryCount?: number
  lastError?: string
  lastRetryAt?: number
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
  //
  _autoSyncInitialized?: boolean // Track auto-sync setup
  _syncDebounceTimeout?: ReturnType<typeof setTimeout> | undefined // For debounced sync
  _periodicCheckInterval?: ReturnType<typeof setInterval> | undefined // For periodic check
  // In-memory activities buffer (ditulis ke storage secara batched, bukan setiap aksi)
  _activitiesBuffer?: AddSessionActivity[]
  _activitiesFlushTimeout?: ReturnType<typeof setTimeout> | undefined
  _activitiesFlushInterval?: ReturnType<typeof setInterval> | undefined
}

export type SessionCommentFilter = '' | 'general' | 'assessment' | 'target' | 'mine'
export interface CreateSessionParams {
  clientId: Client['id']
}
export interface CreateMeasurementParams {
  id: Session['id']
  targetId: Target['id']
  params: {
    measurement: Partial<Measurement>
  }
}
export interface AddMultipleTargetSessionParams {
  id: Session['id']
  params: {
    target_ids: Target['id'][]
  }
}
export interface AdvanceMaintenanceSessionParams {
  id: Session['id']
  params: {
    target_ids: Target['id'][]
  }
}
export interface UpdateMeasurementParams {
  id: Measurement['id']
  params: {
    measurement: Partial<Measurement>
  }
  dataResult: Partial<Measurement>
  isComment?: boolean
}
export interface ResolveAllMeasurementsParams {
  params: {
    id: Measurement['id']
    results: Measurement['results']
  }[]
}
export interface UpdateMeasurementResultsParams {
  id: Measurement['id']
  params: { measurement: Measurement }
  dataResult: Measurement
  lastData: Measurement
}
export interface UpdateMeasurementMarkProbingParams {
  id: Measurement['id']
  params: {
    visible: Measurement['visible']
    marked_as: Measurement['marked_as']
  }
}
export interface CreateSessionCommentParams {
  sessionId?: Session['id']
  clientId?: Client['id']
  type: 'general' | 'assessment'
  params: {
    session_comment?: {
      user_id: User['id']
      body: Comment['body']
      images?: Comment['images']
    }
    assessment?: {
      session_id: Session['id']
      antecedent: Comment['antecedent']
      behavior: Comment['behavior']
      consequence: Comment['consequence']
      type: Comment['type']
      images?: Comment['images']
    }
  }
  dataResult: Comment
}
export interface UpdateSessionCommentParams {
  clientId?: Client['id']
  commentId: Comment['id']
  type: 'general' | 'assessment'
  params: {
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
  dataResult: Comment
}
export interface DeleteSessionCommentParams {
  clientId?: Client['id']
  commentId: Comment['id']
  type: 'general' | 'assessment'
}
export interface DuplicateImagesToClientDocumentParams {
  clientId: Client['id']
  params: {
    session_id: Session['id']
    session_slug: Session['slug']
    documents: any[]
  }
}

export interface AddSessionActivity {
  action_label: string
  recordable: 'Session' | 'Measurement' | 'Comment' | 'Network' | 'App'
  recordable_id?: number
  api?: string
  params?: any
  notes?: string
  timestamp: string // new Date().toISOString()
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
    pending_progress: [],
    //
    _autoSyncInitialized: false,
    _syncDebounceTimeout: undefined,
    _periodicCheckInterval: undefined,
    _activitiesBuffer: [],
    _activitiesFlushTimeout: undefined,
    _activitiesFlushInterval: undefined
  }),
  getters: {
    // Getter untuk monitoring
    pendingSyncStats(): {
      total: number
      byType: Record<string, number>
      hasMaxRetries: boolean
    } {
      const stats: Record<string, number> = {}

      this.pending_progress.forEach((item) => {
        stats[item.name] = (stats[item.name] || 0) + 1
      })

      return {
        total: this.pending_progress.length,
        byType: stats,
        hasMaxRetries: this.pending_progress.some((i) => (i.retryCount || 0) > 5)
      }
    }
  },
  actions: {
    // ========================================
    // INTERNAL FUNCTIONS
    // ========================================

    resetSessionStore() {
      this.clearAllMeasurementBackups()
      this.clearSessionActivities()

      // Bersihkan interval sebelum reset agar tidak ada interval lama yang menumpuk
      if (this._periodicCheckInterval !== undefined) {
        clearInterval(this._periodicCheckInterval)
        this._periodicCheckInterval = undefined
      }
      if (this._syncDebounceTimeout !== undefined) {
        clearTimeout(this._syncDebounceTimeout)
        this._syncDebounceTimeout = undefined
      }

      this.session = null
      this.session_comments = []
      this.session_measurements = []
      this.session_recommendations = []
      this.upcoming_sessions = []
      this.upcoming_sessions_count = 0
      this.sessions = []
      this.sessions_count = 0
      this.pending_progress = []
      this._autoSyncInitialized = false
      this._activitiesBuffer = []
      if (this._activitiesFlushTimeout !== undefined) {
        clearTimeout(this._activitiesFlushTimeout)
        this._activitiesFlushTimeout = undefined
      }
      if (this._activitiesFlushInterval !== undefined) {
        clearInterval(this._activitiesFlushInterval)
        this._activitiesFlushInterval = undefined
      }
      this.syncSessionStoreNow()
    },

    async generateSessionStore(): Promise<ResponseSchema> {
      try {
        // Coba baca dari single-key baru terlebih dahulu
        const fullStore = await getSessionFullStore()

        if (fullStore.success && fullStore.data) {
          const storage = fullStore.data
          this.session = storage.session || null
          this.session_comments = storage.session_comments || []
          this.session_measurements = storage.session_measurements || []
          this.session_recommendations = []
          this.upcoming_sessions = storage.upcoming_sessions || []
          this.upcoming_sessions_count = storage.upcoming_sessions_count || 0
          this.sessions = storage.sessions || []
          this.sessions_count = storage.sessions_count || 0
          this.pending_progress = storage.pending_progress || []
          return { success: true, data: storage }
        }

        // Fallback: baca dari 9 key lama (migrasi dari versi sebelumnya)
        const arr = [
          { key: 'session.session-store' },
          { key: 'session_comments.session-store' },
          { key: 'session_measurements.session-store' },
          { key: 'session_recommendations.session-store' },
          { key: 'upcoming_sessions.session-store' },
          { key: 'upcoming_sessions_count.session-store' },
          { key: 'sessions.session-store' },
          { key: 'sessions_count.session-store' },
          { key: 'pending_progress.session-store' }
        ]
        const [ses, sesCom, sesMea, , upcSes, upcSesCou, sess, sessCou, penPro] = await Promise.all(
          arr.map((a) => getStorage(a.key))
        )

        this.session = ses.data || null
        this.session_comments = sesCom.data || []
        this.session_measurements = sesMea.data || []
        this.session_recommendations = []
        this.upcoming_sessions = upcSes.data || []
        this.upcoming_sessions_count = upcSesCou.data || 0
        this.sessions = sess.data || []
        this.sessions_count = sessCou.data || 0
        this.pending_progress = penPro.data || []

        // Migrasikan ke format baru setelah berhasil baca
        await this.syncSessionStoreNow()

        return {
          success: true,
          data: {
            session: this.session,
            session_comments: this.session_comments,
            session_measurements: this.session_measurements,
            upcoming_sessions: this.upcoming_sessions,
            upcoming_sessions_count: this.upcoming_sessions_count,
            sessions: this.sessions,
            sessions_count: this.sessions_count,
            pending_progress: this.pending_progress
          }
        }
      } catch (error) {
        console.error(error)
        return { success: false, data: null }
      }
    },

    /**
     * Sync session store ke storage.
     * Menggunakan debounce 1.5 detik: banyak perubahan beruntun hanya menghasilkan 1x write.
     * Untuk kebutuhan immediate write (mis. endSession), gunakan syncSessionStoreNow().
     */
    syncSessionStore(): Promise<ResponseSchema> {
      // Batalkan write yang sedang menunggu
      if (this._syncDebounceTimeout !== undefined) {
        clearTimeout(this._syncDebounceTimeout)
      }

      return new Promise((resolve) => {
        this._syncDebounceTimeout = setTimeout(async () => {
          this._syncDebounceTimeout = undefined
          const result = await this.syncSessionStoreNow()
          resolve(result)
        }, 1500)
      })
    },

    /**
     * Immediate write ke storage, tanpa debounce.
     * Gunakan hanya untuk operasi kritis (endSession, resetSessionStore, dll).
     */
    async syncSessionStoreNow(): Promise<ResponseSchema> {
      try {
        if (this._syncDebounceTimeout !== undefined) {
          clearTimeout(this._syncDebounceTimeout)
          this._syncDebounceTimeout = undefined
        }

        const result = await setSessionFullStore({
          session: this.session,
          session_comments: this.session_comments,
          session_measurements: this.session_measurements,
          upcoming_sessions: this.upcoming_sessions,
          upcoming_sessions_count: this.upcoming_sessions_count,
          sessions: this.sessions,
          sessions_count: this.sessions_count,
          pending_progress: this.pending_progress
        })

        return result
      } catch (error) {
        console.error('[syncSessionStoreNow] Failed:', error)
        return { success: false }
      }
    },

    // Improved resolvePendingProgress
    async resolvePendingProgress(): Promise<ResponseSchema> {
      const app = useAppStore()

      // Early return jika offline
      if (!app.network_status.connected) {
        console.log('[resolvePendingProgress] Skipped - offline')
        return { success: false, message: 'Device is offline' }
      }

      // Skip jika tidak ada pending items
      if (this.pending_progress.length === 0) {
        return { success: true, message: 'No pending items' }
      }

      console.log(`[resolvePendingProgress] Processing ${this.pending_progress.length} items...`)

      const progress = [...this.pending_progress]
      const succeedIndexes: string[] = []
      const failedItems: Array<{ key: string; error: string }> = []

      for (const p of progress) {
        // Double check network status setiap iterasi
        if (!app.network_status.connected) {
          console.log('[resolvePendingProgress] Network lost during processing')
          break
        }

        // Skip jika sudah terlalu banyak retry
        if (p.retryCount && p.retryCount > 5) {
          console.warn(`[resolvePendingProgress] Skipping ${p.key} - max retry exceeded`)
          failedItems.push({ key: p.key, error: 'Max retry exceeded' })
          continue
        }

        try {
          let success = false

          if (p.name === 'update_measurement') {
            const result = await this.updateMeasurement(p.params as UpdateMeasurementParams)
            success = result.success
          } else if (p.name === 'update_measurement_result') {
            const result = await this.updateMeasurementResults(
              p.params as UpdateMeasurementResultsParams
            )
            success = result.success
          } else if (p.name === 'create_comment') {
            const result = await this.createSessionComment(p.params as CreateSessionCommentParams)
            success = result.success
          } else if (p.name === 'update_comment') {
            const result = await this.updateSessionComment(p.params as UpdateSessionCommentParams)
            success = result.success
          } else if (p.name === 'delete_comment') {
            const result = await this.deleteSessionComment(p.params as DeleteSessionCommentParams)
            success = result.success
          } else if (p.name === 'duplicate_images') {
            const result = await this.duplicateImagesToClientDocument(
              p.params as DuplicateImagesToClientDocumentParams
            )
            success = result.success
          }

          if (success) {
            succeedIndexes.push(p.key)
            console.log(`[resolvePendingProgress] ✓ ${p.key}`)
          } else {
            failedItems.push({ key: p.key, error: 'Operation returned success: false' })
            console.warn(`[resolvePendingProgress] ✗ ${p.key} - failed`)
          }
        } catch (error) {
          const errorMsg = isAxiosError(error)
            ? error.response?.data?.error || error.message
            : 'Unknown error'

          failedItems.push({ key: p.key, error: errorMsg })
          console.error(`[resolvePendingProgress] ✗ ${p.key} - error:`, errorMsg)
        }

        // Delay antar request untuk menghindari rate limit
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      // Update retry count untuk failed items
      const remainingProgress = progress
        .filter((i) => !succeedIndexes.includes(i.key))
        .map((item) => {
          const failed = failedItems.find((f) => f.key === item.key)
          if (failed) {
            return {
              ...item,
              retryCount: (item.retryCount || 0) + 1,
              lastError: failed.error,
              lastRetryAt: Date.now()
            }
          }
          return item
        })

      this.pending_progress = remainingProgress
      this.syncSessionStore()

      // Log hasil
      const summary = {
        total: progress.length,
        succeeded: succeedIndexes.length,
        failed: failedItems.length,
        remaining: remainingProgress.length
      }
      console.log('[resolvePendingProgress] Summary:', summary)

      return {
        success: true,
        message: `Synced ${succeedIndexes.length}/${progress.length} items`,
        data: summary
      }
    },

    // ========================================
    // MEASUREMENT BACKUP FUNCTIONS
    // ========================================

    // Helper untuk local backup
    async saveLocalBackup(
      id: number,
      data: any,
      status: 'synced' | 'pending' = 'synced'
    ): Promise<void> {
      try {
        await setStorage({
          key: `measurement_backup_${id}`,
          value: JSON.stringify({
            data,
            status,
            timestamp: Date.now(),
            version: data.updated_at || Date.now()
          })
        })
      } catch (error) {
        console.error('[saveLocalBackup] Failed:', error)
      }
    },

    // Restore dari backup
    async restoreFromBackup(id: number): Promise<any> {
      try {
        const result = await getStorage(`measurement_backup_${id}`)

        if (!result.data) return null

        const backup = typeof result.data === 'string' ? JSON.parse(result.data) : result.data

        const currentMeasurement = this.session_measurements?.find((m) => m.id === id)

        // Konversi backup.version ke number (bisa string ISO atau number timestamp)
        const backupVersion =
          typeof backup.version === 'string' ? new Date(backup.version).getTime() : backup.version

        // Konversi currentMeasurement.updated_at ke number (selalu string ISO)
        const currentVersion = currentMeasurement?.updated_at
          ? new Date(currentMeasurement.updated_at).getTime()
          : 0

        // Return backup jika lebih baru atau current data tidak ada
        if (!currentMeasurement || backupVersion > currentVersion) {
          console.log('[restoreFromBackup] Restored from backup:', backup.timestamp)
          return backup
        }

        return null
      } catch (error) {
        console.error('[restoreFromBackup] Failed:', error)
        return null
      }
    },

    // Setup auto-sync
    setupAutoSync(): () => void {
      const app = useAppStore()

      // Prevent multiple setup
      if (this._autoSyncInitialized) {
        console.log('[setupAutoSync] Already initialized')
        return () => {
          if (this._periodicCheckInterval) {
            clearInterval(this._periodicCheckInterval)
            this._periodicCheckInterval = undefined
          }
        }
      }

      console.log('[setupAutoSync] Initializing auto-sync...')

      // Watch network status changes (Vue 3 watch dalam Pinia action)
      // Note: Ini akan di-handle di component level

      // Periodic sync setiap 30 detik
      this._periodicCheckInterval = setInterval(async () => {
        if (app.network_status.connected && this.pending_progress.length > 0) {
          console.log('[setupAutoSync] Periodic sync triggered')
          await this.resolvePendingProgress()
        }
      }, 30000) // 30 seconds

      this._autoSyncInitialized = true
      console.log('[setupAutoSync] Auto-sync initialized')

      return () => {
        if (this._periodicCheckInterval) {
          clearInterval(this._periodicCheckInterval)
          this._periodicCheckInterval = undefined
        }
      }
    },

    // Manual trigger sync dengan debounce
    triggerSync(immediate = false): void {
      if (this._syncDebounceTimeout) {
        clearTimeout(this._syncDebounceTimeout)
        this._syncDebounceTimeout = undefined
      }

      if (immediate) {
        this.resolvePendingProgress()
        return
      }

      this._syncDebounceTimeout = setTimeout(() => {
        this.resolvePendingProgress()
      }, 2000) as any
    },

    // ========================================
    // CLEANUP MEASUREMENT BACKUP FUNCTIONS
    // ========================================

    /**
     * Clear all measurement backups
     * Use: After session ends successfully
     */
    async clearAllMeasurementBackups(): Promise<{ success: boolean; count: number }> {
      try {
        const { keys } = await Preferences.keys()

        const backupKeys = keys.filter((key) => key.startsWith('measurement_backup_'))

        console.log(`[clearAllMeasurementBackups] Clearing ${backupKeys.length} backup(s)`)

        for (const key of backupKeys) {
          await Preferences.remove({ key })
        }

        return { success: true, count: backupKeys.length }
      } catch (error) {
        console.error('[clearAllMeasurementBackups] Failed:', error)
        return { success: false, count: 0 }
      }
    },

    /**
     * Clear backups for specific session measurements
     * Use: After session ends successfully
     */
    async clearSessionMeasurementBackups(
      measurementIds: number[]
    ): Promise<{ success: boolean; count: number }> {
      try {
        console.log(`[clearSessionMeasurementBackups] Clearing ${measurementIds.length} backup(s)`)

        for (const id of measurementIds) {
          const key = `measurement_backup_${id}`
          await Preferences.remove({ key })
        }

        return { success: true, count: measurementIds.length }
      } catch (error) {
        console.error('[clearSessionMeasurementBackups] Failed:', error)
        return { success: false, count: 0 }
      }
    },

    /**
     * Clear old backups (older than specified days)
     * Use: Periodic maintenance to prevent storage bloat
     */
    async clearOldBackups(olderThanDays: number = 7): Promise<{ success: boolean; count: number }> {
      try {
        const { keys } = await Preferences.keys()

        const backupKeys = keys.filter((key) => key.startsWith('measurement_backup_'))
        const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000

        let removedCount = 0

        for (const key of backupKeys) {
          const { value } = await Preferences.get({ key })
          if (value) {
            const backup = JSON.parse(value)
            if (backup.timestamp && backup.timestamp < cutoffTime) {
              await Preferences.remove({ key })
              removedCount++
            }
          }
        }

        console.log(`[clearOldBackups] Removed ${removedCount} old backup(s)`)
        return { success: true, count: removedCount }
      } catch (error) {
        console.error('[clearOldBackups] Failed:', error)
        return { success: false, count: 0 }
      }
    },

    /**
     * Clear all synced backups (status: 'synced')
     * Keep only pending backups
     */
    async clearSyncedBackups(): Promise<{ success: boolean; count: number }> {
      try {
        const { keys } = await Preferences.keys()

        const backupKeys = keys.filter((key) => key.startsWith('measurement_backup_'))
        let removedCount = 0

        for (const key of backupKeys) {
          const { value } = await Preferences.get({ key })
          if (value) {
            const backup = JSON.parse(value)
            if (backup.status === 'synced') {
              await Preferences.remove({ key })
              removedCount++
            }
          }
        }

        console.log(`[clearSyncedBackups] Removed ${removedCount} synced backup(s)`)
        return { success: true, count: removedCount }
      } catch (error) {
        console.error('[clearSyncedBackups] Failed:', error)
        return { success: false, count: 0 }
      }
    },

    async clearSessionActivities() {
      try {
        const { keys } = await Preferences.keys()

        // Filter keys yang mengandung 'session_activities_'
        const sessionActivityKeys = keys.filter((key) => key.startsWith('session_activities_'))

        if (sessionActivityKeys.length === 0) {
          console.log('[clearSessionActivities] No session activities found')
          return { success: true, count: 0 }
        }

        // Hapus semua session activities
        const deletePromises = sessionActivityKeys.map((key) => Preferences.remove({ key }))
        await Promise.all(deletePromises)

        console.log(
          `[clearSessionActivities] Cleared ${sessionActivityKeys.length} session activity key(s)`
        )

        return {
          success: true,
          count: sessionActivityKeys.length,
          keys: sessionActivityKeys
        }
      } catch (error) {
        console.error('[clearSessionActivities] Failed to clear session activities:', error)
        return {
          success: false,
          count: 0,
          error
        }
      }
    },

    // ========================================
    // MONITORING FUNCTIONS
    // ========================================

    /**
     * Get storage statistics
     * Use: For monitoring and debugging
     */
    async getStorageStats(): Promise<{
      totalBackups: number
      pendingBackups: number
      syncedBackups: number
      oldestBackup: number | null
      newestBackup: number | null
      totalSize: number // Approximate in bytes
    }> {
      try {
        const { keys } = await Preferences.keys()

        const backupKeys = keys.filter((key) => key.startsWith('measurement_backup_'))

        let pendingCount = 0
        let syncedCount = 0
        let oldestTimestamp: number | null = null
        let newestTimestamp: number | null = null
        let totalSize = 0

        for (const key of backupKeys) {
          const { value } = await Preferences.get({ key })
          if (value) {
            const backup = JSON.parse(value)

            // Count by status
            if (backup.status === 'pending') pendingCount++
            if (backup.status === 'synced') syncedCount++

            // Track timestamps
            if (backup.timestamp) {
              if (!oldestTimestamp || backup.timestamp < oldestTimestamp) {
                oldestTimestamp = backup.timestamp
              }
              if (!newestTimestamp || backup.timestamp > newestTimestamp) {
                newestTimestamp = backup.timestamp
              }
            }

            // Approximate size
            totalSize += value.length
          }
        }

        return {
          totalBackups: backupKeys.length,
          pendingBackups: pendingCount,
          syncedBackups: syncedCount,
          oldestBackup: oldestTimestamp,
          newestBackup: newestTimestamp,
          totalSize
        }
      } catch (error) {
        console.error('[getStorageStats] Failed:', error)
        return {
          totalBackups: 0,
          pendingBackups: 0,
          syncedBackups: 0,
          oldestBackup: null,
          newestBackup: null,
          totalSize: 0
        }
      }
    },

    /**
     * List all backup keys
     * Use: For debugging
     */
    async listAllBackups(): Promise<string[]> {
      try {
        const { keys } = await Preferences.keys()
        return keys.filter((key) => key.startsWith('measurement_backup_'))
      } catch (error) {
        console.error('[listAllBackups] Failed:', error)
        return []
      }
    },

    // ========================================
    // PERIODIC MAINTENANCE
    // ========================================

    /**
     * Run periodic maintenance
     * Call this on app startup or periodically
     */
    async runStorageMaintenance(): Promise<void> {
      console.log('[runStorageMaintenance] Starting maintenance...')

      // 1. Clear old backups (older than 7 days)
      const oldResult = await this.clearOldBackups(7)
      if (oldResult.count > 0) {
        console.log(`[runStorageMaintenance] Cleared ${oldResult.count} old backup(s)`)
      }

      // 2. Clear synced backups if too many
      const stats = await this.getStorageStats()
      if (stats.syncedBackups > 10) {
        const syncedResult = await this.clearSyncedBackups()
        console.log(`[runStorageMaintenance] Cleared ${syncedResult.count} synced backup(s)`)
      }

      // 3. Log final stats
      const finalStats = await this.getStorageStats()
      console.log('[runStorageMaintenance] Final stats:', finalStats)
    },

    // ========================================
    // SESSION FUNCTIONS
    // ========================================

    // SETTER Session and Measurement

    setSession(data: Session | null) {
      this.session = data
      const idx = this.sessions.findIndex((i) => i.id === data?.id)
      if (idx > -1 && data) {
        const arr = [...this.sessions]
        arr[idx] = data
        this.sessions = arr
      }
      this.syncSessionStore()
    },

    addSession(data: Session) {
      this.session = data
      this.sessions = [data, ...this.sessions]
      this.syncSessionStore()
    },

    setSessionMeasurement(payload: Measurement, isComment?: boolean) {
      if (!payload) return
      const idx = this.session_measurements.findIndex(
        (i) =>
          Number(i.id) === Number(payload.id) || Number(i.target_id) === Number(payload.target_id)
      )
      if (idx > -1) {
        if (isComment) {
          this.session_measurements[idx].comment = payload.comment
        } else {
          const local = this.session_measurements.find((i) => i.id === payload.id)
          if (local?.updated_at && payload.updated_at && local.updated_at > payload.updated_at) {
            // use local: do nothing
          } else {
            // use payload
            const arr = [...this.session_measurements]
            arr[idx] = payload
            this.session_measurements = arr
          }
        }
      }
      this.syncSessionStore()
    },

    // SETTER Session Comment

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
      if (idx > -1) {
        const arr = [...this.session_comments]
        arr[idx] = data
        this.session_comments = arr
      }
      this.syncSessionStore()
    },

    removeSessionComment(id: Comment['id']) {
      this.session_comments = this.session_comments.filter((i) => i.id !== id)
      this.syncSessionStore()
    },

    // ACTION

    async getSessions(payload?: { params?: string }) {
      try {
        const res = await axios.get(
          `/api/v1/sessions/draft_sessions${payload?.params}&outcome=targets`
        )

        this.sessions = res?.data?.sessions
        this.sessions_count = res?.data?.total_count
        this.syncSessionStore()

        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          return { success: false, message: error?.response?.data }
        }
        return { success: false }
      }
    },

    async getSession(payload: { slug: Session['slug'] }): Promise<ResponseSchema> {
      try {
        const res = await axios.get(`/api/v1/sessions/${payload.slug}`)

        this.setSession(res?.data)
        await this.getSessionMeasurements({ id: res?.data.id })

        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          return { success: false, message: error?.response?.data }
        }
        return { success: false }
      }
    },

    async getSessionMeasurements(payload: { id: Session['id'] }): Promise<ResponseSchema> {
      if (!payload.id) return { success: false, data: null }

      try {
        const res = await axios.get(`/api/v1/sessions/${payload.id}/measurements`)
        const incoming: Measurement[] = res?.data || []

        const latest = incoming.map((item: Measurement) => {
          const local = this.session_measurements.find((i) => i.id === item.id)
          if (local?.updated_at && item.updated_at && local.updated_at > item.updated_at) {
            return local
          }
          return item
        })
        this.session_measurements = latest

        const session: Session = {
          ...this.session,
          measurements: [...latest, ...(this.session?.measurements || [])].filter(onlyUniqueId)
        }
        this.setSession(session)

        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          return { success: false, message: error?.response?.data }
        }
        return { success: false }
      }
    },

    async getMeasurement(payload: { id: Measurement['id'] }): Promise<ResponseSchema> {
      if (!payload.id) return { success: false, data: null }

      try {
        const res = await axios.get(`/api/v1/measurements/${payload.id}`)

        this.setSessionMeasurement(res?.data)

        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          return { success: false, message: error?.response?.data }
        }
        return { success: false }
      }
    },

    async getMeasurementComment(payload: {
      measurement_id: Measurement['id']
    }): Promise<ResponseSchema> {
      if (!payload.measurement_id) return { success: false, data: null }

      try {
        const res = await axios.get(`/api/v1/measurements/${payload.measurement_id}`)

        this.setSessionMeasurement(res?.data, true)

        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          return { success: false, message: error?.response?.data }
        }
        return { success: false }
      }
    },

    async getUpcomingSessions() {
      try {
        const res = await axios.get(
          '/api/v1/sessions/draft_sessions?upcoming=daily&sort=earliest_schedule&page=1&per_page=5&outcome=targets'
        )

        this.upcoming_sessions = res?.data?.sessions
        this.upcoming_sessions_count = res?.data?.total_count
        this.syncSessionStore()

        return { success: true, data: res?.data }
      } catch (error) {
        if (isAxiosError(error)) {
          return { success: false, message: error?.response?.data }
        }
        return { success: false }
      }
    },

    async createSession(payload: CreateSessionParams) {
      try {
        const res = await axios.post(`/api/v1/clients/${payload.clientId}/sessions`, {
          session: { name: '', status: 'draft' }
        })

        this.addSession(res?.data)

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async updateSession(payload: { id: Session['id']; params: { session: Partial<Session> } }) {
      try {
        const res = await axios.patch(`/api/v1/sessions/${payload.id}`, payload.params)

        this.setSession(res?.data)

        return { success: true, data: res?.data, message: res?.data?.message || '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async deleteSession(payload: { id: Session['id'] }) {
      try {
        const res = await axios.delete(`/api/v1/sessions/${payload.id}`)

        return { success: true, data: res?.data, message: res?.data?.message || '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async startSession() {
      try {
        const res = await axios.patch(`/api/v1/sessions/${this.session?.id}`, {
          session: { status: 'ongoing' }
        })

        this.session = res?.data
        // reset offline mode data
        this.pending_progress = []
        this.syncSessionStore()

        return { success: true, data: res?.data, message: res?.data?.message || '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async resolveAllMeasurements() {
      try {
        const measurements = this.session_measurements || []
        const payload: ResolveAllMeasurementsParams = {
          params: measurements?.map((i) => {
            return { id: i.id, results: i.results }
          })
        }

        const res = await axios.patch(`/api/v1/measurements/resolve_all`, payload.params)

        this.syncSessionStore()

        return { success: true, data: res?.data, message: res?.data?.message || '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async pauseSession() {
      try {
        // Flush buffer aktivitas in-memory ke storage terlebih dahulu
        if (this.session?.id && this._activitiesBuffer && this._activitiesBuffer.length > 0) {
          await flushSessionActivities(this.session.id, this._activitiesBuffer)
        }

        // Baca activities dari buffer in-memory (lebih efisien, tidak perlu baca storage)
        const activities: AddSessionActivity[] = [...(this._activitiesBuffer || [])]

        const appStore = useAppStore()
        activities.push({
          action_label: `session_pause`,
          recordable: 'Session',
          recordable_id: this.session?.id,
          api: `PATCH /api/v1/sessions/${this.session?.id}`,
          params: { session: { status: 'paused', session_activities: 'SessionActivity[]' } }, // prevent infinite array
          notes: `[${appStore.account?.email}] Pause session`,
          timestamp: new Date().toISOString()
        })

        const res = await axios.patch(`/api/v1/sessions/${this.session?.id}`, {
          session: { status: 'paused', session_activities: activities }
        })

        this.session = res?.data

        // ✅ Clear backups setelah session berhasil di-pause
        const measurementIds = this.session_measurements.map((m) => Number(m.id)).filter((i) => i)
        const result = await this.clearSessionMeasurementBackups(measurementIds)

        if (result.success) {
          console.log(`[pauseSession] Cleared ${result.count} backup(s)`)
        }

        // ✅ Clear activities buffer in-memory dan storage
        this._activitiesBuffer = []
        if (this._activitiesFlushTimeout !== undefined) {
          clearTimeout(this._activitiesFlushTimeout)
          this._activitiesFlushTimeout = undefined
        }
        await this.clearSessionActivities()

        await this.syncSessionStoreNow()

        return { success: true, data: res?.data, message: res?.data?.message || '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async endSession() {
      try {
        // Flush buffer aktivitas in-memory ke storage terlebih dahulu
        if (this.session?.id && this._activitiesBuffer && this._activitiesBuffer.length > 0) {
          await flushSessionActivities(this.session.id, this._activitiesBuffer)
        }

        // Baca activities dari buffer in-memory (lebih efisien, tidak perlu baca storage)
        const activities: AddSessionActivity[] = [...(this._activitiesBuffer || [])]

        const appStore = useAppStore()
        activities.push({
          action_label: `session_end`,
          recordable: 'Session',
          recordable_id: this.session?.id,
          api: `PATCH /api/v1/sessions/${this.session?.id}`,
          params: { session: { status: 'completed', session_activities: 'SessionActivity[]' } }, // prevent infinite array
          notes: `[${appStore.account?.email}] End session`,
          timestamp: new Date().toISOString()
        })

        const res = await axios.patch(`/api/v1/sessions/${this.session?.id}`, {
          session: { status: 'completed', session_activities: activities }
        })

        this.session = res?.data

        // ✅ Clear backups setelah session berhasil di-end
        const measurementIds = this.session_measurements.map((m) => Number(m.id)).filter((i) => i)
        const result = await this.clearSessionMeasurementBackups(measurementIds)

        if (result.success) {
          console.log(`[endSession] Cleared ${result.count} backup(s)`)
        }

        // ✅ Clear activities buffer in-memory dan storage
        this._activitiesBuffer = []
        if (this._activitiesFlushTimeout !== undefined) {
          clearTimeout(this._activitiesFlushTimeout)
          this._activitiesFlushTimeout = undefined
        }
        await this.clearSessionActivities()

        await this.syncSessionStoreNow()

        return { success: true, data: res?.data, message: res?.data?.message || '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    // ===================================

    async getSessionRecommendations() {
      try {
        this.session_recommendations = []

        const res = await axios.get(
          `/api/v1/clients/${this.session?.client_id}/action_recommendations?page=1&per_page=999&session_id=${this.session?.id}`
        )

        this.session_recommendations = res?.data.action_recommendations

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async createMeasurement(payload: CreateMeasurementParams) {
      try {
        const res = await axios.post(
          `/api/v1/sessions/${payload.id}/targets/${payload.targetId}/measurements`,
          payload.params
        )

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async addMultipleTargetsSession(payload: AddMultipleTargetSessionParams) {
      try {
        const res = await axios.post(
          `/api/v1/sessions/${payload.id}/add_multiple_targets`,
          payload.params
        )

        this.setSession(res.data)

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async advanceMaintenanceSession(payload: AdvanceMaintenanceSessionParams) {
      try {
        const res = await axios.post(
          `/api/v1/sessions/${payload.id}/advance_maintenance`,
          payload.params
        )

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async updateMeasurement(payload: UpdateMeasurementParams) {
      try {
        const app = useAppStore()
        if (!app.network_status.connected) {
          console.log(payload.dataResult)
        }

        const res = await axios.patch(`/api/v1/measurements/${payload.id}`, payload.params)

        this.setSessionMeasurement(res?.data, payload.isComment)

        // record session activities
        const appStore = useAppStore()
        this.addSessionActivity({
          action_label: 'api_success',
          recordable: 'Measurement',
          recordable_id: payload.id,
          api: `PATCH /api/v1/measurements/${payload.id}`,
          params: payload.params,
          notes: `[${appStore.account?.email}] Success update measurement`,
          timestamp: new Date().toISOString()
        })

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)

          // record session activities
          const appStore = useAppStore()
          this.addSessionActivity({
            action_label: 'api_failed',
            recordable: 'Measurement',
            recordable_id: payload.id,
            api: `PATCH /api/v1/measurements/${payload.id}`,
            params: payload.params,
            notes: `[${appStore.account?.email}] ${message}`,
            timestamp: new Date().toISOString()
          })

          return { success: false, message }
        }
        return { success: false }
      }
    },

    async deleteMeasurement(payload: { id: Measurement['id']; params?: string }) {
      try {
        const res = await axios.delete(`/api/v1/measurements/${payload.id}${payload.params || ''}`)

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async updateMeasurementResults(
      payload: UpdateMeasurementResultsParams
    ): Promise<ResponseSchema> {
      // Simpan state sebelumnya untuk rollback
      const previousMeasurement = this.session_measurements?.find((m) => m.id === payload.id)
      try {
        const app = useAppStore()

        // handling for offline mode
        if (!app.network_status.connected) {
          const key = `update_measurement_${payload.id}`

          const index = this.pending_progress.findIndex((i) => i.key === key)
          if (index > -1) {
            this.pending_progress[index].params = payload
            this.pending_progress[index].timestamp = Date.now()
          } else {
            this.pending_progress.push({
              key,
              name: 'update_measurement_result', // ⚠️ Sesuaikan dengan resolvePendingProgress
              params: payload,
              timestamp: Date.now(),
              retryCount: 0
            })
          }

          // Tandai sebagai pending sync
          const measurementWithPending = {
            ...payload.dataResult,
            _pendingSync: true,
            _lastSyncAttempt: Date.now()
          }
          this.setSessionMeasurement(measurementWithPending)

          // Simpan ke local storage
          await this.saveLocalBackup(Number(payload.id), payload.dataResult, 'pending')

          // Sync session store
          this.syncSessionStore()

          return {
            success: true,
            data: measurementWithPending,
            message: 'Saved offline, will sync automatically'
          }
        }

        // Tambahkan retry logic dengan exponential backoff
        let lastError: any
        const maxRetries = 2
        const appStore = useAppStore()

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const { data: patchData } = await axios.patch(
              `/api/v1/measurements/${payload.id}/update_results`,
              payload.params,
              {
                timeout: attempt === 0 ? 5000 : 8000,
                headers: { 'X-Request-Attempt': attempt + 1 }
              }
            )

            // record session activities
            this.addSessionActivity({
              action_label: 'api_success',
              recordable: 'Measurement',
              recordable_id: payload.id,
              api: `PATCH /api/v1/measurements/${payload.id}`,
              params: payload.params,
              notes: `[${appStore.account?.email}] Success update measurement [attempt: ${attempt + 1}]`,
              timestamp: new Date().toISOString()
            })

            // ✅ Update state SETELAH API berhasil!
            // this.setSessionMeasurement(data)
            const { data: getData } = await this.getMeasurement({ id: patchData.id })

            // Handle new Data
            let newData = patchData
            if (getData) newData = getData

            // Hapus dari pending queue jika ada
            const queueIndex = this.pending_progress.findIndex(
              (i) => i.key === `update_measurement_${payload.id}`
            )
            if (queueIndex > -1) {
              this.pending_progress.splice(queueIndex, 1)
              this.syncSessionStore()
            }

            // Update local backup dengan status synced
            await this.saveLocalBackup(Number(payload.id), newData, 'synced')

            return { success: true, data: newData, message: '' }
          } catch (err) {
            lastError = err

            // Retry jika timeout dan belum max attempts
            if (attempt < maxRetries && isAxiosError(err) && err.code === 'ECONNABORTED') {
              // record session activities
              this.addSessionActivity({
                action_label: 'api_failed',
                recordable: 'Measurement',
                recordable_id: payload.id,
                api: `PATCH /api/v1/measurements/${payload.id}`,
                params: payload.params,
                notes: `[${appStore.account?.email}] Failed, timeout [attempt: ${attempt + 1}]`,
                timestamp: new Date().toISOString()
              })
              console.log(`[updateMeasurementResults] Retry ${attempt + 1}/${maxRetries}`)
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
              continue
            }

            throw lastError
          }
        }

        throw lastError
      } catch (error) {
        // Rollback ke state sebelumnya
        if (previousMeasurement) {
          this.setSessionMeasurement(previousMeasurement)
        }

        // Tambahkan ke pending queue untuk auto-retry
        const key = `update_measurement_${payload.id}`

        const index = this.pending_progress.findIndex((i) => i.key === key)
        if (index > -1) {
          this.pending_progress[index].params = payload
          this.pending_progress[index].retryCount =
            (this.pending_progress[index].retryCount || 0) + 1
          this.pending_progress[index].lastError = isAxiosError(error)
            ? error.response?.data?.error || error.message
            : 'Unknown error'
        } else {
          this.pending_progress.push({
            key,
            name: 'update_measurement_result',
            params: payload,
            timestamp: Date.now(),
            retryCount: 1,
            lastError: isAxiosError(error)
              ? error.response?.data?.error || error.message
              : 'Unknown error'
          })
        }

        // Sync ke session store
        this.syncSessionStore()

        // Simpan ke local backup dengan status pending
        await this.saveLocalBackup(Number(payload.id), payload.dataResult, 'pending')

        if (isAxiosError(error)) {
          if (error.code === 'ECONNABORTED') {
            // record session activities
            const appStore = useAppStore()
            this.addSessionActivity({
              action_label: 'api_failed',
              recordable: 'Measurement',
              recordable_id: payload.id,
              api: `PATCH /api/v1/measurements/${payload.id}`,
              params: payload.params,
              notes: `[${appStore.account?.email}] Slow connection. Data will be saved automatically.`,
              timestamp: new Date().toISOString()
            })

            return {
              success: false,
              message: 'Slow connection. Data will be saved automatically.',
              data: previousMeasurement || payload.lastData
            }
          }

          // Handle conflict (409)
          if (error.response?.status === 409) {
            // record session activities
            const appStore = useAppStore()
            this.addSessionActivity({
              action_label: 'api_failed',
              recordable: 'Measurement',
              recordable_id: payload.id,
              api: `PATCH /api/v1/measurements/${payload.id}`,
              params: payload.params,
              notes: `[${appStore.account?.email}] Data was changed by another user. Please refresh.`,
              timestamp: new Date().toISOString()
            })

            return {
              success: false,
              message: 'Data was changed by another user. Please refresh.',
              data: error.response.data || payload.lastData
            }
          }

          const message = getErrorMessage(error.response?.data?.error || error?.message)

          // record session activities
          const appStore = useAppStore()
          this.addSessionActivity({
            action_label: 'api_failed',
            recordable: 'Measurement',
            recordable_id: payload.id,
            api: `PATCH /api/v1/measurements/${payload.id}`,
            params: payload.params,
            notes: `[${appStore.account?.email}] ${message}`,
            timestamp: new Date().toISOString()
          })

          return { success: false, message, data: previousMeasurement || payload.lastData }
        }

        return {
          success: false,
          message: 'Failed to save. Will retry automatically.',
          data: previousMeasurement || payload.lastData
        }
      }
    },

    async setMeasurementProbing(payload: {
      id: number
      params: {
        probing: boolean
        member_id?: number
      }
    }): Promise<ResponseSchema> {
      try {
        const { data } = await axios.patch(
          `/api/v1/measurements/${payload.id}/set_probing`,
          payload.params
        )
        this.setSessionMeasurement(data)
        return { success: true, data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          return {
            success: false,
            data: null,
            message: error.response?.data?.error || 'Unable to update probing setting.'
          }
        }
        return { success: false, data: null, message: 'Unexpected error' }
      }
    },

    async updateMeasurementMarkProbing(
      payload: UpdateMeasurementMarkProbingParams
    ): Promise<ResponseSchema> {
      try {
        const res = await axios.patch(
          `/api/v1/measurements/${payload.id}/mark_probing`,
          payload.params
        )

        this.setSessionMeasurement(res?.data)

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    // ========================================
    // COMMENT FUNCTIONS
    // ========================================

    async getSessionComments(payload: {
      id: Session['id']
      filter?: SessionCommentFilter
    }): Promise<ResponseSchema> {
      if (!payload.id) return { success: false, data: null }
      this.session_comments = this.session?.comments || []

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return { success: true, data: this.session_comments }
      }

      try {
        const params = payload.filter ? `?filter_by=${payload.filter}` : ''
        const res = await axios.get(`/api/v1/sessions/${payload.id}/comments${params}`)

        this.session_comments = res?.data
        const session: Session = {
          ...this.session,
          comments: [...(res?.data || []), ...(this.session?.comments || [])].filter(onlyUniqueId)
        }
        this.setSession(session)

        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },
    // ayam

    async createSessionComment(payload: CreateSessionCommentParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        this.pending_progress.push({
          key: getRandomString('create_comment'),
          name: 'create_comment',
          params: payload,
          timestamp: Date.now(),
          retryCount: 0
        })
        this.addSessionComment(payload.dataResult, false)
        return { success: true, data: payload.dataResult }
      }

      if (payload.type === 'general') {
        try {
          const params = { session_comment: payload.params.session_comment }
          const res = await axios.post(
            `/api/v1/sessions/${payload.sessionId}/session_comments`,
            params,
            { headers: { 'X-Platform': 'mobile' } }
          )

          this.addSessionComment(res?.data, true)

          return { success: true, data: res?.data, message: '' }
        } catch (error) {
          if (isAxiosError(error)) {
            const message = getErrorMessage(error.response?.data?.error || error?.message)
            return { success: false, message }
          }
          return { success: false }
        }
      }

      if (payload.type === 'assessment') {
        try {
          const params = { assessment: payload.params.assessment }

          const res = await axios.post(`/api/v1/clients/${payload.clientId}/assessments`, params, {
            headers: { 'X-Platform': 'mobile' }
          })

          this.addSessionComment(res?.data, true)

          return { success: true, data: res?.data, message: '' }
        } catch (error) {
          if (isAxiosError(error)) {
            const message = getErrorMessage(error.response?.data?.error || error?.message)
            return { success: false, message }
          }
          return { success: false }
        }
      }

      return { success: false, data: null }
    },

    async updateSessionComment(payload: UpdateSessionCommentParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        if (typeof payload.commentId === 'number') {
          const key = `update_comment_${payload.dataResult.id}`

          const index = this.pending_progress.findIndex((i) => i.key === key)
          if (index > -1) {
            this.pending_progress[index].params = payload
            this.pending_progress[index].timestamp = Date.now()
          } else {
            this.pending_progress.push({
              key,
              name: 'update_comment',
              params: payload,
              timestamp: Date.now(),
              retryCount: 0
            })
          }
        } else {
          type CreateParams = CreateSessionCommentParams
          const idx = this.pending_progress.findIndex((i) => {
            return (i.params as CreateParams).dataResult.id === payload.commentId
          })
          if (idx > -1) {
            const newParams = { ...(this.pending_progress[idx].params as CreateParams) }
            newParams.params.session_comment = payload.params.session_comment
            newParams.params.assessment = payload.params.assessment
            newParams.dataResult = payload.dataResult

            this.pending_progress[idx].params = newParams
            this.pending_progress[idx].timestamp = Date.now()
          }
        }
        this.setSessionComment(payload.dataResult)
        return { success: true, data: payload.dataResult }
      }

      if (typeof payload.commentId === 'string') {
        this.setSessionComment(payload.dataResult)
        return { success: true, data: null }
      }

      if (payload.type === 'general') {
        try {
          const params = { session_comment: payload.params.session_comment }
          const res = await axios.patch(`/api/v1/session_comments/${payload.commentId}`, params)

          this.setSessionComment(res?.data)

          return { success: true, data: res?.data, message: '' }
        } catch (error) {
          if (isAxiosError(error)) {
            const message = getErrorMessage(error.response?.data?.error || error?.message)
            return { success: false, message }
          }
          return { success: false }
        }
      }

      if (payload.type === 'assessment') {
        try {
          const params = { assessment: payload.params.assessment }
          const res = await axios.patch(
            `/api/v1/clients/${payload.clientId}/assessments/${payload.commentId}`,
            params
          )

          this.setSessionComment(res?.data)

          return { success: true, data: res?.data, message: '' }
        } catch (error) {
          if (isAxiosError(error)) {
            const message = getErrorMessage(error.response?.data?.error || error?.message)
            return { success: false, message }
          }
          return { success: false }
        }
      }

      return { success: false, data: null }
    },

    async duplicateImagesToClientDocument(payload: DuplicateImagesToClientDocumentParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        this.pending_progress.push({
          key: `duplicate_images_${payload.params.session_id}`,
          name: 'duplicate_images',
          params: payload,
          timestamp: Date.now(),
          retryCount: 0
        })
        return { success: true, data: null }
      }

      try {
        const res = await axios.post(
          `/api/v1/clients/${payload.clientId}/duplicate_documents`,
          payload.params
        )
        return { success: true, data: res?.data, message: '' }
      } catch (error) {
        if (isAxiosError(error)) {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, message }
        }
        return { success: false }
      }
    },

    async deleteSessionComment(payload: DeleteSessionCommentParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        if (typeof payload.commentId === 'number') {
          const key = `delete_comment_${payload.commentId}`

          const index = this.pending_progress.findIndex((i) => i.key === key)
          if (index > -1) {
            this.pending_progress[index].params = payload
            this.pending_progress[index].timestamp = Date.now()
          } else {
            this.pending_progress.push({
              key,
              name: 'delete_comment',
              params: payload,
              timestamp: Date.now(),
              retryCount: 0
            })
          }
        } else {
          const arr = this.pending_progress.filter((i) => {
            return (i.params as CreateSessionCommentParams).dataResult.id !== payload.commentId
          })
          this.pending_progress = arr
        }
        this.removeSessionComment(payload.commentId)
        return { success: true }
      }

      if (typeof payload.commentId === 'string') {
        this.removeSessionComment(payload.commentId)
        return { success: true }
      }

      if (payload.type === 'general') {
        try {
          await axios.delete(`/api/v1/session_comments/${payload.commentId}`)

          this.removeSessionComment(payload.commentId)

          return { success: true, message: '' }
        } catch (error) {
          if (isAxiosError(error)) {
            const message = getErrorMessage(error.response?.data?.error || error?.message)
            return { success: false, message }
          }
          return { success: false }
        }
      }

      if (payload.type === 'assessment') {
        try {
          await axios.delete(`/api/v1/clients/${payload.clientId}/assessments/${payload.commentId}`)

          this.removeSessionComment(payload.commentId)

          return { success: true, message: '' }
        } catch (error) {
          if (isAxiosError(error)) {
            const message = getErrorMessage(error.response?.data?.error || error?.message)
            return { success: false, message }
          }
          return { success: false }
        }
      }

      return { success: false }
    },

    // ========================================
    // SESSION ACTIVITIES FUNCTIONS
    // ========================================

    /**
     * Tambah aktivitas ke in-memory buffer.
     * Buffer ditulis ke storage secara batched (setiap 10 aktivitas ATAU setiap 15 detik),
     * bukan setiap kali aktivitas ditambahkan — menghindari O(n²) read-modify-write.
     */
    async addSessionActivity(rawParams: AddSessionActivity): Promise<void> {
      if (!this.session?.id) return
      if (this.session?.status !== 'ongoing' && this.session?.status !== 'paused') return

      const appStore = useAppStore()
      const params = {
        ...rawParams,
        notes: `[${appStore.account?.email}] ${rawParams?.notes}`
      }

      // Inisialisasi buffer jika belum ada
      if (!this._activitiesBuffer) this._activitiesBuffer = []

      this._activitiesBuffer.push(params)

      // Flush segera kalau buffer sudah cukup besar (setiap 10 aktivitas)
      if (this._activitiesBuffer.length >= 10) {
        this._flushActivitiesBuffer()
        return
      }

      // Jadwalkan flush delayed (15 detik setelah aktivitas terakhir)
      if (this._activitiesFlushTimeout !== undefined) {
        clearTimeout(this._activitiesFlushTimeout)
      }
      this._activitiesFlushTimeout = setTimeout(() => {
        this._activitiesFlushTimeout = undefined
        this._flushActivitiesBuffer()
      }, 15000)
    },

    /**
     * Tulis buffer ke storage (tidak async di caller, jalan di background).
     * @internal
     */
    async _flushActivitiesBuffer(): Promise<void> {
      if (!this.session?.id) return
      if (!this._activitiesBuffer || this._activitiesBuffer.length === 0) return

      const sessionId = this.session.id
      const toFlush = [...this._activitiesBuffer]

      try {
        await flushSessionActivities(sessionId, toFlush)
      } catch (error) {
        console.error('[_flushActivitiesBuffer] Failed:', error)
      }
    }
  }
})
