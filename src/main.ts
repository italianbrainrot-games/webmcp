import { initWebMCPClient } from './webmcp-client'
// 初始化本地 WebMCP 客户端，接管 navigator.modelContext
initWebMCPClient()

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)

app.use(ElementPlus)
app.mount('#app')

