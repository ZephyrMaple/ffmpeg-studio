<template>
  <div class="app-container">
  <!-- 左侧导航栏 -->
  <AppSidebar v-if="appStore.sidebarVisible" :active-tab="appStore.activeTab" @select="appStore.setActiveTab" @open-settings="showSettings = true" />

  <!-- 主内容区 -->
  <main class="main-content">
    <keep-alive>
        <MediaInfoPage v-if="appStore.activeTab === 'mediainfo'" key="mediainfo" class="page-container" />

        <div v-else-if="appStore.activeTab === 'convert'" key="convert" class="convert-page page-container">
          <div class="content-scroll">
            <FileSection />
            <ConvertSettings v-if="convertStore.hasFiles" />
            <CommandPreview v-if="convertStore.hasFiles" />
            <ProgressBar
              v-if="convertStore.hasFiles"
              :is-running="convertStore.isRunning"
              :progress="convertStore.progress"
              :last-result="convertStore.lastResult"
              :logs="convertStore.logs"
              @execute="convertStore.execute()"
              @cancel="convertStore.cancel()"
              @clear-logs="convertStore.logs = []"
            />
          </div>
        </div>

        <MergeSection v-else-if="appStore.activeTab === 'merge'" key="merge" class="page-container" />

        <CustomCommandPage v-else-if="appStore.activeTab === 'custom'" key="custom" class="page-container" />

        <SnapshotPage v-else-if="appStore.activeTab === 'snapshot'" key="snapshot" class="page-container" />

        <AudioPage v-else-if="appStore.activeTab === 'audio'" key="audio" class="page-container" />

        <SubtitlePage v-else-if="appStore.activeTab === 'subtitle'" key="subtitle" class="page-container" />

        <CapturePage v-else-if="appStore.activeTab === 'capture'" key="capture" class="page-container" />

        <StreamPage v-else-if="appStore.activeTab === 'stream'" key="stream" class="page-container" />

        <FilterPage v-else-if="appStore.activeTab === 'filter'" key="filter" class="page-container" />
    </keep-alive>
  </main>

  <!-- 全局设置弹窗 -->
  <SettingsDialog v-model="showSettings" @save="onSettingsSave" />
</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useConvertStore } from '@/stores/convert'
import { useMergeStore } from '@/stores/merge'
import AppSidebar from '@/components/AppSidebar.vue'
import FileSection from '@/components/FileSection.vue'
import ConvertSettings from '@/components/ConvertSettings.vue'
import CommandPreview from '@/components/CommandPreview.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import MergeSection from '@/components/MergeSection.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import MediaInfoPage from '@/components/MediaInfoPage.vue'
import SnapshotPage from '@/components/SnapshotPage.vue'
import AudioPage from '@/components/AudioPage.vue'
import SubtitlePage from '@/components/SubtitlePage.vue'
import CapturePage from '@/components/CapturePage.vue'
import StreamPage from '@/components/StreamPage.vue'
import FilterPage from '@/components/FilterPage.vue'
import CustomCommandPage from '@/components/CustomCommandPage.vue'
import { onMenuAction, openFileSelector, openExternalPath } from '@/utils/platform'

const appStore = useAppStore()
const convertStore = useConvertStore()
const mergeStore = useMergeStore()
const showSettings = ref(false)

// 加载全局设置到 store（用于默认值和确认对话框等）
function loadGlobalSettings() {
  try {
    const raw = localStorage.getItem('ffmpeg-studio-settings')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function applyGlobalSettings() {
  const global = loadGlobalSettings()
  // 默认输出目录 → 全局生效
  if (global.defaultOutputDir) {
    if (!convertStore.settings.outputDir) convertStore.updateSettings({ outputDir: global.defaultOutputDir })
    if (!mergeStore.mergeSettings.outputDir) mergeStore.mergeSettings.outputDir = global.defaultOutputDir
  }
  // 同步全局设置到 appStore
  appStore.refreshSettings()
}

function onSettingsSave() {
  applyGlobalSettings()
}

applyGlobalSettings()

// 监听系统菜单栏动作
let removeMenuListener = () => {}
onMounted(() => {
  removeMenuListener = onMenuAction(async (action) => {
    if (action === 'openFile') {
      const files = await openFileSelector()
      if (files && files.length > 0) {
        convertStore.addFiles(files)
      }
    } else if (action === 'openOutputDir') {
      let target = convertStore.settings.outputDir
      if (!target && convertStore.selectedFile) {
        const path = convertStore.selectedFile.path
        const sep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
        target = sep >= 0 ? path.substring(0, sep) : ''
      }
      if (target) {
        const res = await openExternalPath(target)
        if (res?.error) console.warn('打开目录失败:', res.error)
      }
    }
  })
})
onUnmounted(() => { removeMenuListener() })
</script>

<style scoped>
.app-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.convert-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}
</style>
