import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import './styles/global.css'
import { applyTheme, loadSettings } from './utils/platform'

const app = createApp(App)

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(ElementPlus)
app.mount('#app')

// 启动时应用已保存的主题
const settings = loadSettings()
applyTheme(settings.theme || 'light')

// 监听系统主题变化（跟随系统模式）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const currentTheme = loadSettings().theme
  if (currentTheme === 'auto') {
    applyTheme('auto')
  }
})
