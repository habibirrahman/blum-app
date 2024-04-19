import { getAccountStorage, removeAccountStorage } from '@/plugins/preferences.plugin'
import router from '@/router'
import axios from 'axios'

const API_URL = 'https://blum-staging.herokuapp.com'

axios.defaults.baseURL = API_URL
// const securedAxiosInstance = axios.create({
//   baseURL: API_URL,
//   withCredentials: true
// })

// Request interceptor
axios.interceptors.request.use(async (config) => {
  // Modify the request config here
  const { success, data } = await getAccountStorage()
  config.headers['Content-Type'] = 'application/json'
  if (success) {
    config.headers['Authorization'] = `Bearer ${data?.access}`
    const method = config.method?.toUpperCase()
    if (method !== 'OPTIONS' && method !== 'GET') {
      config.headers['X-CSRF-TOKEN'] = data?.csrf
    }
  }
  return config
})

// Response interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Redirect to login page
        await removeAccountStorage()
        router.push('/')
      } else {
        // Show a generic error message
        alert('An error occurred. Please try again later.')
      }
    }
    return Promise.reject(error)
  }
)

export default axios
