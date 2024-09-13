import { getAccessStorage } from '@/plugins/preferences.plugin'
import axios from 'axios'
import router from '@/router'

const API_URL = 'https://blum-staging.herokuapp.com' // staging
// const API_URL = 'https://blubridge-aba.herokuapp.com'

axios.defaults.baseURL = API_URL
axios.defaults.withCredentials = true
// const securedAxiosInstance = axios.create({
//   baseURL: API_URL,
//   withCredentials: true
// })

// Request interceptor
axios.interceptors.request.use(async (config) => {
  // Modify the request config here
  const { success, data } = await getAccessStorage()
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
        // await removeAccessStorage()
        router.push('/')
      } else {
        // Show a generic error message
        // alert('An error occurred. Please try again later.')
      }
    }
    // if (error.message) {
    //   alert(error.message)
    // }
    return Promise.reject(error)
  }
)

export default axios
