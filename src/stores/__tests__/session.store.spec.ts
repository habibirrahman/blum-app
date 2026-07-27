import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import axios from 'axios'
import { useSessionStore } from '../session.store'
import type { Measurement } from '@/lib/types'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  },
  isAxiosError: () => false
}))

function makeMeasurement(overrides: Partial<Measurement>): Measurement {
  return {
    id: 1,
    type: 'Measurement::ColdProbe',
    results: {},
    ...overrides
  } as Measurement
}

describe('session.store getSessionMeasurements', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(axios.get).mockReset()
  })

  it('keeps the local measurement when it was updated more recently than the refresh response (race condition regression)', async () => {
    const store = useSessionStore()
    store.session = { id: 1, slug: 'abc' } as any

    // Simulasi: cold probe sudah sukses disimpan lokal (lewat updateMeasurementResults ->
    // getMeasurement -> setSessionMeasurement) SEBELUM response refresh datang.
    store.session_measurements = [
      makeMeasurement({
        id: 1402631,
        results: { score: '0' },
        updated_at: '2026-07-20T07:45:32.474Z'
      })
    ]

    // Response refresh ini "difoto" server SEBELUM PATCH di atas selesai, jadi masih kosong.
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        makeMeasurement({
          id: 1402631,
          results: {},
          updated_at: '2026-07-20T07:45:29.000Z'
        })
      ]
    })

    const result = await store.getSessionMeasurements({ id: 1 })

    expect(result.success).toBe(true)
    expect(store.session_measurements[0].results).toEqual({ score: '0' })
  })

  it('applies the refresh response when it is newer than local state', async () => {
    const store = useSessionStore()
    store.session = { id: 1, slug: 'abc' } as any

    store.session_measurements = [
      makeMeasurement({
        id: 1402631,
        results: { score: '0' },
        updated_at: '2026-07-20T07:45:29.000Z'
      })
    ]

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        makeMeasurement({
          id: 1402631,
          results: { score: '100' },
          updated_at: '2026-07-20T07:46:00.000Z'
        })
      ]
    })

    await store.getSessionMeasurements({ id: 1 })

    expect(store.session_measurements[0].results).toEqual({ score: '100' })
  })

  it('adds measurements that only exist in the refresh response', async () => {
    const store = useSessionStore()
    store.session = { id: 1, slug: 'abc' } as any
    store.session_measurements = []

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [makeMeasurement({ id: 999, results: { score: '100' } })]
    })

    await store.getSessionMeasurements({ id: 1 })

    expect(store.session_measurements).toHaveLength(1)
    expect(store.session_measurements[0].id).toBe(999)
  })
})
