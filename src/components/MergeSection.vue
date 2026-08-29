<template>
  <section class="merge-section">
    <div class="merge-scroll">
      <h2 class="section-title">
        <el-icon><FolderAdd /></el-icon>
        <span>文件合并</span>
      </h2>

      <!-- 操作模式选择 -->
      <div class="operation-bar">
        <span class="mode-label">合并模式：</span>
        <el-radio-group :model-value="store.mergeOperation" @change="store.setMergeOperation">
          <el-radio-button value="concat">视频合并</el-radio-button>
          <el-radio-button value="imagesToVideo">图片转视频</el-radio-button>
          <el-radio-button value="imagesToGif">图片转 GIF</el-radio-button>
          <el-radio-button value="audioConcat">音频合并</el-radio-button>
          <el-radio-button value="videoDub">视频配音</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 拖拽上传区 -->
      <div
        class="drop-zone"
        :class="{ dragging: isDragging }"
        @click="handleBrowse"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <el-icon :size="36" class="drop-icon"><UploadFilled /></el-icon>
        <p class="drop-title">拖拽文件到此处，或点击选择</p>
      </div>

      <!-- 文件列表 -->
      <div v-if="store.mergeFiles.length > 0" class="file-list">
          <div class="file-list-header">
            <div class="header-left">
              <span class="file-count">共 {{ store.mergeFiles.length }} 个文件</span>
              <el-tag v-if="!fileTypeValid" type="danger" size="small">
                <el-icon><WarningFilled /></el-icon>
                {{ correctFileCount }}/{{ store.mergeFiles.length }} 类型匹配
              </el-tag>
            </div>
            <div class="file-list-actions">
              <template v-if="store.mergeFiles.length >= 2">
                <span class="process-count">
                  已选 {{ store.mergeFiles.filter(f => f._selected).length }} / {{ store.mergeFiles.length }}
                </span>
                <el-button text size="small" @click="store.selectAllMergeFiles(true)">
                  <el-icon><Check /></el-icon> 全选
                </el-button>
                <el-button text size="small" @click="store.selectAllMergeFiles(false)">
                  <el-icon><Minus /></el-icon> 全不选
                </el-button>
                <el-button text size="small" @click="invertMergeSelection">
                  <el-icon><Refresh /></el-icon> 反选
                </el-button>
              </template>
              <el-button text size="small" @click="store.clearMergeFiles">
                <el-icon><Delete /></el-icon> 清空
              </el-button>
            </div>
          </div>

          <div
            v-for="(file, index) in store.mergeFiles"
            :key="file.path || file.name"
            class="file-card"
            :class="{ unchecked: store.mergeFiles.length >= 2 && !file._selected }"
          >
            <!-- 复选框 -->
            <el-checkbox
              v-if="store.mergeFiles.length >= 2"
              :model-value="file._selected"
              @change="store.toggleMergeFile(index)"
              @click.stop
              class="file-checkbox"
            />
            <div class="file-order-badge">{{ index + 1 }}</div>
            <div class="file-icon">
              <el-icon :size="22">
                <VideoCamera v-if="hasVideoStream(file)" />
                <Headset v-else-if="hasAudioOnly(file)" />
                <Picture v-else-if="isImageFile(file)" />
                <Document v-else />
              </el-icon>
            </div>

            <div class="file-info">
              <div class="file-name" :title="file.name">
                {{ file.name }}
                <span v-if="hasMediaStream(file)" class="file-trimmed">{{ fileTrimmedDurationLabel(file) }}</span>
              </div>
              <div class="file-meta">
                <template v-if="file.loading">
                  <el-icon class="is-loading"><Loading /></el-icon> 正在分析...
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
              <!-- 裁剪信息（视频/音频） -->
              <div v-if="!file.loading && file._trimEnd > 0 && !isImageFile(file)" class="trim-info">
                <el-tag size="small" type="info" effect="plain">
                  裁剪 {{ formatTime(file._trimStart) }} ~ {{ formatTime(file._trimEnd) }}
                </el-tag>
              </div>
            </div>

            <div class="file-actions">
              <el-button text size="small" @click.stop="store.moveMergeFile(index, index - 1)" :disabled="index === 0">
                <el-icon><Top /></el-icon>
              </el-button>
              <el-button text size="small" @click.stop="store.moveMergeFile(index, index + 1)" :disabled="index >= store.mergeFiles.length - 1">
                <el-icon><Bottom /></el-icon>
              </el-button>
              <el-button text size="small" @click.stop="store.removeMergeFile(index)">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>

          <!-- 时间轴裁剪（仅当文件为视频或音频时显示） -->
          <div v-if="selectedFile && isMediaByExt(selectedFile)" class="timeline-section">
            <div class="timeline-header">
              <el-icon><VideoPlay /></el-icon>
              <el-select
                :model-value="store.mergeSelectedIndex"
                @change="(v)=>{store.mergeSelectedIndex=v; initTimeline()}"
                size="small"
                class="trim-file-select"
                placeholder="切换文件"
              >
                <el-option
                  v-for="(f, i) in mediaFiles"
                  :key="f.path || f.name"
                  :value="store.mergeFiles.indexOf(f)"
                  :label="f.name"
                />
              </el-select>
              <el-tag v-if="hasVideoStream(selectedFile) && hasAudioOnly(selectedFile)" type="info" size="small" style="margin-left:8px">音视频</el-tag>
              <el-tag v-else-if="hasVideoStream(selectedFile)" type="primary" size="small" style="margin-left:8px">视频</el-tag>
              <el-tag v-else-if="hasAudioOnly(selectedFile)" type="success" size="small" style="margin-left:8px">音频</el-tag>
              <span class="trimmed-duration" style="margin-left:8px;font-size:12px">
                剪辑后 {{ trimmedDurationLabel }}
              </span>
              <el-button text size="small" @click="resetSelectedTrim" style="margin-left:auto">
                <el-icon><Refresh /></el-icon> 重置
              </el-button>
            </div>
            <!-- 双箭头滑动条代替时间轴 -->
            <div class="dual-thumb-slider">
              <span class="time-label">{{ formatTime(trimRange[0]) }}</span>
              <el-slider v-model="trimRange" range :max="parseFloat(selectedFile?.format?.duration || 0)" :step="0.1" class="thumb-slider" @change="onTrimChange" />
              <span class="time-label">{{ formatTime(trimRange[1]) }}</span>
            </div>
          </div>
        </div>

      <!-- 图片时长设置面板（仅图片转视频模式，只显示勾选的图片） -->
      <div v-if="store.mergeOperation === 'imagesToVideo' && checkedImageList.length > 0" class="setting-card img-duration-panel">
        <div class="card-header">
          <el-icon><Picture /></el-icon>
          <span>图片时长设置（{{ checkedImageList.length }} 张）</span>
          <el-button text size="small" style="margin-left:auto" @click="applyUnifiedDuration">
            <el-icon><Check /></el-icon> 统一应用
          </el-button>
        </div>
        <div class="unified-duration-row">
          <span class="unified-label">统一时长</span>
          <el-slider
            v-model="unifiedDuration"
            :min="0.1" :max="10" :step="0.1"
            show-input
            :show-input-controls="false"
            style="flex:1"
          />
        </div>
        <div class="img-duration-list">
          <div v-for="(file, index) in checkedImageList" :key="file.path || file.name" class="img-duration-item">
            <div class="dur-item-order">{{ index + 1 }}</div>
            <div class="dur-item-name" :title="file.name">{{ file.name }}</div>
            <el-slider
              v-model="file._imgDuration"
              :min="0.1" :max="10" :step="0.1"
              show-input
              size="small"
              class="dur-item-slider"
            />
            <span class="dur-item-value">{{ (file._imgDuration || 1).toFixed(1) }}s</span>
          </div>
        </div>
      </div>

      <!-- 输出设置（有文件时显示） -->
      <div v-if="store.mergeFiles.length > 0" class="merge-settings">
        <OutputSettings
          :format="store.mergeSettings.outputFormat"
          :formats="availableFormatsList"
          :outputDir="store.mergeSettings.outputDir"
          :outputFileName="store.mergeSettings.outputFileName"
          @update:format="(v)=>{store.mergeSettings.outputFormat=v; onFormatChange()}"
          @update:outputDir="(v)=>store.mergeSettings.outputDir=v"
          @update:outputFileName="(v)=>store.mergeSettings.outputFileName=v"
         
        @browse="browseOutputDir"
        />

        <!-- 视频设置（仅视频合并模式） -->
        <div v-if="store.mergeOperation === 'concat'" class="setting-card">
          <div class="card-header">
            <el-icon><VideoCamera /></el-icon>
            <span>视频设置</span>
          </div>
          <div class="setting-row">
            <div class="setting-field">
              <label>视频编码</label>
              <el-select v-model="store.mergeSettings.videoCodec" class="full-width">
                <el-option v-for="(c, k) in mergeVideoCodecs" :key="k" :value="k" :label="c.label" />
              </el-select>
            </div>
            <div class="setting-field">
              <label>分辨率</label>
              <el-select v-model="store.mergeSettings.resolution" class="full-width">
                <el-option v-for="r in RESOLUTION_PRESETS" :key="r.value" :value="r.value" :label="r.label" />
              </el-select>
            </div>
            <div class="setting-field">
              <label>帧率</label>
              <el-select v-model="store.mergeSettings.fps" class="full-width" filterable allow-create default-first-option placeholder="原始帧率">
                <el-option value="" label="原始帧率" />
                <el-option v-for="f in FPS_PRESETS" :key="f" :value="String(f)" :label="`${f} fps`" />
              </el-select>
            </div>
          </div>
        </div>

        <!-- 图片视频设置（仅图片转视频） -->
        <div v-if="store.mergeOperation === 'imagesToVideo'" class="setting-card">
          <div class="card-header">
            <el-icon><Picture /></el-icon>
            <span>图片视频设置</span>
          </div>
          <div class="setting-row">
            <div class="setting-field">
              <label>分辨率</label>
              <el-select v-model="store.mergeSettings.resolution" class="full-width">
                <el-option v-for="r in RESOLUTION_PRESETS" :key="r.value" :value="r.value" :label="r.label" />
              </el-select>
            </div>
            <div class="setting-field">
              <label>输出帧率</label>
              <el-select v-model="store.mergeSettings.fps" class="full-width" filterable allow-create default-first-option placeholder="默认 30">
                <el-option v-for="f in FPS_PRESETS" :key="f" :value="String(f)" :label="`${f} fps`" />
              </el-select>
            </div>
          </div>
        </div>

        <!-- GIF 设置（仅图片转GIF） -->
        <div v-if="store.mergeOperation === 'imagesToGif'" class="setting-card">
          <div class="card-header">
            <el-icon><Picture /></el-icon>
            <span>GIF 设置</span>
          </div>
          <div class="setting-row">
            <div class="setting-field">
              <label>切换间隔 {{ store.mergeSettings.gifInterval }}s</label>
              <el-slider
                v-model="store.mergeSettings.gifInterval"
                :min="0.1" :max="1" :step="0.01"
                show-input
                class="full-width"
              />
            </div>
            <div class="setting-field">
              <label>目标总时长 {{ store.mergeSettings.gifTotalDuration }}s</label>
              <el-slider
                v-model="store.mergeSettings.gifTotalDuration"
                :min="0.1" :max="5" :step="0.1"
                show-input
                class="full-width"
              />
            </div>
          </div>
          <div class="gif-hint">
            <el-icon><InfoFilled /></el-icon>
            实际时长为切换间隔的整数倍，不超过目标总时长
          </div>
        </div>

        <!-- 音频设置（仅音频合并） -->
        <div v-if="store.mergeOperation === 'audioConcat'" class="setting-card">
          <div class="card-header">
            <el-icon><Headset /></el-icon>
            <span>音频设置</span>
          </div>
          <div class="setting-row">
            <div class="setting-field">
              <label>音频编码</label>
              <el-select v-model="store.mergeSettings.audioCodec" class="full-width">
                <el-option v-for="(c, k) in mergeAudioCodecs" :key="k" :value="k" :label="c.label" />
              </el-select>
            </div>
            <div class="setting-field">
              <label>音频码率</label>
              <el-select v-model="store.mergeSettings.audioBitrate" class="full-width">
                <el-option value="320k" label="320k" />
                <el-option value="256k" label="256k" />
                <el-option value="192k" label="192k" />
                <el-option value="128k" label="128k" />
                <el-option value="96k" label="96k" />
                <el-option value="64k" label="64k" />
              </el-select>
            </div>
          </div>
        </div>
      </div>

      <!-- 页面最下方：命令预览 + 执行控制（跟随滚动，非悬浮） -->
      <div v-if="store.mergeFiles.length > 0" class="footer-block">
        <!-- 命令预览 -->
        <div v-if="store.mergeFiles.length >= 2" class="command-block-wrapper">
          <CommandBlock :command="store.mergeCommand" />
        </div>

        <ProgressBar
          :is-running="store.isRunning"
          :progress="store.progress"
          :last-result="store.lastResult"
          :logs="store.mergeLogs"
          execute-label="开始合并"
          :disabled="store.mergeFiles.filter(f => f._selected).length < 2"
          @execute="handleMerge"
          @cancel="store.cancel"
          @clear-logs="store.mergeLogs = []"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useMergeStore } from '@/stores/merge'
import { useAppStore } from '@/stores/app'
import { openFileSelector, extractDroppedFiles, openExternalPath, loadSettings, isElectron, openDirectory } from '@/utils/platform'
import {
  FORMAT_PRESETS, VIDEO_CODECS, AUDIO_CODECS, RESOLUTION_PRESETS, FPS_PRESETS
} from '@/utils/ffmpegCommand'
import {
  FolderAdd, UploadFilled, Delete, Close, Loading,
  VideoCamera, Headset, Picture, Document,
  VideoPlay, VideoPause, Top, Bottom, Files,
  CircleCheckFilled, CircleCloseFilled, Refresh,
  Check, Minus, WarningFilled, CopyDocument, InfoFilled
} from '@element-plus/icons-vue'
import CommandBlock from '@/components/CommandBlock.vue'
import OutputSettings from '@/components/OutputSettings.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const store = useMergeStore()
const appStore = useAppStore()
const isDragging = ref(false)
const logContainer = ref(null)
const unifiedDuration = ref(1)

// 文件合并页：移除 copy（不重编码）和 none（仅音频/无视频）
const mergeVideoCodecs = computed(() => {
  const r = {}
  for (const [k, c] of Object.entries(VIDEO_CODECS)) {
    if (k !== 'copy' && k !== 'none') r[k] = c
  }
  return r
})
const mergeAudioCodecs = computed(() => {
  const r = {}
  for (const [k, c] of Object.entries(AUDIO_CODECS)) {
    if (k !== 'copy' && k !== 'none') r[k] = c
  }
  return r
})

const selectedFile = computed(() => {
  if (store.mergeSelectedIndex < 0) return null
  return store.mergeFiles[store.mergeSelectedIndex] || null
})

// 可用于裁剪的媒体文件列表（视频/音频）
const mediaFiles = computed(() =>
  store.mergeFiles.filter(f => hasMediaStream(f) && !isImageFile(f))
)

// 类型正确的文件数
const correctFileCount = computed(() => {
  const op = store.mergeOperation
  const extMap = {
    concat: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'ts', 'm4v', 'wmv'],
    imagesToVideo: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
    imagesToGif: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
    audioConcat: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'opus']
  }
  const exts = extMap[op] || []
  if (!exts.length) return store.mergeFiles.length
  return store.mergeFiles.filter(f => {
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    return exts.includes(ext)
  }).length
})

const fileTypeValid = computed(() => {
  return correctFileCount.value === store.mergeFiles.length
})

const selectedTrim = computed({
  get: () => {
    const f = selectedFile.value
    if (!f) return null
    return { start: f._trimStart || 0, end: f._trimEnd || 0 }
  },
  set: (val) => {}
})

// 勾选的图片文件列表
const checkedImageList = computed(() => {
  return store.mergeFiles.filter(f => isImageFile(f) && f._selected !== false)
})

// 当前是否为图片模式
const isImageMode = computed(() =>
  store.mergeOperation === 'imagesToVideo' || store.mergeOperation === 'imagesToGif'
)

// 选中文件切换时同步 appStore.timeline
watch(() => store.mergeSelectedIndex, (newIdx) => {
  if (newIdx < 0) return
  const f = store.mergeFiles[newIdx]
  if (!f) return
  appStore.timeline.start = f._trimStart || 0
  appStore.timeline.end = f._trimEnd || 0
  appStore.timeline.videoStart = f._trimStart || 0
  appStore.timeline.videoEnd = f._trimEnd || 0
  appStore.timeline.audioStart = f._trimStart || 0
  appStore.timeline.audioEnd = f._trimEnd || 0
  appStore.timeline.linked = true
  appStore.timeline.ready = (f.format?.duration > 0)
})

// timeline 变化时写回文件
watch(() => [appStore.timeline.start, appStore.timeline.end], ([s, e]) => {
  const f = selectedFile.value
  if (!f) return
  f._trimStart = s
  f._trimEnd = e
})

// 根据操作模式过滤可用格式
const availableFormats = computed(() => {
  const op = store.mergeOperation
  const result = {}
  for (const [k, preset] of Object.entries(FORMAT_PRESETS)) {
    if (op === 'audioConcat') {
      if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'opus'].includes(k)) {
        result[k] = preset
      }
    } else if (op === 'imagesToGif') {
      if (k === 'gif') result[k] = preset
    } else {
      if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(k)) result[k] = preset
    }
  }
  return result
})

// 转成 OutputSettings 需要的数组格式
const availableFormatsList = computed(() =>
  Object.entries(availableFormats.value).map(([k, v]) => ({ value: k, label: v.label }))
)

async function browseOutputDir() {
  const dir = await openDirectory()
  if (dir) store.mergeSettings.outputDir = dir
}

function hasVideoStream(file) {
  return file.streams?.some(s => s.codec_type === 'video')
}
function hasAudioOnly(file) {
  return !hasVideoStream(file) && file.streams?.some(s => s.codec_type === 'audio')
}
/** 是否为音视频文件（非图片） */
function hasMediaStream(file) {
  if (!file) return false
  const v = file.streams?.some(s => s.codec_type === 'video')
  const a = file.streams?.some(s => s.codec_type === 'audio')
  return v || a
}
function isImageFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  return ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'gif'].includes(ext)
}

const MEDIA_EXTS = ['mp4','mkv','avi','mov','webm','flv','ts','m4v','wmv','mp3','wav','flac','aac','ogg','m4a','ac3','wma','opus']

function isMediaByExt(file) {
  if (!file?.name) return false
  const ext = (file.name || '').split('.').pop().toLowerCase()
  return MEDIA_EXTS.includes(ext)
}

// 当前选中文件的剪辑后时长（如未剪辑显示原始时长）
const trimmedDurationLabel = computed(() => {
  const f = selectedFile.value
  if (!f) return '--'
  const total = parseFloat(f.format?.duration || 0)
  const s = appStore.timeline.start || 0
  const e = appStore.timeline.end || 0
  if (e > 0 && e > s) return formatDuration(e - s)
  return formatDuration(total)
})

// 文件列表中：给文件名后追加剪辑后时长
function fileTrimmedDurationLabel(file) {
  if (!hasMediaStream(file)) return ''
  const total = parseFloat(file.format?.duration || 0)
  const s = file._trimStart || 0
  const e = file._trimEnd || 0
  const trimmed = e > 0 && e > s ? e - s : total
  return ` · 剪辑后 ${formatDuration(trimmed)}`
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
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec2).padStart(2, '0')}`
  return `${m}:${String(sec2).padStart(2, '0')}`
}

function formatTime(sec) {
  const s = parseFloat(sec) || 0
  const m = Math.floor(s / 60)
  const sec2 = (s % 60).toFixed(1)
  return `${m}:${String(sec2).padStart(4, '0')}`
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
  if (files.length > 0) store.addMergeFiles(files)
}

async function handleBrowse() {
  const files = await openFileSelector()
  if (files && files.length > 0) store.addMergeFiles(files)
}

function onFormatChange(format) {
  if (store.mergeOperation === 'audioConcat') {
    const aCodec = AUDIO_CODECS[store.mergeSettings.audioCodec]
    if (aCodec && !aCodec.formats.includes(format)) {
      for (const [key, codec] of Object.entries(AUDIO_CODECS)) {
        if (codec.formats.includes(format) && codec.value !== null) {
          store.mergeSettings.audioCodec = key
          break
        }
      }
    }
  }
}

const trimRange = ref([0, 0])
watch(() => selectedFile.value?.format?.duration, (dur) => {
  const f = selectedFile.value
  if (!f) { trimRange.value = [0, 0]; return }
  const d = dur ? parseFloat(dur) : 0
  const start = f._trimStart || 0
  const end = f._trimEnd > 0 ? f._trimEnd : (d > 0 ? d : 0)
  trimRange.value = [start, end]
}, { immediate: true })
watch(selectedFile, (f) => {
  if (!f) { trimRange.value = [0, 0]; return }
  const d = f.format?.duration ? parseFloat(f.format.duration) : 0
  const start = f._trimStart || 0
  const end = f._trimEnd > 0 ? f._trimEnd : (d > 0 ? d : 0)
  trimRange.value = [start, end]
})

function onTrimChange(val) {
  const f = selectedFile.value
  if (!f) return
  f._trimStart = val[0]
  f._trimEnd = val[1]
}

function resetSelectedTrim() {
  const f = selectedFile.value
  if (!f) return
  f._trimStart = 0
  f._trimEnd = f.format?.duration ? parseFloat(f.format.duration) : 0
  trimRange.value = [f._trimStart, f._trimEnd]
}

/** 反选合并文件 */
function invertMergeSelection() {
  for (const f of store.mergeFiles) f._selected = !f._selected
}

/** 统一应用图片时长 */
function applyUnifiedDuration() {
  const d = unifiedDuration.value
  for (const f of store.mergeFiles) {
    if (isImageFile(f) && f._selected !== false) f._imgDuration = d
  }
  ElMessage.success(`已将 ${d.toFixed(1)}s 应用到 ${checkedImageList.value.length} 张图片`)
}

async function handleMerge() {
  if (store.mergeFiles.length < 2) return
  const op = store.mergeOperation
  if (!store.mergeSettings.outputFormat || store.mergeSettings.outputFormat === 'mp4') {
    if (op === 'audioConcat') store.mergeSettings.outputFormat = 'mp3'
    else if (op === 'imagesToGif') store.mergeSettings.outputFormat = 'gif'
  }
  store.mergeLogs = []
  await store.executeMerge()
  if (store.lastResult?.success) handleAfterMerge()
}

async function handleAfterMerge() {
  const global = loadSettings()
  const action = global.afterEncode || 'openFolder'
  if (action === 'none') return
  if (!isElectron) return

  const outputPath = store.lastResult?._mergeOutputPath
  if (!outputPath) return

  const target = action === 'openFolder'
    ? outputPath.replace(/[/\\][^/\\]*$/, '')
    : outputPath

  try {
    const res = await openExternalPath(target)
    if (res?.error) console.warn('打开输出目录失败:', res.error)
  } catch (e) {
    console.warn('打开输出目录失败:', e)
  }
}

function copyMergeLogs() {
  const text = store.mergeLogs.join('\n')
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('日志已复制')
  }).catch(() => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      ElMessage.success('日志已复制')
    } catch {
      ElMessage.warning('复制失败，请手动选择文本复制')
    }
  })
}

// 自动滚动合并日志
watch(() => store.mergeLogs.length, async () => {
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
})
</script>

<style scoped>
.merge-section { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.merge-scroll { flex: 1; overflow-y: auto; padding: 20px 24px 0; }

.section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 16px; font-weight: 600; color: var(--text-primary);
  margin-bottom: 14px;
}

.operation-bar {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 14px; padding: 12px 16px;
  background: var(--bg-surface);
  border-radius: 14px;
  box-shadow: var(--nm-shadow-inset-sm);
}
.mode-label { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }

.drop-zone {
  border-radius: 16px;
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  background: var(--bg-surface);
  margin-bottom: 14px;
  box-shadow: var(--nm-shadow-inset-sm);
  border: 2px dashed transparent;
}
.drop-zone:hover {
  border-color: var(--accent);
  box-shadow: var(--nm-shadow-inset), 0 0 0 1px var(--accent-soft);
}
.drop-zone.dragging {
  border-color: var(--accent);
  background: var(--bg-selected);
  box-shadow: var(--nm-shadow-inset);
}
.drop-icon { color: var(--text-tertiary); margin-bottom: 8px; }
.drop-title { font-size: 14px; color: var(--text-secondary); margin: 0; }

/* 文件列表 */
.file-list-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px; gap: 10px; flex-wrap: wrap;
}
.file-count { font-size: 12px; color: var(--text-secondary); }
.header-left { display: flex; align-items: center; gap: 10px; }
.file-list-actions { display: flex; align-items: center; gap: 6px; }
.process-count { font-size: 12px; color: var(--text-secondary); margin-right: 4px; }
.file-checkbox { margin-right: 2px; flex-shrink: 0; }

.file-card {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border-radius: 14px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: var(--nm-shadow-sm);
}
.file-card:hover {
  box-shadow: var(--nm-shadow);
  transform: translateY(-1px);
}
.file-card.selected {
  box-shadow: var(--nm-shadow-inset-sm);
  transform: translateY(0);
}
.file-card.unchecked { opacity: 0.55; }
.file-card.unchecked .file-order-badge { background: var(--text-tertiary); }

.file-order-badge {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff;
  border-radius: 50%; font-size: 11px; font-weight: 600;
  flex-shrink: 0;
  box-shadow: 2px 2px 5px rgba(212, 168, 67, 0.25);
}

.file-icon {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-surface);
  border-radius: 10px;
  color: var(--text-secondary);
  flex-shrink: 0;
  box-shadow: var(--nm-shadow-inset-sm);
}
.file-card.selected .file-icon {
  color: var(--accent);
  box-shadow: var(--nm-shadow-sm);
}

.file-info { flex: 1; min-width: 0; }
.file-trimmed { font-size: 11px; color: #57606f; font-weight: 400; }
.trimmed-duration { color: #57606f; }
:root.dark .file-trimmed { color: #b2bec3; }
:root.dark .trimmed-duration { color: #b2bec3; }
.file-name {
  font-size: 13px; font-weight: 500; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;
}
.file-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-tertiary); }
.trim-info { margin-top: 4px; }
.file-actions { display: flex; gap: 2px; flex-shrink: 0; }

/* 时间轴 */
.timeline-section {
  margin-top: 10px; padding: 16px;
  background: var(--bg-surface);
  border-radius: 16px;
  box-shadow: var(--nm-shadow-inset-sm);
}
.timeline-header {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 500; color: var(--text-primary);
  margin-bottom: 10px;
}
.dual-thumb-slider { display: flex; align-items: center; gap: 10px; padding: 4px 8px; }
.dual-thumb-slider .time-label { font-size: 12px; color: var(--text-secondary); font-variant-numeric: tabular-nums; min-width: 50px; }
.dual-thumb-slider .time-label:last-of-type { text-align: right; }
.dual-thumb-slider .thumb-slider { flex: 1; }
.trim-file-select { max-width: 260px; }

/* 输出设置 */
.merge-settings {
  margin-top: 14px; margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 14px;
}
.setting-card {
  background: var(--bg-surface);
  border-radius: 16px;
  padding: 18px;
  box-shadow: var(--nm-shadow-sm);
}
.setting-card:hover {
  box-shadow: var(--nm-shadow);
}
.card-header {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 600;
  margin-bottom: 14px;
}
.setting-row { display: flex; gap: 14px; flex-wrap: wrap; }
.setting-field { flex: 1; min-width: 140px; }
.setting-field.setting-checkbox { display: flex; align-items: center; justify-content: flex-start; min-width: auto; }
.setting-field.setting-checkbox label { margin-bottom: 0; width: auto; }

.hint { font-size: 11px; color: var(--text-tertiary); }
.setting-field label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.full-width { width: 100%; }

.gif-hint {
  display: flex; align-items: center; gap: 4px;
  margin-top: 8px; padding: 8px 12px;
  background: var(--bg-warning);
  border-radius: 10px;
  font-size: 11px; color: var(--warning);
}
.gif-hint .el-icon { font-size: 13px; flex-shrink: 0; }

/* 图片时长设置面板 */
.img-duration-panel { margin-top: 14px; }
.unified-duration-row {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 12px; padding-bottom: 12px;
}
.unified-label {
  font-size: 12px; color: var(--text-secondary);
  white-space: nowrap;
}
.img-duration-list {
  display: flex; flex-direction: column; gap: 6px;
}
.img-duration-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  background: var(--bg-surface);
  border-radius: 10px;
  font-size: 12px;
  box-shadow: var(--nm-shadow-inset-sm);
}
.dur-item-order {
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff;
  border-radius: 50%; font-size: 10px; font-weight: 600;
  flex-shrink: 0;
  box-shadow: 2px 2px 4px rgba(212, 168, 67, 0.25);
}
.dur-item-name {
  width: 160px; flex-shrink: 0;
  font-size: 12px; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dur-item-slider {
  flex: 1; min-width: 80px;
}
.dur-item-value {
  font-size: 11px; color: var(--text-tertiary);
  font-family: 'Consolas', monospace;
  flex-shrink: 0; min-width: 36px; text-align: right;
}

/* 命令预览 */
.command-block-wrapper { margin-bottom: 0; }
.command-block-wrapper :deep(.command-block) { margin-bottom: 0; }

/* 页面底部跟随滚动区域 */
.footer-block { padding: 4px 0 20px; }

/* 执行控制 */
.execution-area {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; margin-top: 12px;
}
.status-area { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.button-area { display: flex; gap: 8px; }
.progress-track { margin-bottom: 10px; }

.log-panel {
  border-radius: 14px;
  overflow: hidden;
  max-height: 200px;
  box-shadow: var(--nm-shadow-inset);
}
.log-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 14px;
  background: var(--bg-surface);
  font-size: 12px;
  box-shadow: 0 1px 0 var(--bg-dim);
}
.log-content {
  max-height: 150px; overflow-y: auto; padding: 10px 14px;
  background: var(--terminal-bg);
  font-family: 'Consolas', monospace;
  font-size: 11px; color: var(--terminal-text);
}
.log-line { padding: 1px 0; white-space: pre-wrap; word-break: break-all; }

.is-loading { animation: rotating 1.5s linear infinite; }
@keyframes rotating { to { transform: rotate(360deg); } }
.dot { color: var(--text-tertiary); opacity: 0.4; }
.error-text { color: var(--danger); }
</style>
