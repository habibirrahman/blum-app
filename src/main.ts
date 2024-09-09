import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import VueAxios from 'vue-axios'
import axios from './backend/axios'
import Toast, { type PluginOptions, POSITION } from 'vue-toastification'
// Import the CSS or use your own!
import 'vue-toastification/dist/index.css'

import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueAxios, axios)

const options: PluginOptions = {
  // timeout: 20000,
  // You can set your default options here
  position: POSITION.TOP_CENTER,
  icon: false,
  closeButton: false
}
app.use(Toast, options)

app.mount('#app')
