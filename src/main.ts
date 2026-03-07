import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n, getDefaultLocale } from './i18n'
import './style.css'

i18n.global.locale.value = getDefaultLocale()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)
app.mount('#app')
