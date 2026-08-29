<template>
  <!-- 拖拽上传区 -->
  <div
    class="drop-zone"
    :class="{ dragging: isDragging }"
    @click="handleBrowse"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <el-icon :size="40" class="drop-icon"><UploadFilled /></el-icon>
    <p class="drop-title">拖拽文件到此处，或点击选择</p>
    <p class="drop-hint">支持 MP4 / MKV / AVI / MOV / FLV / WebM / MP3 / WAV 等格式</p>
  </div>

  <!-- 文件卡片列表 -->
  <div class="file-list">
    <div
      v-for="(file, index) in store.files"
      :key="file.path || file.name"
      class="file-card"
      :class="{
        selected: index === store.selectedFileIndex,
        unchecked: store.files.length >= 2 && !isChecked(index)
      }"
      @click="handleCardClick(index)"
    >
      <el-checkbox
        v-if="store.files.length >= 2"
        :model-value="isChecked(index)"
        @change="handleCheckChange(index, $event)"
        @click.stop
        class="file-checkbox"
      />
      <div class="file-icon">
        <el-icon :size="24">
          <VideoCamera v-if="isVideo(file)" />
          <Headset v-else-if="isAudio(file)" />
          <Picture v-else-if="isImage(file)" />
          <Document v-else />
        </el-icon>
      </div>

      <div class="file-info">
        <div class="file-name" :title="file.name">{{ file.name }}</div>
        <div class="file-meta">
          <template v-if="file.loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>正在分析...</span>
          </template>
          <template v-else-if="file.error">
            <span class="error-text">{{ file.error }}</span>
          </template>
          <template v-else-if="file.format">
            <span>{{ formatDuration(file.format.duration) }}</span>
            <span class="dot">·</span>
            <span>{{ formatSize(parseInt(file.format.size) || 0) }}</span>
            <span class="dot">·</span>
            <span>{{ getFormatSummary(file) }}</span>
          </template>
        </div>
      </div>

      <el-button
        text
        class="file-remove"
        @click.stop="store.removeFile(index)"
      >
        <el-icon><Close /></el-icon>
      </el-button>
    </div>
  </div>

  <!-- 多文件操作栏 -->
  <div v-if="store.files.length >= 2" class="file-toolbar">
    <span class="process-count">已选 {{ store.selectedForProcess.length }} / {{ store.files.length }}</span>
    <el-button text size="small" @click="selectAll">
      <el-icon><Check /></el-icon> 全选
    </el-button>
    <el-button text size="small" @click="deselectAll">
      <el-icon><Minus /></el-icon> 全不选
    </el-button>
    <el-button text size="small" @click="selectInverse">
      <el-icon><Refresh /></el-icon> 反选
    </el-button>
    <el-button text size="small" @click="store.clearFiles">
      <el-icon><Delete /></el-icon> 清空
    </el-button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useConvertStore } from '@/stores/convert'
import { openFileSelector, extractDroppedFiles } from '@/utils/platform'
import {
  UploadFilled, Delete, Close, Loading,
  VideoCamera, Headset, Picture, Document,
  Check, Minus, Refresh
} from '@element-plus/icons-vue'

const store = useConvertStore()
const isDragging = ref(false)

function isVideo(file) {
  const v = file.streams?.find(s => s.codec_type === 'video')
  return !!v
}
function isAudio(file) {
  return !isVideo(file) && !!file.streams?.find(s => s.codec_type === 'audio')
}
function isImage(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  return ['jpg','jpeg','png','bmp','webp'].includes(ext)
}

function getFormatSummary(file) {
  const parts = []
  const v = file.streams?.find(s => s.codec_type === 'video')
  const a = file.streams?.find(s => s.codec_type === 'audio')
  if (v) {
    parts.push(v.codec_name?.toUpperCase())
    if (v.width && v.height) parts.push(`${v.width}x${v.height}`)
  }
  if (a) parts.push(a.codec_name?.toUpperCase())
  return parts.join(' · ') || '未知'
}

function formatDuration(sec) {
  if (!sec) return '--:--'
  const s = parseFloat(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec2 = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec2).padStart(2,'0')}`
  return `${m}:${String(sec2).padStart(2,'0')}`
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

function handleDrop(e) {
  isDragging.value = false
  const files = extractDroppedFiles(e)
  if (files.length > 0) store.addFiles(files)
}

async function handleBrowse() {
  const files = await openFileSelector()
  if (files && files.length > 0) store.addFiles(files)
}

function handleCardClick(index) {
  store.selectFile(index)
}

function handleCheckChange(index, checked) {
  const isOn = store.isFileSelectedForProcess(index)
  if (checked !== isOn) store.toggleProcessFile(index)
}

function isChecked(index) {
  return store.isFileSelectedForProcess(index)
}

function selectAll() {
  store.selectedForProcess = store.files.map((_, i) => i)
}
function deselectAll() {
  store.selectedForProcess = []
}
function selectInverse() {
  const newSel = store.files
    .map((_, i) => i)
    .filter(i => !store.selectedForProcess.includes(i))
  store.selectedForProcess = newSel
}
</script>

<style scoped>
.drop-zone {
  border-radius: 16px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  background: var(--bg-surface);
  box-shadow: var(--nm-shadow-inset-sm);
  border: 2px dashed transparent;
  display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px;
}
.drop-zone:hover {
  border-color: var(--accent);
  box-shadow: var(--nm-shadow-inset), 0 0 0 1px var(--accent-soft);
}
.drop-zone.dragging {
  border-color: var(--accent);
  background: var(--bg-selected);
  box-shadow: var(--nm-shadow-inset);
  transform: scale(1.01);
}

.drop-icon {
  color: var(--text-tertiary);
}
.drop-zone:hover .drop-icon {
  color: var(--accent);
}

.drop-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
}
.drop-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.file-list {
  display: flex; flex-direction: column; gap: 10px;
  margin-top: 14px;
}

.file-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--bg-surface);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  min-height: 56px;
  box-shadow: var(--nm-shadow-sm);
  border: none;
}
.file-card:hover {
  box-shadow: var(--nm-shadow);
  transform: translateY(-1px);
}
.file-card.selected {
  box-shadow: var(--nm-shadow-inset-sm);
  background: var(--bg-selected);
}
.file-card.unchecked {
  opacity: 0.55;
  background: var(--bg-dim);
}

.file-toolbar {
  display: flex; align-items: center; gap: 8px;
  margin-top: 12px; flex-wrap: wrap;
}
.process-count {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 0 4px;
}

.file-checkbox {
  margin-right: 4px;
  flex-shrink: 0;
}

.file-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  box-shadow: var(--nm-shadow-sm);
  border-radius: 10px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.file-card.selected .file-icon {
  background: var(--bg-surface);
  box-shadow: var(--nm-shadow-inset-sm);
  color: var(--accent);
}

.file-info {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
}
.file-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.file-meta .is-loading {
  animation: rotating 1.5s linear infinite;
}
@keyframes rotating {
  to { transform: rotate(360deg); }
}
.dot { color: var(--border-color); }
.error-text { color: var(--danger); }

.file-remove {
  flex-shrink: 0;
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity 0.2s;
}
.file-card:hover .file-remove { opacity: 1; }
.file-remove:hover { color: var(--danger); }
</style>