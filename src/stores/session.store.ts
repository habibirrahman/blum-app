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
  client_id: Client['id']
}
export interface CreateMeasurementParams {
  id: Measurement['id']
  target_id: Target['id']
  measurement: Measurement
}
export interface AddMultipleTargetSessionParams {
  id: Session['id']
  target_ids: Target['id'][]
}
export interface AdvanceMaintenanceSessionParams {
  id: Session['id']
  target_ids: Target['id'][]
}
export interface UpdateMeasurementParams {
  id: Measurement['id']
  measurement: Partial<Measurement>
  data_result: Partial<Measurement>
  //
  is_comment?: boolean
}
export interface ResolveAllMeasurementsParams {
  params: {
    id: Measurement['id']
    results: Measurement['results']
  }[]
}
export interface UpdateMeasurementResultsParams {
  id: Measurement['id']
  measurement: Measurement
  data_result: Measurement
  last_data: Measurement
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
    setSessionMeasurement(data: Measurement, is_comment?: boolean) {
      // by id, fallback use target.id
      const idx = this.session_measurements.findIndex(
        (i) => i.id === data.id || i.target?.id === data.target?.id
      )
      if (idx > -1) {
        if (is_comment) {
          this.session_measurements[idx].comment = data.comment
        } else {
          const local = this.session_measurements.find((i) => i.id === data.id)
          if (local?.updated_at && data.updated_at && local.updated_at > data.updated_at) {
            // use local: do nothing
          } else {
            // use data
            const arr = [...this.session_measurements]
            arr[idx] = data
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
    async getSessionMeasurements({ id }: { id: Session['id'] }): Promise<ResponseSchema> {
      if (!id) return { success: false, data: null }
      // this.session_measurements = this.session?.measurements || []

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return { success: true, data: this.session_measurements }
      }

      return axios
        .get(`/api/v1/sessions/${id}/measurements`)
        .then(async ({ data }) => {
          // Merge per-item berdasarkan `updated_at`, bukan full replace.
          // GET list ini bisa butuh waktu lama (koneksi lapangan), dan selama itu
          // updateMeasurementResults() bisa saja sudah menyimpan hasil yang lebih baru
          // lewat request terpisah (lihat setSessionMeasurement). Kalau di sini kita
          // langsung `this.session_measurements = data`, snapshot lama dari response ini
          // akan menimpa balik hasil yang sudah benar tersimpan -> "missing results".
          const incoming: Measurement[] = data || []
          this.session_measurements = incoming.map((item: Measurement) => {
            const local = this.session_measurements.find((i) => i.id === item.id)
            if (local?.updated_at && item.updated_at && local.updated_at > item.updated_at) {
              return local
            }
            return item
          })

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
    async getMeasurement({ id }: { id: Measurement['id'] }): Promise<ResponseSchema> {
      if (!id) return { success: false, data: null }

      const app = useAppStore()
      if (!app.network_status.connected) {
        // return { success: true, data: this.session_measurements }
      }

      return axios
        .get(`/api/v1/measurements/${id}`)
        .then(async ({ data }) => {
          this.setSessionMeasurement(data)
          // async
          // sering race condition
          /*
          // lebih baik pakai ini
          setState((prev) => {
            return { ...prev, ...data }
          })

          // ini sering race condition jika dipanggil bersamaan
          setState({...this.state, ...data})
          **/
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

    async createSession({ client_id }: CreateSessionParams) {
      return axios
        .post(`/api/v1/clients/${client_id}/sessions`, {
          session: { name: '', status: 'draft' }
        })
        .then((response) => {
          this.addSession(response.data)
          return { success: true, data: response.data, message: '' }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },

    async updateSession({ id, session }: { id: Session['id']; session: Partial<Session> }) {
      return axios
        .patch(`/api/v1/sessions/${id}`, { session })
        .then((response) => {
          this.setSession(response.data)
          return { success: true, data: response.data, message: response.data.message }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },

    async deleteSession({ id }: { id: Session['id'] }) {
      return axios
        .delete(`/api/v1/sessions/${id}`)
        .then((response) => {
          return { success: true, data: response.data, message: response.data.message }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
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
          this.syncSessionStore()
          return { success: true, data, message: '' }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },
    async pauseSession() {
      // Flush buffer aktivitas in-memory ke storage terlebih dahulu
      if (this.session?.id && this._activitiesBuffer && this._activitiesBuffer.length > 0) {
        await flushSessionActivities(this.session.id, this._activitiesBuffer)
      }

      // Baca activities dari buffer in-memory (lebih efisien, tidak perlu baca storage)
      const activities: AddSessionActivity[] = [...(this._activitiesBuffer || [])]

      activities.push({
        action_label: `session_pause`,
        recordable: 'Session',
        recordable_id: this.session?.id,
        api: `PATCH /api/v1/sessions/${this.session?.id}`,
        params: { session: { status: 'paused', session_activities: 'SessionActivity[]' } }, // prevent infinite array
        notes: `Pause session`,
        timestamp: new Date().toISOString()
      })

      return axios
        .patch(`/api/v1/sessions/${this.session?.id}`, {
          session: { status: 'paused', session_activities: activities }
        })
        .then(async ({ data }) => {
          this.session = data

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
          return { success: true, data, message: '' }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },
    async endSession() {
      // Flush buffer aktivitas in-memory ke storage terlebih dahulu
      if (this.session?.id && this._activitiesBuffer && this._activitiesBuffer.length > 0) {
        await flushSessionActivities(this.session.id, this._activitiesBuffer)
      }

      // Baca activities dari buffer in-memory (lebih efisien, tidak perlu baca storage)
      const activities: AddSessionActivity[] = [...(this._activitiesBuffer || [])]

      activities.push({
        action_label: `session_end`,
        recordable: 'Session',
        recordable_id: this.session?.id,
        api: `PATCH /api/v1/sessions/${this.session?.id}`,
        params: { session: { status: 'completed', session_activities: 'SessionActivity[]' } }, // prevent infinite array
        notes: `End session`,
        timestamp: new Date().toISOString()
      })

      return axios
        .patch(`/api/v1/sessions/${this.session?.id}`, {
          session: { status: 'completed', session_activities: activities }
        })
        .then(async ({ data }) => {
          this.session = data

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
          return { success: true, data, message: '' }
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

    async createMeasurement({ id, target_id, measurement }: CreateMeasurementParams) {
      return axios
        .post(`/api/v1/sessions/${id}/targets/${target_id}/measurements`, { measurement })
        .then(async ({ data }) => {
          return { success: true, data, message: '' }
        })
        .catch(async (error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },
    async addMultipleTargetsSession({ id, target_ids }: AddMultipleTargetSessionParams) {
      return axios
        .post(`/api/v1/sessions/${id}/add_multiple_targets`, {
          target_ids
        })
        .then((response) => {
          this.setSession(response.data)
          return { success: true, data: response.data, message: '' }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },
    async advanceMaintenanceSession({ id, target_ids }: AdvanceMaintenanceSessionParams) {
      return axios
        .post(`/api/v1/sessions/${id}/advance_maintenance`, {
          target_ids
        })
        .then((response) => {
          return { success: true, data: response.data, message: '' }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },

    async updateMeasurement({ id, measurement, data_result, is_comment }: UpdateMeasurementParams) {
      const app = useAppStore()
      if (!app.network_status.connected) {
        console.log(data_result)
      }

      return axios
        .patch(`/api/v1/measurements/${id}`, { measurement })
        .then(async ({ data }) => {
          this.setSessionMeasurement(data, is_comment)

          // record session activities
          this.addSessionActivity({
            action_label: 'api_success',
            recordable: 'Measurement',
            recordable_id: id,
            api: `PATCH /api/v1/measurements/${id}`,
            params: { measurement },
            notes: 'Success update measurement',
            timestamp: new Date().toISOString()
          })

          return { success: true, data, message: '' }
        })
        .catch(async (error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)

          // record session activities
          this.addSessionActivity({
            action_label: 'api_failed',
            recordable: 'Measurement',
            recordable_id: id,
            api: `PATCH /api/v1/measurements/${id}`,
            params: { measurement },
            notes: message as string,
            timestamp: new Date().toISOString()
          })

          return { success: false, data: null, message }
        })
    },
    async deleteMeasurement({ id, params }: { id: Measurement['id']; params?: string }) {
      return axios
        .delete(`/api/v1/measurements/${id}${params || ''}`)
        .then((response) => {
          return { success: true, data: response.data, message: '' }
        })
        .catch((error) => {
          const message = getErrorMessage(error.response?.data?.error || error?.message)
          return { success: false, data: null, message }
        })
    },

    // updateMeasurementResults dengan semua fix
    async updateMeasurementResults({
      id,
      measurement,
      data_result,
      last_data
    }: UpdateMeasurementResultsParams): Promise<ResponseSchema> {
      // Simpan state sebelumnya untuk rollback
      const previousMeasurement = this.session_measurements?.find((m) => m.id === id)
      try {
        const app = useAppStore()

        // handling for offline mode
        if (!app.network_status.connected) {
          const key = `update_measurement_${id}`
          const newParams = { id, measurement, data_result, last_data }

          const index = this.pending_progress.findIndex((i) => i.key === key)
          if (index > -1) {
            this.pending_progress[index].params = newParams
            this.pending_progress[index].timestamp = Date.now()
          } else {
            this.pending_progress.push({
              key,
              name: 'update_measurement_result', // ⚠️ Sesuaikan dengan resolvePendingProgress
              params: newParams,
              timestamp: Date.now(),
              retryCount: 0
            })
          }

          // Tandai sebagai pending sync
          const measurementWithPending = {
            ...data_result,
            _pendingSync: true,
            _lastSyncAttempt: Date.now()
          }
          this.setSessionMeasurement(measurementWithPending)

          // Simpan ke local storage
          await this.saveLocalBackup(Number(id), data_result, 'pending')

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

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const { data: patchData } = await axios.patch(
              `/api/v1/measurements/${id}`,
              { measurement },
              {
                timeout: attempt === 0 ? 5000 : 8000,
                headers: {
                  'X-Request-Attempt': attempt + 1
                }
              }
            )

            // record session activities
            this.addSessionActivity({
              action_label: 'api_success',
              recordable: 'Measurement',
              recordable_id: id,
              api: `PATCH /api/v1/measurements/${id}`,
              params: { measurement },
              notes: `Success update measurement [attempt: ${attempt + 1}]`,
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
              (i) => i.key === `update_measurement_${id}`
            )
            if (queueIndex > -1) {
              this.pending_progress.splice(queueIndex, 1)
              this.syncSessionStore()
            }

            // Update local backup dengan status synced
            await this.saveLocalBackup(Number(id), newData, 'synced')

            return { success: true, data: newData, message: '' }
          } catch (err) {
            lastError = err

            // Retry jika timeout dan belum max attempts
            if (attempt < maxRetries && isAxiosError(err) && err.code === 'ECONNABORTED') {
              // record session activities
              this.addSessionActivity({
                action_label: 'api_failed',
                recordable: 'Measurement',
                recordable_id: id,
                api: `PATCH /api/v1/measurements/${id}`,
                params: { measurement },
                notes: `Failed, timeout [attempt: ${attempt + 1}]`,
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
        const key = `update_measurement_${id}`
        const newParams = { id, measurement, data_result, last_data }

        const index = this.pending_progress.findIndex((i) => i.key === key)
        if (index > -1) {
          this.pending_progress[index].params = newParams
          this.pending_progress[index].retryCount =
            (this.pending_progress[index].retryCount || 0) + 1
          this.pending_progress[index].lastError = isAxiosError(error)
            ? error.response?.data?.error || error.message
            : 'Unknown error'
        } else {
          this.pending_progress.push({
            key,
            name: 'update_measurement_result',
            params: newParams,
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
        await this.saveLocalBackup(Number(id), data_result, 'pending')

        if (isAxiosError(error)) {
          if (error.code === 'ECONNABORTED') {
            // record session activities
            this.addSessionActivity({
              action_label: 'api_failed',
              recordable: 'Measurement',
              recordable_id: id,
              api: `PATCH /api/v1/measurements/${id}`,
              params: { measurement },
              notes: `Slow connection. Data will be saved automatically.`,
              timestamp: new Date().toISOString()
            })

            return {
              success: false,
              message: 'Slow connection. Data will be saved automatically.',
              data: previousMeasurement || last_data
            }
          }

          // Handle conflict (409)
          if (error.response?.status === 409) {
            // record session activities
            this.addSessionActivity({
              action_label: 'api_failed',
              recordable: 'Measurement',
              recordable_id: id,
              api: `PATCH /api/v1/measurements/${id}`,
              params: { measurement },
              notes: `Data was changed by another user. Please refresh.`,
              timestamp: new Date().toISOString()
            })

            return {
              success: false,
              message: 'Data was changed by another user. Please refresh.',
              data: error.response.data || last_data
            }
          }

          const message = getErrorMessage(error.response?.data?.error || error?.message)

          // record session activities
          this.addSessionActivity({
            action_label: 'api_failed',
            recordable: 'Measurement',
            recordable_id: id,
            api: `PATCH /api/v1/measurements/${id}`,
            params: { measurement },
            notes: message as string,
            timestamp: new Date().toISOString()
          })

          return { success: false, message, data: previousMeasurement || last_data }
        }

        return {
          success: false,
          message: 'Failed to save. Will retry automatically.',
          data: previousMeasurement || last_data
        }
      }
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

          // record session activities
          this.addSessionActivity({
            action_label: 'api_success',
            recordable: 'Measurement',
            recordable_id: id,
            api: `PATCH /api/v1/measurements/${id}/mark_probing`,
            params: { visible, marked_as },
            notes: `Success update measurement mark probing`,
            timestamp: new Date().toISOString()
          })

          return { success: true, data, message: '' }
        })
        .catch(async (error) => {
          console.log(error)
          const message = getErrorMessage(error.response?.data?.error || error?.message)

          // record session activities
          this.addSessionActivity({
            action_label: 'api_failed',
            recordable: 'Measurement',
            recordable_id: id,
            api: `PATCH /api/v1/measurements/${id}/mark_probing`,
            params: { visible, marked_as },
            notes: message as string,
            timestamp: new Date().toISOString()
          })

          return { success: false, data: null, message }
        })
    },

    // ========================================
    // COMMENT FUNCTIONS
    // ========================================
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
          params: { client_id, session_id, type, session_comment, assessment, data_result, images },
          timestamp: Date.now(),
          retryCount: 0
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
            this.pending_progress[index].timestamp = Date.now()
          } else {
            this.pending_progress.push({
              key,
              name: 'update_comment',
              params: newParams,
              timestamp: Date.now(),
              retryCount: 0
            })
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
            this.pending_progress[idx].timestamp = Date.now()
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
          params: { documents, client_id, session_id, session_slug },
          timestamp: Date.now(),
          retryCount: 0
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
            this.pending_progress[index].timestamp = Date.now()
          } else {
            this.pending_progress.push({
              key,
              name: 'delete_comment',
              params: newParams,
              timestamp: Date.now(),
              retryCount: 0
            })
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
    },

    // ========================================
    // SESSION ACTIVITIES FUNCTIONS
    // ========================================

    /**
     * Tambah aktivitas ke in-memory buffer.
     * Buffer ditulis ke storage secara batched (setiap 10 aktivitas ATAU setiap 15 detik),
     * bukan setiap kali aktivitas ditambahkan — menghindari O(n²) read-modify-write.
     */
    async addSessionActivity(params: AddSessionActivity): Promise<void> {
      if (!this.session?.id) return
      if (this.session?.status !== 'ongoing') return

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
