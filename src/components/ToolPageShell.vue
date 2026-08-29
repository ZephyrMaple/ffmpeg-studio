<template>
  <section class="tool-page">
    <div class="page-scroll">
      <h2 class="page-title">
        <el-icon><component :is="iconComponent" /></el-icon>
        <span>{{ title }}</span>
        <slot name="hint" />
      </h2>

      <div v-if="showFileSelect" class="file-area">
        <div v-if="files.length === 0" class="drop-zone" @click="browse" @dragover.prevent="dragOver=true" @dragleave="dragOver=false"
          @drop.prevent="handleDrop" :class="{ dragging: dragOver }">
          <el-icon :size="32"><UploadFilled /></el-icon>
          <p>拖拽文件到此处，或点击选择</p>
        </div>
        <div v-else class="file-card-list">
          <div v-for="(f, i) in files" :key="i" class="file-card"
            :class="{ active: f === activeFile, guessed: f._guessed, error: f._error }"
            @click="$emit('update:activeFile', f)">
            <div class="file-icon" :style="{ color: iconColor(f) }">
              <el-icon :size="24"><component :is="fileIcon(f)" /></el-icon>
            </div>
            <div class="file-meta">
              <div class="file-name">{{ f.name || f }}</div>
              <div class="file-info">
                <span>{{ formatDuration(f.format?.duration) || '--' }}</span>
                <span class="info-sep">·</span>
                <span>{{ formatSize(f.format?.size) || '--' }}</span>
                <template v-if="videoInfo(f)">
                  <span class="info-sep">·</span><span>{{ videoInfo(f) }}</span>
                </template>
              </div>
            </div>
            <el-button class="file-remove" text size="small" @click.stop="$emit('remove-file', i)">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="$slots.toolbar" class="toolbar"><slot name="toolbar" /></div>
      <slot />
      <div v-if="$slots.outputSettings" class="output-area"><slot name="outputSettings" /></div>

      <div v-if="command" style="margin: 0 24px 14px;"><CommandBlock :command="command" /></div>

      <div v-if="showExecute" style="margin: 0 24px 0;">
        <ProgressBar
          :is-running="runner.isRunning.value"
          :progress="runner.progress"
          :last-result="runner.lastResult.value"
          :logs="runner.logs.value"
          :disabled="!canExecute"
          execute-label="执行"
          @execute="$emit('execute')"
          @cancel="runner.cancel()"
          @clear-logs="runner.logs.value = []"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UploadFilled, Close, VideoCamera, Headset, Picture, Film } from '@element-plus/icons-vue'
import CommandBlock from '@/components/CommandBlock.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { extractDroppedFiles, openFileSelector, formatDuration, formatSize } from '@/utils/platform'
import { useFFmpegRunner } from '@/utils/useRunner'

const props = defineProps({
  title: String,
  icon: { type: String, default: 'VideoCamera' },
  files: { type: Array, default: () => [] },
  activeFile: { type: Object, default: null },
  showFileSelect: { type: Boolean, default: true },
  showExecute: { type: Boolean, default: true },
  canExecute: { type: Boolean, default: false },
  command: { type: String, default: '' },
})
const emit = defineEmits(['execute', 'add-files', 'remove-file', 'update:activeFile'])
const dragOver = ref(false)
const runner = useFFmpegRunner()
defineExpose({ runner })

const iconComponent = computed(() => {
  const map = { InfoFilled: 'InfoFilled', Picture: 'Picture', Headset: 'Headset', Message: 'Message', Monitor: 'Monitor', Upload: 'Upload', Filter: 'Filter', VideoCamera: 'VideoCamera', MagicStick: 'MagicStick', FolderAdd: 'FolderAdd' }
  return map[props.icon] || 'VideoCamera'
})

function videoInfo(f) { const v = f.streams?.find(s => s.codec_type === 'video'); return v?.codec_name?.toUpperCase() || '' }
function fileIcon(f) {
  if (!f.streams) return Picture
  const hasV = f.streams.some(s => s.codec_type === 'video'), hasA = f.streams.some(s => s.codec_type === 'audio')
  return hasV&&hasA ? Film : hasV ? VideoCamera : hasA ? Headset : Picture
}
function iconColor(f) {
  if (!f.streams) return 'var(--text-tertiary)'
  const hasV = f.streams.some(s => s.codec_type === 'video'), hasA = f.streams.some(s => s.codec_type === 'audio')
  return hasV&&hasA ? 'var(--accent)' : hasV ? 'var(--el-color-primary-light-3)' : hasA ? 'var(--danger)' : 'var(--success)'
}
async function browse() { const list = await openFileSelector(); if (list?.length) emit('add-files', list) }
function handleDrop(e) { dragOver.value = false; const list = extractDroppedFiles(e); if (list?.length) emit('add-files', list) }
</script>

<style scoped>
.tool-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.page-scroll { flex: 1; overflow-y: auto; }
.page-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; padding: 20px 24px 14px; color: var(--text-primary); }
.file-area { padding: 0 24px 14px; }
.drop-zone {
  border-radius: 16px !important;
  padding: 24px 16px !important;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease !important;
  background: var(--bg-surface) !important;
  box-shadow: var(--nm-shadow-inset-sm) !important;
  border: 2px dashed transparent !important;
}
.drop-zone:hover {
  border-color: var(--accent) !important;
  box-shadow: var(--nm-shadow-inset), 0 0 0 1px var(--accent-soft) !important;
}
.drop-zone.dragging {
  border-color: var(--accent) !important;
  background: var(--bg-selected) !important;
  box-shadow: var(--nm-shadow-inset) !important;
}
.drop-zone p { font-size: 13px; color: var(--text-secondary); margin: 8px 0 0; }
.file-card-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.file-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--bg-surface) !important;
  border-radius: 14px !important;
  cursor: pointer;
  transition: all 0.25s ease !important;
  box-shadow: var(--nm-shadow-sm) !important;
  border: none !important;
}
.file-card:hover {
  background: var(--bg-surface) !important;
  box-shadow: var(--nm-shadow) !important;
  transform: translateY(-1px);
}
.file-card.active {
  background: var(--bg-surface) !important;
  box-shadow: var(--nm-shadow-inset-sm) !important;
  transform: translateY(0);
}
.file-card.error { background: var(--bg-error) !important; }
.file-card.guessed { background: var(--bg-warning) !important; }
.file-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.file-meta { flex: 1; min-width: 0; }
.file-name { font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-info { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; display: flex; align-items: center; gap: 4px; }
.file-info .info-sep { color: var(--text-tertiary); opacity: 0.5; }
.file-remove { color: var(--text-tertiary); }
.file-remove:hover { color: var(--danger); }
.toolbar { padding: 0 24px 14px; display: flex; gap: 10px; flex-wrap: wrap; }
.output-area { margin: 0 24px 14px; }
</style>
