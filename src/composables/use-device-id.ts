// src/composables/useDeviceId.ts
import { Device } from '@capacitor/device'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

const KEY = 'device_id'
let cached: string | null = null
let inflight: Promise<string> | null = null

function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}

async function resolve(): Promise<string> {
  const existing = await SecureStorage.get(KEY)
  if (typeof existing === 'string' && existing.length > 0) return existing

  let seed = ''
  try {
    seed = (await Device.getId()).identifier
  } catch {
    /* abaikan, fallback ke uuid */
  }

  const id = seed || uuid()
  await SecureStorage.set(KEY, id)
  return id
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached
  // cegah dua pemanggilan bersamaan menulis dua ID berbeda
  if (!inflight) {
    inflight = resolve()
      .then((id) => {
        cached = id
        return id
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}
