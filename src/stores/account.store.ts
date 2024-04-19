import { defineStore } from 'pinia'
import { removeAccountStorage, setAccountStorage } from '@/plugins/preferences.plugin'
import type { User } from '@/lib/types'
import axios from 'axios'

interface StateSchema {
  access: string
  csrf: string
  user: User
}
interface AssignSchema {
  access: string
  csrf: string
  user: User
}
interface SigninSchema {
  email: string
  password: string
}

export const useAccountStore = defineStore('account', {
  state: (): StateSchema => ({ access: '', csrf: '', user: {} }),
  getters: {
    // doubleCount: (state) => state.count * 2
  },
  actions: {
    async reset() {
      this.access = ''
      this.csrf = ''
      this.user = {}
      return { success: true }
    },
    async assign({ access, csrf, user }: AssignSchema) {
      this.access = access
      this.csrf = csrf
      this.user = user
      return { success: true }
    },
    async signin({ email, password }: SigninSchema) {
      console.log(email, password)
      return axios
        .post('/signin', { email, password })
        .then(async ({ data }) => {
          const { success } = await setAccountStorage(data)
          if (!success) return { success: false }
          this.assign(data)
          return { success: true, message: 'Successfully signed in' }
        })
        .catch(({ response }) => {
          return { success: false, message: response.data.error }
        })
    },
    async signout() {
      const { status } = await axios.delete('/signin')
      if (status !== 200) return { success: false }
      const { success } = await removeAccountStorage()
      if (!success) return { success: false }
      this.reset()
      return { success: true }
    }
  }
})
