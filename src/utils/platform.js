// FFmpeg Studio — 平台适配层（Tauri v2）
const isTauri = () => !!(window.__TAURI_INTERNALS__ || window.__TAURI__)

function _invokeFn() {
  const t = window.__TAURI_INTERNALS__ || window.__TAURI__
  if (!t) return null
  return t.invoke || null
}

async function safeInvoke(cmd, args) {
  const inv = _invokeFn()
  if (!inv) throw new Error('Tauri not available')
  return await inv(cmd, args || {})
}

async function _listenEvent(event, cb) {
  const t = window.__TAURI_INTERNALS__ || window.__TAURI__
  if (t?.event?.listen) return await t.event.listen(event, cb)
  return () => {}
}

// ═══════════ 文件选择 ═══════════
export async function openFileSelector(filters) {
  if (isTauri()) {
    try {
      const paths = await safeInvoke('open_files')
      if (paths && paths.length) return paths.filter(Boolean).map(p => ({
        path: p, name: p.split(/[\\/]/).pop() || '', size: 0, ext: (p.split('.').pop() || '').toLowerCase()
      }))
    } catch (e) { console.warn('open_files:', e) }
  }
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'; input.multiple = true
    input.onchange = () => resolve(Array.from(input.files || []).map(f => ({
      path: f.path || '', name: f.name, size: f.size, ext: (f.name.split('.').pop() || '').toLowerCase()
    })))
    input.click()
  })
}

export async function openDirectory() {
  if (isTauri()) {
    try { return await safeInvoke('open_folder') || '' } catch { return '' }
  }
  return ''
}

// ═══════════ 媒体探测 ═══════════
export async function probeMedia(filePath) {
  // 入口保护：自动提取字符串路径
  const path = typeof filePath === 'string' ? filePath : (filePath?.path || filePath?.name || '')
  if (!path) return null

  if (isTauri()) {
    try { return await safeInvoke('probe_media', { filePath: path }) || null }
    catch (e) { return { error: String(e) } }
  }
  return null
}

// ═══════════ 本地存储 ═══════════
const SETTINGS_KEY = 'ffmpeg-studio-settings'
export function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} } }
export function saveSettings(obj) { const p = loadSettings(); localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...p, ...obj })) }

// ═══════════ 主题 ═══════════
export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) root.classList.add('dark')
  else root.classList.remove('dark')
}

// ═══════════ 命令行解析 ═══════════
export function parseArgs(cmd) {
  const args = []; let cur = '', iq = false, qc = ''
  for (const ch of cmd) {
    if (iq) { if (ch === qc) { iq = false; continue }; cur += ch }
    else if (ch === '"' || ch === "'") { iq = true; qc = ch }
    else if (ch === ' ' || ch === '\t') { if (cur) { args.push(cur); cur = '' } }
    else cur += ch
  }
  if (cur) args.push(cur)
  return args
}

export function noExt(filePath) {
  const name = filePath.replace(/^.*[\\/]/, '')
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.substring(0, dot) : name
}

export function extractDroppedFiles(e) {
  if (e.dataTransfer && e.dataTransfer.files) return Array.from(e.dataTransfer.files).map(f => ({
    path: f.path || '', name: f.name, size: f.size, ext: (f.name.split('.').pop() || '').toLowerCase(),
  }))
  return []
}

export function guessFileInfo(fileName, fileSize) {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  const audioExt = ['mp3','wav','aac','flac','ogg','m4a','wma','opus']
  const imageExt = ['jpg','jpeg','png','gif','webp','bmp','tiff']
  const type = audioExt.includes(ext) ? 'audio' : imageExt.includes(ext) ? 'image' : 'video'
  return {
    type, ext, size: fileSize || 0,
    format: null,
    streams: type === 'video' ? [{ codec_type: 'video' }] : type === 'audio' ? [{ codec_type: 'audio' }] : [],
  }
}

export async function openExternalPath(filePath) {
  if (isTauri()) {
    try { await safeInvoke('shell_open', { path: filePath }) } catch {}
  }
}

export function onMenuAction(cb) { return () => {} }

export const isElectron = isTauri()

// ═══════════ 通用工具函数 ═══════════

export function formatDuration(sec) {
  if (!sec || sec <= 0) return '00:00'
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
  }
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

export function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

export function isVideoFile(file) {
  if (!file) return false
  const ext = (file.name?.split('.').pop() || '').toLowerCase()
  const videoExts = ['mp4','mkv','avi','mov','flv','webm','wmv','ts','m4v','mka']
  if (videoExts.includes(ext)) return true
  const streams = file.streams || []
  return streams.some(s => s.codec_type === 'video')
}

export function isAudioFile(file) {
  if (!file) return false
  const ext = (file.name?.split('.').pop() || '').toLowerCase()
  const audioExts = ['mp3','wav','aac','flac','ogg','m4a','ac3','wma','opus','aiff','ape']
  if (audioExts.includes(ext)) return true
  const streams = file.streams || []
  return streams.some(s => s.codec_type === 'audio') && !streams.some(s => s.codec_type === 'video')
}

export function isImageFile(file) {
  if (!file) return false
  const ext = (file.name?.split('.').pop() || '').toLowerCase()
  const imageExts = ['jpg','jpeg','png','bmp','webp','tiff','gif']
  return imageExts.includes(ext)
}

export function getFileIcon(file) {
  if (isVideoFile(file)) return 'Film'
  if (isAudioFile(file)) return 'Headset'
  if (isImageFile(file)) return 'Picture'
  return 'Document'
}

// ═══════════ 硬件加速检测 ═══════════
let cachedHwAccels = null

export async function detectHardwareAccel(force = false) {
  if (!force && cachedHwAccels !== null) return cachedHwAccels

  const result = {
    cuda: false,
    qsv: false,
    amf: false,
    videotoolbox: false,
  }

  if (!isTauri()) {
    cachedHwAccels = result
    return result
  }

  try {
    // 调用后端 list_encoders 命令，同步执行 ffmpeg -encoders 并返回输出
    const output = await safeInvoke('list_encoders')
    if (output) {
      const encStr = String(output)
      if (encStr.includes('h264_nvenc')) result.cuda = true
      if (encStr.includes('h264_qsv')) result.qsv = true
      if (encStr.includes('h264_amf')) result.amf = true
      if (encStr.includes('h264_videotoolbox')) result.videotoolbox = true
    }
  } catch {
    // 后端命令失败时，根据平台做合理猜测
    const ua = navigator.userAgent.toLowerCase()
    const platform = navigator.platform.toLowerCase()
    if (platform.includes('mac') || ua.includes('mac')) result.videotoolbox = true
    if (platform.includes('win') || ua.includes('win')) {
      result.cuda = true
      result.qsv = true
      result.amf = true
    }
  }

  cachedHwAccels = result
  return result
}
