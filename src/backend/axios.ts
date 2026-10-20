import {
  getAccessStorage,
  removeAccessStorage,
  setAccessStorage
} from '@/plugins/preferences.plugin'
import axios from 'axios'
import router from '@/router'

/* docs: https://vitejs.dev/guide/env-and-mode.html#node-env-and-modes */
const API_URL = import.meta.env.PROD
  ? import.meta.env.VITE_API_ENDPOINT_PRODUCTION
  : import.meta.env.VITE_API_ENDPOINT

let refreshing: Promise<string> | null = null

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor
api.interceptors.request.use(async (config) => {
  config.headers['Content-Type'] = 'application/json'

  const { data: storage } = await getAccessStorage()

  if (!storage) return config

  config.headers['Authorization'] = `Bearer ${storage?.access}`
  const method = config.method?.toUpperCase()
  if (method !== 'OPTIONS' && method !== 'GET') {
    config.headers['X-CSRF-TOKEN'] = storage?.csrf
  }
  return config
})

// Using axios.post instead of api.post to avoid infinite loops
async function requestNewToken() {
  const { data: storage } = await getAccessStorage()

  const res = await axios.post(`${API_URL}/refresh`, null, {
    headers: { Authorization: `Bearer ${storage?.access}` }
  })

  setAccessStorage({ access: res?.data?.access, csrf: res?.data?.csrf })

  return res?.data?.access
}

function refreshOnce() {
  if (!refreshing) {
    refreshing = requestNewToken().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error

    if (!response || response.status !== 401) {
      // Token invalid or expired → clear storage
      removeAccessStorage()

      return Promise.reject(error)
    }

    if (config._retried) return Promise.reject(error)
    if (config.url?.includes('/refresh')) return Promise.reject(error)
    if (config.url?.includes('/signin')) return Promise.reject(error)

    config._retried = true

    try {
      const token = await refreshOnce()
      config.headers.Authorization = `Bearer ${token}`
      return api(config) // repeat original request
    } catch (refreshError) {
      removeAccessStorage()
      router.replace('/')
      return Promise.reject(refreshError)
    }
  }
)

export default api
