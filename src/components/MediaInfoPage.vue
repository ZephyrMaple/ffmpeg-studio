<template>
  <section class="media-info-page">
    <div class="page-scroll">
      <h2 class="page-title">
        <el-icon><InfoFilled /></el-icon>
        <span>媒体信息</span>
        <el-tag size="small" type="info">查看导入文件的详细元数据</el-tag>
      </h2>

      <!-- 文件列表区 -->
      <div class="file-area">
        <div v-if="files.length === 0" class="drop-zone" @click="browse" @dragover.prevent="dragOver=true" @dragleave="dragOver=false"
          @drop.prevent="handleDrop" :class="{ dragging: dragOver }">
          <el-icon :size="32"><UploadFilled /></el-icon>
          <p>拖拽文件到此处，或点击选择</p>
        </div>
        <div v-else class="file-card-list">
          <div
            v-for="(f, i) in files" :key="i"
            class="file-card" :class="{ active: f === activeFile, guessed: f._guessed, error: f._error }"
            @click="activeFile = f"
          >
            <div class="file-icon" :style="{ color: iconColor(f) }">
              <el-icon :size="24"><component :is="fileIcon(f)" /></el-icon>
            </div>
            <div class="file-meta">
              <div class="file-name">{{ f.name }}</div>
              <div class="file-info">
                <span>{{ fmtDuration(f.format?.duration) || '--' }}</span>
                <span class="info-sep">·</span>
                <span>{{ fmtSize(f.format?.size) || '--' }}</span>
                <template v-if="videoCodec(f)">
                  <span class="info-sep">·</span><span>{{ videoCodec(f) }}</span>
                </template>
                <template v-else-if="audioCodec(f)">
                  <span class="info-sep">·</span><span>{{ audioCodec(f) }}</span>
                </template>
                <template v-if="f._guessed">
                  <span class="info-sep">·</span>
                  <span class="info-guess">分析中...</span>
                </template>
                <template v-if="f._error">
                  <span class="info-sep">·</span>
                  <span class="info-error">分析失败</span>
                </template>
              </div>
            </div>
            <el-button class="file-remove" text size="small" @click.stop="removeFile(i)">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <!-- 选中文件的详细分析（内嵌在文件名组件内）-->
      <div v-if="activeFile" class="info-detail">
        <!-- 格式信息（默认展开）-->
        <div class="detail-section">
          <div class="section-header" @click="section.format = !section.format">
            <el-icon><document-icon /></el-icon>
            <span>格式信息</span>
            <el-icon class="toggle-icon"><component :is="section.format ? 'ArrowDown' : 'ArrowRight'" /></el-icon>
          </div>
          <div v-if="section.format" class="section-body">
            <div class="info-grid">
              <div class="info-cell"><label>文件名</label><span>{{ activeFile.format?.filename || activeFile.name }}</span></div>
              <div class="info-cell"><label>格式</label><span>{{ activeFile.format?.format_name || '--' }}</span></div>
              <div class="info-cell"><label>时长</label><span>{{ fmtDuration(activeFile.format?.duration) }}</span></div>
              <div class="info-cell"><label>大小</label><span>{{ fmtSize(activeFile.format?.size) }}</span></div>
              <div class="info-cell"><label>总码率</label><span>{{ activeFile.format?.bit_rate ? fmtBitrate(activeFile.format.bit_rate) : '--' }}</span></div>
              <div class="info-cell"><label>编码器</label><span>{{ activeFile.format?.encoder || '--' }}</span></div>
            </div>
          </div>
        </div>

        <!-- 流元数据（仅音视频，默认展开）-->
        <div v-if="isMediaFile" class="detail-section">
          <div class="section-header" @click="section.streams = !section.streams">
            <el-icon><Files /></el-icon>
            <span>流元数据 ({{ activeFile.streams?.length || 0 }} 条)</span>
            <el-icon class="toggle-icon"><component :is="section.streams ? 'ArrowDown' : 'ArrowRight'" /></el-icon>
          </div>
          <div v-if="section.streams" class="section-body">
            <div v-for="(s, i) in activeFile.streams" :key="i" class="stream-block">
              <div class="stream-title">
                <span class="stream-type">{{ streamTypeLabel(s.codec_type) }}</span>
              </div>
              <div class="info-grid">
                <div class="info-cell"><label>编码</label><span>{{ s.codec_name || '--' }}{{ s.codec_tag_string ? ` (${s.codec_tag_string})` : '' }}</span></div>
                <template v-if="s.codec_type==='video'">
                  <div class="info-cell"><label>分辨率</label><span>{{ s.width || '-' }} × {{ s.height || '-' }}</span></div>
                  <div class="info-cell"><label>帧率</label><span>{{ evalFps(s.r_frame_rate) }} fps</span></div>
                  <div class="info-cell"><label>像素格式</label><span>{{ s.pix_fmt || '--' }}</span></div>
                  <div class="info-cell"><label>色域</label><span>{{ s.color_space || '-' }} / {{ s.color_transfer || '-' }}</span></div>
                  <div class="info-cell"><label>档次/级别</label><span>{{ s.profile || '-' }} / {{ s.level || '-' }}</span></div>
                </template>
                <template v-if="s.codec_type==='audio'">
                  <div class="info-cell"><label>采样率</label><span>{{ s.sample_rate || '-' }} Hz</span></div>
                  <div class="info-cell"><label>声道</label><span>{{ s.channels || '-' }}ch ({{ s.channel_layout || '-' }})</span></div>
                  <div class="info-cell"><label>帧大小</label><span>{{ s.frame_size || '-' }}</span></div>
                </template>
                <div class="info-cell"><label>码率</label><span>{{ s.bit_rate ? fmtBitrate(s.bit_rate) : '--' }}</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 帧分析（仅视频，默认折叠：先后缀判断再探测确认）-->
        <div v-if="(isVideoByExt || hasVideoStream) && !isImageExt" class="detail-section">
          <div class="section-header" @click="section.frames = !section.frames">
            <el-icon><VideoPlay /></el-icon>
            <span>帧分析</span>
            <el-icon class="toggle-icon"><component :is="section.frames ? 'ArrowDown' : 'ArrowRight'" /></el-icon>
          </div>
          <div v-if="section.frames" class="section-body">
            <div class="frame-slider">
              <div class="slider-header">
                <span class="slider-label">当前时间位置</span>
                <span class="slider-time">{{ fmtDuration(frameTime) }}</span>
              </div>
              <el-slider v-model="frameTime" :min="0" :max="fileDuration" :step="0.1" :format-tooltip="v => fmtDuration(v)" />
              <div class="info-grid info-grid-4" style="margin-top:14px">
                <div class="info-cell"><label>帧索引（估计）</label><span>#{{ frameIndex }}</span></div>
                <div class="info-cell"><label>帧率</label><span>{{ frameFps }} fps</span></div>
                <div class="info-cell"><label>帧时间码</label><span>{{ fmtTimecode(frameTime) }}</span></div>
                <div class="info-cell"><label>估计帧大小</label><span>{{ videoStream ? '~' + fmtBitrate(videoStream.bit_rate) : '--' }}</span></div>
              </div>
              <el-tag type="info" size="small" style="margin-top:10px">
                💡 拖动滑动条可即时查看视频帧信息
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 命令 + 日志 -->
      <div v-if="files.length > 0" class="info-extras">
        <CommandBlock v-if="probeCommand" :command="probeCommand" />
        <ProgressBar
          :logs="probeLogs"
          :show-execute="false"
          execute-label="分析"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue'
import {
  InfoFilled, UploadFilled, Close, VideoCamera, Headset, Picture, Film,
  Files, VideoPlay, ArrowDown, ArrowRight
} from '@element-plus/icons-vue'
import { openFileSelector, extractDroppedFiles, probeMedia, isElectron, guessFileInfo } from '@/utils/platform'
import CommandBlock from '@/components/CommandBlock.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const files = ref([])
const activeFile = ref(null)
const dragOver = ref(false)
const section = reactive({ format: true, streams: true, frames: false })
const frameTime = ref(0)
const probeCommand = ref('')
const probeLogs = ref([])

// ── 辅助函数 ──
function fmtDuration(sec) {
  if (!sec || sec <= 0) return '--'
  const s = parseFloat(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec2 = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec2).padStart(2,'0')}`
  return `${m}:${String(sec2).padStart(2,'0')}`
}
function fmtSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const b = parseInt(bytes)
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b/1024).toFixed(0) + ' KB'
  return (b/1048576).toFixed(1) + ' MB'
}
function fmtBitrate(b) { return b ? (parseInt(b)/1000).toFixed(0) + ' kb/s' : '--' }
function fmtTimecode(sec) {
  const s = parseFloat(sec || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const s2 = s % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${s2.toFixed(2).padStart(5,'0')}`
}
function evalFps(r) { if (!r) return 0; const p = r.split('/'); return p.length === 2 ? (parseInt(p[0])/parseInt(p[1])).toFixed(2) : r }
function videoCodec(f) {
  if (!f?.streams) return ''
  const v = f.streams.find(s => s.codec_type === 'video')
  return v?.codec_name ? v.codec_name.toUpperCase() : ''
}
function audioCodec(f) {
  if (!f?.streams) return ''
  const a = f.streams.find(s => s.codec_type === 'audio')
  return a?.codec_name ? a.codec_name.toUpperCase() : ''
}
function fileIcon(f) {
  if (!f?.streams) return Picture
  const hasVideo = f.streams.some(s => s.codec_type === 'video')
  const hasAudio = f.streams.some(s => s.codec_type === 'audio')
  if (hasVideo && hasAudio) return Film
  if (hasVideo) return VideoCamera
  if (hasAudio) return Headset
  return Picture
}
function iconColor(f) {
  if (!f?.streams) return 'var(--text-tertiary)'
  const hasVideo = f.streams.some(s => s.codec_type === 'video')
  const hasAudio = f.streams.some(s => s.codec_type === 'audio')
  if (hasVideo && hasAudio) return 'var(--accent)'
  if (hasVideo) return 'var(--el-color-primary-light-3)'
  if (hasAudio) return 'var(--danger)'
  return 'var(--success)'
}
function streamTypeLabel(type) {
  if (type === 'video') return '视频流'
  if (type === 'audio') return '音频流'
  if (type === 'subtitle') return '字幕流'
  return type || '流'
}

// ── 计算属性 ──
const videoStream = computed(() => activeFile.value?.streams?.find(s => s.codec_type === 'video'))
const hasVideoStream = computed(() => !!videoStream.value)
const isMediaFile = computed(() => {
  const f = activeFile.value
  if (!f) return false
  if (isImageExt.value) return false
  const ext = (f.name || '').split('.').pop().toLowerCase()
  // 音视频后缀快速判断
  const mediaExts = ['mp4','mkv','avi','mov','flv','webm','wmv','ts','m4v','mp3','wav','aac','flac','ogg','m4a','ac3','wma','opus','aiff','ape']
  if (mediaExts.includes(ext)) return true
  // 探测结果精确判断
  return f.streams?.some(s => s.codec_type === 'video' || s.codec_type === 'audio')
})
const isVideoByExt = computed(() => {
  const ext = (activeFile.value?.name || '').split('.').pop().toLowerCase()
  if (imageExts.includes(ext)) return false
  return ['mp4','mkv','avi','mov','flv','webm','wmv','ts','m4v'].includes(ext)
})
const imageExts = ['jpg','jpeg','png','bmp','webp','gif','tiff','tif','svg','ico']
const isImageExt = computed(() => {
  const ext = (activeFile.value?.name || '').split('.').pop().toLowerCase()
  return imageExts.includes(ext)
})
const fileDuration = computed(() => parseFloat(activeFile.value?.format?.duration) || 0)
const frameFps = computed(() => videoStream.value ? evalFps(videoStream.value.r_frame_rate) : 0)
const frameIndex = computed(() => Math.floor(frameTime.value * (parseFloat(frameFps.value) || 0)))

// 切换文件时重置滑动条
watch(activeFile, (f) => {
  if (f) frameTime.value = parseFloat(f.format?.duration) * 0.1 || 0
})

// ── 文件管理 + 自动分析 ──
async function browse() {
  const list = await openFileSelector()
  if (list?.length) addFiles(list)
}

function handleDrop(e) {
  dragOver.value = false
  const list = extractDroppedFiles(e)
  if (list?.length) addFiles(list)
}

function addFiles(list) {
  for (const input of list) {
    const isPath = typeof input === 'string'
    const filePath = isPath ? input : (input.path || '')
    const fileName = isPath ? input.split(/[\\/]/).pop() : input.name
    const fileSize = isPath ? 0 : input.size

    if (files.value.some(f => f.path === filePath && filePath)) continue

    const guess = guessFileInfo(fileName, fileSize)
    const entry = reactive({
      path: filePath, name: fileName, size: fileSize,
      format: guess.format, streams: guess.streams,
      _guessed: true, _error: '',
      _fileObj: isPath ? null : input,
    })
    files.value.push(entry)
    if (!activeFile.value) activeFile.value = entry

    // 自动分析（传 filePath 字符串，不是 input 对象）
    probeFile(entry, filePath)
  }
}

async function probeFile(entry, filePath) {
  if (!filePath) return
  probeCommand.value = `ffprobe -v error -show_format -show_streams -print_format json "${filePath}"`
  probeLogs.value = [`$ ${probeCommand.value}`, '正在解析媒体元数据...']
  try {
    const info = await probeMedia(filePath)
    if (info.error) {
      entry._error = info.error
      probeLogs.value.push(`错误: ${info.error}`)
      return
    }
    entry.format = info.format
    entry.streams = info.streams || []
    if (!entry.size && info.format?.size) entry.size = parseInt(info.format.size) || 0
    entry._guessed = false
    probeLogs.value.push(`✓ 解析完成`)
    probeLogs.value.push(`格式: ${info.format?.format_long_name || info.format?.format_name || '?'}`)
    probeLogs.value.push(`时长: ${info.format?.duration || '?'}s · 大小: ${info.format?.size || '?'}B`)
    probeLogs.value.push(`流数量: ${(info.streams || []).length}`)
  } catch (e) {
    entry._error = String(e)
    probeLogs.value.push(`异常: ${e}`)
  }
}

function removeFile(i) {
  files.value.splice(i, 1)
  if (activeFile.value && !files.value.includes(activeFile.value)) {
    activeFile.value = files.value[0] || null
  }
}
</script>

<style scoped>
.media-info-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.page-scroll { flex: 1; overflow-y: auto; }
.page-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; padding: 20px 24px 14px; color: var(--text-primary); }
.file-area { padding: 0 24px 14px; }
.drop-zone {
  border-radius: 16px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  background: var(--bg-surface);
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
.drop-zone p { font-size: 13px; color: var(--text-secondary); margin: 8px 0 0; }
.info-extras { margin: 0 24px 14px; display:flex; flex-direction:column; gap:14px; }
.file-card-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.file-card {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 16px;
  background: var(--bg-surface);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: var(--nm-shadow-sm);
  border: none;
}
.file-card:hover {
  box-shadow: var(--nm-shadow);
  transform: translateY(-1px);
}
.file-card.active {
  box-shadow: var(--nm-shadow-inset-sm);
  background: var(--bg-selected);
}
.file-card.error { background: var(--bg-error); box-shadow: var(--nm-shadow-sm); }
.file-card.guessed { background: var(--bg-warning); box-shadow: var(--nm-shadow-sm); }
.file-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.file-meta { flex: 1; min-width: 0; }
.file-name { font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-info { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.file-info .info-sep { color: var(--border-color); }
.file-info .info-guess { color: var(--warning); }
.file-info .info-error { color: var(--danger); }
.file-remove { color: var(--text-tertiary); }
.file-remove:hover { color: var(--danger); }

.info-detail { padding: 0 24px 24px; }
.detail-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
}
.section-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 18px; cursor: pointer; user-select: none;
  font-size: 14px; font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}
.section-header:hover { background: var(--bg-hover); }
.section-header .toggle-icon { margin-left: auto; color: var(--text-tertiary); }
.section-body { padding: 14px 18px; }
.info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.info-grid-4 { grid-template-columns: repeat(4, 1fr); }
.info-cell { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: var(--bg-hover); border-radius: 6px; }
.info-cell label { font-size: 11px; color: var(--text-tertiary); }
.info-cell span { font-size: 12px; color: var(--text-primary); word-break: break-all; }
.stream-block { margin-bottom: 14px; padding: 10px 12px; background: var(--bg-hover); border-radius: 8px; }
.stream-block:last-child { margin-bottom: 0; }
.stream-title { font-size: 13px; font-weight: normal; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; color: var(--text-secondary); }
.stream-type { font-weight: normal; }

.frame-slider { padding: 6px 0; }
.slider-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.slider-label { font-size: 12px; color: var(--text-tertiary); }
.slider-time { font-size: 13px; font-weight: 600; color: var(--accent); }
</style>