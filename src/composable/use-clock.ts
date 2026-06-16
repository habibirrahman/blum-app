// useClock.js

/**
 * Shared reactive clock for the entire application.
 *
 * This composable exposes a singleton `now` reference that updates every
 * second. It exists to avoid creating multiple intervals across components,
 * especially in views that are frequently mounted and unmounted.
 *
 * Usage:
 *
 * ```ts
 * const { now } = useClock()
 * ```
 *
 * Any elapsed-time or duration calculation should use `now.value`
 * instead of creating a local interval.
 */

import { ref } from 'vue'
import dayjs from 'dayjs'

const now = ref(dayjs())

let started = false

function startClock() {
  if (started) return

  started = true

  setInterval(() => {
    now.value = dayjs()
  }, 1000)
}

export function useClock() {
  startClock()

  return {
    now,
  }
}
