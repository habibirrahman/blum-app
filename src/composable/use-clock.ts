// useClock.js

/**
 * Shared reactive clock for the entire application.
 *
 * This composable exposes a singleton `now` reference that updates every
 * second. It exists to avoid creating multiple intervals across components,
 * especially in views that are frequently mounted and unmounted.
 *
 * Optimizations:
 * - Reference counting: interval hanya berjalan selama ada minimal 1 komponen
 *   yang sedang menggunakan `useClock()`. Saat komponen terakhir unmount,
 *   interval otomatis di-clear (bukan jalan selamanya).
 * - Background pause: saat app masuk ke background (appStateChange / tab
 *   disembunyikan), interval di-pause walau masih ada subscriber, supaya
 *   tidak ada tick sia-sia saat user tidak melihat layar. Saat app aktif
 *   lagi, `now` langsung disegarkan dan interval dilanjutkan.
 *
 * Usage:
 *
 * ```ts
 * const { now } = useClock()
 * onUnmounted(() => {
 *   // tidak perlu manual cleanup - composable mengurus reference count
 * })
 * ```
 *
 * PENTING: useClock() HARUS dipanggil di dalam setup() komponen Vue (bukan
 * di luar lifecycle), karena ia mendaftarkan onUnmounted() untuk melepas
 * reference count secara otomatis.
 *
 * Any elapsed-time or duration calculation should use `now.value`
 * instead of creating a local interval.
 */

import { onUnmounted, ref } from 'vue'
import dayjs from 'dayjs'

const now = ref(dayjs())

let intervalId: ReturnType<typeof setInterval> | undefined
let subscriberCount = 0
let isAppActive = true
let listenersInitialized = false

function tick() {
  now.value = dayjs()
}

function startInterval() {
  if (intervalId !== undefined) return
  intervalId = setInterval(tick, 1000)
}

function stopInterval() {
  if (intervalId === undefined) return
  clearInterval(intervalId)
  intervalId = undefined
}

function syncIntervalState() {
  if (subscriberCount > 0 && isAppActive) {
    startInterval()
  } else {
    stopInterval()
  }
}

async function setupAppStateListeners() {
  if (listenersInitialized) return
  listenersInitialized = true

  // document.visibilitychange — bekerja untuk web & sebagai fallback umum
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      isAppActive = !document.hidden
      if (isAppActive) tick() // segarkan `now` segera saat kembali aktif
      syncIntervalState()
    })
  }

  // Capacitor App plugin — lebih akurat untuk native background/foreground
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('appStateChange', ({ isActive }) => {
      isAppActive = isActive
      if (isAppActive) tick()
      syncIntervalState()
    })
  } catch {
    // @capacitor/app tidak tersedia (mis. di environment web murni) — aman diabaikan,
    // visibilitychange di atas tetap menangani kasus tab/browser.
  }
}

export function useClock() {
  subscriberCount++
  setupAppStateListeners()
  syncIntervalState()

  onUnmounted(() => {
    subscriberCount = Math.max(0, subscriberCount - 1)
    syncIntervalState()
  })

  return {
    now
  }
}