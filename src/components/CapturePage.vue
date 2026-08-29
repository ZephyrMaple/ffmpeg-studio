<template>
  <ToolPageShell ref="shell" title="设备采集" icon="Monitor" :files="[]" :command="command"
    :can-execute="canExec" :show-file-select="false"
    @execute="doExec">
    <template #hint><el-tag size="small" type="warning">屏幕/摄像头/麦克风 实时录制</el-tag></template>
    <template #toolbar>
      <div class="settings-grid">
        <div class="setting-card"><div class="card-header">采集源</div>
          <el-radio-group v-model="captureMode" style="width:100%">
            <el-radio-button value="screen">屏幕录制</el-radio-button>
            <el-radio-button value="camera">摄像头</el-radio-button>
            <el-radio-button value="audio">仅音频</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 屏幕录制参数 -->
        <div class="setting-card" v-if="captureMode==='screen'"><div class="card-header">录制参数</div>
          <el-form label-position="top">
            <div class="form-row capture-row">
              <el-form-item label="录制区域" style="flex:0 0 auto">
                <el-radio-group v-model="screenArea">
                  <el-radio-button value="full">全屏</el-radio-button>
                  <el-radio-button value="window">活动窗口</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="帧率" style="flex:0 0 100px">
                <el-select v-model="captureFps" style="width:100%" filterable allow-create default-first-option>
                  <el-option v-for="f in FPS_PRESETS" :key="f" :value="String(f)" :label="`${f} fps`"/>
                </el-select>
              </el-form-item>
              <el-form-item label="录制时长" style="flex:1 1 160px">
                <el-input v-model="captureDuration" placeholder="留空=手动停止（按 Q）" @blur="fmtDuration" />
              </el-form-item>
              <el-form-item label="采集音频" style="flex:0 0 auto; align-self:flex-end">
                <el-checkbox v-model="captureAudio" label="同时录制系统音频" />
              </el-form-item>
            </div>
          </el-form>
        </div>

        <!-- 摄像头录制参数 -->
        <div class="setting-card" v-if="captureMode==='camera'"><div class="card-header">录制参数</div>
          <el-form label-position="top">
            <div class="form-row capture-row">
              <el-form-item label="摄像头设备" style="flex:1 1 200px">
                <div class="device-select-row">
                  <el-select v-model="cameraDevice" style="flex:1" placeholder="选择摄像头" @change="onCameraChange">
                    <el-option v-for="d in cameraDevices" :key="d.deviceId" :label="d.label || ('摄像头 ' + (d.index + 1))" :value="d.label || ('摄像头 ' + (d.index + 1))" />
                  </el-select>
                  <el-button :icon="Refresh" circle size="small" @click="refreshCameraDevices" title="刷新设备列表" />
                </div>
              </el-form-item>
              <el-form-item label="分辨率" style="flex:0 0 120px">
                <el-select v-model="cameraRes" style="width:100%" placeholder="选择分辨率">
                  <el-option v-for="r in availableResolutions" :key="r" :label="r" :value="r" />
                </el-select>
              </el-form-item>
              <el-form-item label="帧率" style="flex:0 0 100px">
                <el-select v-model="captureFps" style="width:100%" filterable allow-create default-first-option>
                  <el-option v-for="f in FPS_PRESETS" :key="f" :value="String(f)" :label="`${f} fps`"/>
                </el-select>
              </el-form-item>
              <el-form-item label="录制时长" style="flex:1 1 140px">
                <el-input v-model="captureDuration" placeholder="留空=手动停止" @blur="fmtDuration" />
              </el-form-item>
            </div>
            <div v-if="!cameraDevices.length" class="hint">未检测到摄像头，请确认设备已连接</div>
          </el-form>
        </div>

        <!-- 仅音频录制参数 -->
        <div class="setting-card" v-if="captureMode==='audio'"><div class="card-header">录制参数</div>
          <el-form label-position="top">
            <div class="form-row capture-row">
              <el-form-item label="音频输入设备" style="flex:1 1 300px">
                <div class="device-select-row">
                  <el-select v-model="audioDevice" style="flex:1" placeholder="选择音频输入设备">
                    <el-option v-for="d in audioDevices" :key="d.deviceId" :label="d.label || ('麦克风 ' + (d.index + 1))" :value="d.label || ('麦克风 ' + (d.index + 1))" />
                  </el-select>
                  <el-button :icon="Refresh" circle size="small" @click="refreshAudioDevices" title="刷新设备列表" />
                </div>
              </el-form-item>
              <el-form-item label="录制时长" style="flex:1 1 160px">
                <el-input v-model="captureDuration" placeholder="留空=手动停止（按 Q）" @blur="fmtDuration" />
              </el-form-item>
            </div>
            <div v-if="!audioDevices.length" class="hint">未检测到音频输入设备</div>
          </el-form>
        </div>

        <el-alert type="warning" :closable="false" show-icon>
          <template #title>录制中按 Q 键停止，或点击「停止」按钮。</template>
        </el-alert>

        <div class="setting-card hint-card">
          <div class="card-header">跨平台说明</div>
          <ul>
            <li>Windows: 屏幕=gdigrab, 摄像头/麦克风=dshow</li>
            <li>macOS: avfoundation（屏幕+摄像头+麦克风）</li>
            <li>Linux: x11grab（屏幕）, v4l2（摄像头）, alsa/pulse（音频）</li>
          </ul>
        </div>
      </div>
    </template>
    <template #outputSettings>
      <OutputSettings
        :format="outFmt"
        :formats="outputFormats"
        :outputDir="outputDir"
        :outputFileName="outputFileName"
        :sourceDir="sourceDir"
        @update:format="outFmt=$event"
        @update:outputDir="outputDir=$event"
        @update:outputFileName="outputFileName=$event"
        @browse="browseOutputDir"
      />
    </template>
  </ToolPageShell>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import OutputSettings from '@/components/OutputSettings.vue'
import ToolPageShell from '@/components/ToolPageShell.vue'
import { Refresh } from '@element-plus/icons-vue'
import { parseArgs, loadSettings, openDirectory } from '@/utils/platform'
import { parseTime, FPS_PRESETS } from '@/utils/ffmpegCommand'
import { ElMessage } from 'element-plus'

const shell = ref(null)
const captureMode = ref('screen')
const screenArea = ref('full')
const captureFps = ref('30')
const captureAudio = ref(true)
const cameraDevice = ref('')
const cameraRes = ref('1280x720')
const audioDevice = ref('')
const captureDuration = ref('')
const outFmt = ref('mp4')
const globalSettings = { ...loadSettings() }; const outputDir = ref(globalSettings.defaultOutputDir || '')
const outputFileName = ref('')
const sourceDir = ref('')

const cameraDevices = ref([])
const audioDevices = ref([])

const COMMON_RESOLUTIONS = [
  '1920x1080', '1280x720', '854x480', '640x480', '320x240'
]

const availableResolutions = ref([...COMMON_RESOLUTIONS])

const outputFormats = computed(() => {
  if (captureMode.value === 'audio') {
    return [
      { value: 'mp3', label: 'MP3' },
      { value: 'wav', label: 'WAV' },
      { value: 'aac', label: 'AAC' },
      { value: 'flac', label: 'FLAC' },
      { value: 'ogg', label: 'OGG' },
    ]
  }
  return [
    { value: 'mp4', label: 'MP4' },
    { value: 'mkv', label: 'MKV' },
    { value: 'avi', label: 'AVI' },
    { value: 'mov', label: 'MOV' },
  ]
})

const canExec = computed(() => {
  if (captureMode.value === 'camera' && !cameraDevice.value && cameraDevices.value.length === 0) return false
  if (captureMode.value === 'audio' && !audioDevice.value && audioDevices.value.length === 0) return false
  return true
})

function fmtDuration() {
  if (!captureDuration.value) return
  const t = parseTime(captureDuration.value)
  if (t !== null && t > 0) {
    captureDuration.value = fmtSec(t)
  }
}

function fmtSec(s) {
  if (!s || s <= 0) return '0'
  if (s < 60) return String(Math.round(s * 10) / 10)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60 * 10) / 10
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}

async function enumerateDevices() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
    // 先尝试获取权限以获得设备名称（失败也不影响，只是名字为空）
    try {
      if (navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        // 立即停止，只是为了获取权限
        stream.getTracks().forEach(t => t.stop())
      }
    } catch {
      // 用户拒绝或不支持，继续无权限枚举
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    let camIdx = 0, audIdx = 0
    cameraDevices.value = devices
      .filter(d => d.kind === 'videoinput')
      .map(d => ({ ...d, index: camIdx++ }))
    audioDevices.value = devices
      .filter(d => d.kind === 'audioinput')
      .map(d => ({ ...d, index: audIdx++ }))
    if (cameraDevices.value.length > 0 && !cameraDevice.value) {
      cameraDevice.value = cameraDevices.value[0].label || `摄像头 ${cameraDevices.value[0].index + 1}`
    }
    if (audioDevices.value.length > 0 && !audioDevice.value) {
      audioDevice.value = audioDevices.value[0].label || `麦克风 ${audioDevices.value[0].index + 1}`
    }
  } catch (e) {
    console.warn('设备枚举失败:', e)
  }
}

async function refreshCameraDevices() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) { ElMessage.warning('当前环境不支持摄像头'); return }
    // 请求摄像头权限以获取设备名称
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach(t => t.stop())
    await enumerateDevices()
    ElMessage.success('摄像头设备列表已刷新')
  } catch(e) {
    ElMessage.warning('获取摄像头权限失败: ' + (e.message || e))
  }
}

async function refreshAudioDevices() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) { ElMessage.warning('当前环境不支持音频'); return }
    // 请求麦克风权限以获取设备名称
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(t => t.stop())
    await enumerateDevices()
    ElMessage.success('音频设备列表已刷新')
  } catch(e) {
    ElMessage.warning('获取麦克风权限失败: ' + (e.message || e))
  }
}

// 模式切换时，如果是摄像头或音频模式，且设备名为空，尝试刷新
watch(captureMode, (mode) => {
  if (mode === 'camera' && (!cameraDevices.value.length || !cameraDevices.value[0]?.label)) {
    refreshCameraDevices().catch(() => {})
  } else if (mode === 'audio' && (!audioDevices.value.length || !audioDevices.value[0]?.label)) {
    refreshAudioDevices().catch(() => {})
  }
})

function onCameraChange() {
  availableResolutions.value = [...COMMON_RESOLUTIONS]
}

const command = computed(() => {
  const durSec = parseTime(captureDuration.value)
  const dur = (durSec && durSec > 0) ? ` -t ${durSec}` : ''
  const out = outputFileName.value || `capture_${Date.now()}`
  const fmt = outFmt.value

  if (captureMode.value === 'screen') {
    const audio = captureAudio.value ? ' -f dshow -i audio="virtual-audio-capturer"' : ' -an'
    const input = screenArea.value === 'window' ? 'title=Calculator' : 'desktop'
    return `ffmpeg -y -f gdigrab -framerate ${captureFps.value || 30} -i ${input}${audio}${dur} "${out}.${fmt}"`
  }
  if (captureMode.value === 'camera') {
    const dev = cameraDevice.value ? `video="${cameraDevice.value}"` : 'video="Integrated Camera"'
    const [w, h] = cameraRes.value.split('x')
    return `ffmpeg -y -f dshow -video_size ${w}x${h} -framerate ${captureFps.value || 30} -i ${dev}${dur} "${out}.${fmt}"`
  }
  if (captureMode.value === 'audio') {
    const dev = audioDevice.value ? `audio="${audioDevice.value}"` : 'audio="Microphone"'
    const codecMap = { mp3: 'libmp3lame', aac: 'aac', flac: 'flac', ogg: 'libvorbis', wav: 'pcm_s16le' }
    const encoder = codecMap[fmt] || 'libmp3lame'
    return `ffmpeg -y -f dshow -i ${dev}${dur} -c:a ${encoder} "${out}.${fmt}"`
  }
  return ''
})

async function browseOutputDir() {
  const dir = await openDirectory()
  if (dir) outputDir.value = dir
}

async function doExec() {
  if (!command.value || !shell.value) return
  const args = parseArgs(command.value).filter(a => a !== 'ffmpeg')
  await shell.value.runner.execute(args)
}

onMounted(() => {
  enumerateDevices()
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices)
  }
})
</script>
<style scoped>
.hint { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.4; }
.hint-card ul { margin:0; padding-left: 16px; font-size: 12px; line-height: 1.8; color: var(--text-secondary); }
.capture-row { flex-wrap: nowrap !important; }
.capture-row :deep(.el-form-item) { margin-bottom: 0; }
.device-select-row { display: flex; gap: 8px; align-items: center; width: 100%; }
</style>
