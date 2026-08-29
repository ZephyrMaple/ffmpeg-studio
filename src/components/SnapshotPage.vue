<template>
  <ToolPageShell ref="shell" title="截图与 GIF" icon="Picture" :files="files" :command="command"
    :can-execute="canExec" :active-file="activeFile" @add-files="addFiles" @remove-file="removeFile"
    @execute="doExec">
    <template #hint><el-tag size="small" type="info">从视频中截取画面或生成 GIF 动图</el-tag></template>
    <template #toolbar>
      <div class="settings-grid" style="padding:0">
        <div class="setting-card"><div class="card-header">操作模式</div>
          <el-radio-group v-model="mode" style="width:100%">
            <el-radio-button value="snapshot">单帧截图</el-radio-button>
            <el-radio-button value="gif">生成 GIF</el-radio-button>
            <el-radio-button value="thumbnails">批量截图</el-radio-button>
          </el-radio-group>
        </div>
        <div class="setting-card" v-if="mode==='snapshot'"><div class="card-header">截图参数</div>
          <el-form label-position="top">
            <div class="form-row">
              <el-form-item label="截取时间点（秒）">
                <el-input v-model.number="snapshotTimeDisplay" @input="onSnapshotTimeInput" @blur="fmtSnapshotTime" placeholder="如 10.5" />
              </el-form-item>
              <el-form-item label="帧序号">
                <el-input-number v-model.number="snapshotFrame" :min="0" :step="1" @change="onSnapshotFrameChange" style="width:100%" controls-position="right" />
              </el-form-item>
              <el-form-item label="尺寸"><el-input v-model="snapshotSize" placeholder="留空=原始, 如 640:480" /></el-form-item>
            </div>
          </el-form>
        </div>
        <div class="setting-card" v-if="mode==='gif'"><div class="card-header">GIF 参数</div>
          <el-form label-position="top">
            <div class="form-row">
              <el-form-item label="起始时间"><el-input v-model="gifStart" @blur="validateGifStart(gifStart)" :class="{ 'is-error': gifStartErr }" placeholder="0" /></el-form-item>
              <el-form-item label="持续时间"><el-input v-model="gifDuration" @blur="validateGifDuration(gifDuration)" :class="{ 'is-error': gifDurationErr }" placeholder="5" /></el-form-item>
              <el-form-item label="帧率"><el-input v-model="gifFps" @blur="validateGifFps(gifFps)" :class="{ 'is-error': gifFpsErr }" placeholder="10" /></el-form-item>
              <el-form-item label="尺寸">
                <el-select v-model="gifSize" placeholder="原始尺寸" clearable style="width:100%">
                  <el-option value="" label="原始尺寸" />
                  <el-option value="1920:1080" label="1080p (1920×1080)" />
                  <el-option value="1280:720" label="720p (1280×720)" />
                  <el-option value="854:480" label="480p (854×480)" />
                  <el-option value="640:360" label="360p (640×360)" />
                  <el-option value="426:240" label="240p (426×240)" />
                  <el-option value="480:270" label="480×270" />
                  <el-option value="320:180" label="320×180" />
                </el-select>
              </el-form-item>
            </div>
          </el-form>
          <el-tag type="warning" size="small">💡 GIF 体积较大时建议降低分辨率和帧率</el-tag>
        </div>
        <div class="setting-card" v-if="mode==='thumbnails'"><div class="card-header">批量截图参数</div>
          <el-form label-position="top">
            <div class="form-row">
              <el-form-item label="间隔方式">
                <el-radio-group v-model="thumbMode">
                  <el-radio-button value="time">时间间隔</el-radio-button>
                  <el-radio-button value="frame">帧间隔</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item v-if="thumbMode==='time'" label="时间间隔（秒）">
                <el-input v-model.number="thumbTimeInterval" @input="onThumbTimeInput" @blur="fmtThumbTime" placeholder="如 10.0" />
              </el-form-item>
              <el-form-item v-if="thumbMode==='frame'" label="帧间隔（帧）">
                <el-input-number v-model.number="thumbFrameInterval" :min="1" :step="1" @change="onThumbFrameChange" style="width:100%" controls-position="right" />
              </el-form-item>
            </div>
          </el-form>
        </div>
      </div>
    </template>
    <template #outputSettings>
      <OutputSettings
        :format="outFmt"
        :formats="availableFormats"
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
import { ref, computed, watch } from 'vue'
import OutputSettings from '@/components/OutputSettings.vue'
import { FolderOpened } from '@element-plus/icons-vue'
import ToolPageShell from '@/components/ToolPageShell.vue'
import { parseArgs, loadSettings, openDirectory, openExternalPath } from '@/utils/platform'
import { generateOutputPath } from '@/utils/ffmpegCommand'
import { validateNumber, validateSize } from '@/utils/validators'
import { useValidate } from '@/utils/useValidate'
import { useFileManager } from '@/utils/useFileManager'

const { files, activeFile, addFiles, removeFile } = useFileManager()
const shell = ref(null)
const mode = ref('snapshot')

// 单帧截图
const snapshotTime = ref(5) // 内部秒数
const snapshotTimeDisplay = ref('5') // 显示值
const snapshotFrame = ref(150) // 帧序号
const snapshotSize = ref('')
const { error: snapshotSizeErr, check: validateSnapshotSize } = useValidate(validateSize)

// GIF
const { error: gifStartErr, check: validateGifStart } = useValidate(validateNumber)
const gifStart = ref('0')
const { error: gifDurationErr, check: validateGifDuration } = useValidate(validateNumber)
const gifDuration = ref('5')
const { error: gifFpsErr, check: validateGifFps } = useValidate(validateNumber)
const gifFps = ref('10')
const gifSize = ref('')

// 批量截图
const thumbMode = ref('time') // time | frame
const thumbTimeInterval = ref(10) // 秒
const thumbFrameInterval = ref(300) // 帧

// 输出
const outFmt = ref('jpg')
const imageFormats = [
  { value: 'jpg', label: 'JPG', desc: '有损压缩，体积小' },
  { value: 'png', label: 'PNG', desc: '无损压缩，支持透明' },
  { value: 'webp', label: 'WebP', desc: '高压缩比' },
  { value: 'bmp', label: 'BMP', desc: '无压缩' },
  { value: 'tiff', label: 'TIFF', desc: '高质量，专业' },
  { value: 'jpeg', label: 'JPEG', desc: '同 JPG' },
]
const gifOnlyFormats = [{ value: 'gif', label: 'GIF', desc: '动图' }]
const availableFormats = computed(() => mode.value === 'gif' ? gifOnlyFormats : imageFormats)

// 模式切换时同步格式
watch(mode, (m) => {
  if (m === 'gif') outFmt.value = 'gif'
  else if (outFmt.value === 'gif') outFmt.value = 'jpg'
})

const globalSettings = { ...loadSettings() }; const outputDir = ref(globalSettings.defaultOutputDir || '')
const outputFileName = ref('')
const sourceDir = computed(() => {
  const f = files.value[0]; return f ? (f.path || '').replace(/[\/][^\/]+$/, '') : ''
})

// 首次导入文件时自动填充输出目录（未设置全局默认目录时）
watch(files, (newFiles, oldFiles) => {
  if (newFiles.length > 0 && oldFiles.length === 0 && !outputDir.value) {
    outputDir.value = sourceDir.value
  }
})


const canExec = computed(() => files.value.length > 0)

// 视频帧率（用于帧序号 <-> 时间换算）
const videoFps = computed(() => {
  const v = activeFile.value?.streams?.find(s => s.codec_type === 'video')
  if (v?.r_frame_rate) {
    const parts = String(v.r_frame_rate).split('/')
    const fps = parts.length === 2 ? parseFloat(parts[0]) / parseFloat(parts[1]) : parseFloat(v.r_frame_rate)
    return fps > 0 ? fps : 30
  }
  return 30
})

// === 单帧截图：时间点 <-> 帧序号 双向同步 ===
let snapshotUpdating = false

function onSnapshotTimeInput(val) {
  if (snapshotUpdating) return
  snapshotUpdating = true
  const t = parseFloat(val) || 0
  snapshotTime.value = t
  snapshotFrame.value = Math.round(t * videoFps.value)
  snapshotUpdating = false
}

function fmtSnapshotTime() {
  const t = parseFloat(snapshotTimeDisplay.value) || 0
  snapshotTimeDisplay.value = t.toFixed(1)
  snapshotTime.value = t
}

function onSnapshotFrameChange(val) {
  if (snapshotUpdating) return
  snapshotUpdating = true
  const frame = Math.max(0, Math.round(val || 0))
  snapshotFrame.value = frame
  const t = frame / videoFps.value
  snapshotTime.value = t
  snapshotTimeDisplay.value = t.toFixed(1)
  snapshotUpdating = false
}

// === 批量截图：时间间隔 <-> 帧间隔 双向同步 ===
let thumbUpdating = false

function onThumbTimeInput(val) {
  if (thumbUpdating) return
  thumbUpdating = true
  const t = parseFloat(val) || 0
  thumbTimeInterval.value = t
  thumbFrameInterval.value = Math.max(1, Math.round(t * videoFps.value))
  thumbUpdating = false
}

function fmtThumbTime() {
  const t = parseFloat(thumbTimeInterval.value) || 0
  thumbTimeInterval.value = parseFloat(t.toFixed(1))
}

function onThumbFrameChange(val) {
  if (thumbUpdating) return
  thumbUpdating = true
  const frame = Math.max(1, Math.round(val || 1))
  thumbFrameInterval.value = frame
  const t = frame / videoFps.value
  thumbTimeInterval.value = parseFloat(t.toFixed(1))
  thumbUpdating = false
}

// 文件切换时初始化帧序号
watch(activeFile, () => {
  // 重新触发一次换算
  if (mode.value === 'snapshot') {
    onSnapshotTimeInput(snapshotTimeDisplay.value)
  }
  if (mode.value === 'thumbnails') {
    if (thumbMode.value === 'time') onThumbTimeInput(thumbTimeInterval.value)
    else onThumbFrameChange(thumbFrameInterval.value)
  }
})

/** 安全截取时间：超过时长自动回退 */
const safeSnapshotTime = computed(() => {
  const dur = parseFloat(activeFile.value?.format?.duration) || 0
  return Math.min(snapshotTime.value, Math.max(0, dur - 0.1))
})
const safeGifStart = computed(() => {
  const dur = parseFloat(activeFile.value?.format?.duration) || 0
  const t = parseFloat(gifStart.value) || 0
  return Math.min(t, Math.max(0, dur - 0.1))
})

const command = computed(() => {
  if (!activeFile.value) return ''
  const input = activeFile.value.path || activeFile.value.name
  if (mode.value === 'snapshot') {
    const outPath = generateOutputPath(input, outFmt.value, outputDir.value, outputFileName.value)
    const scale = snapshotSize.value ? `,-vf scale=${snapshotSize.value}` : ''
    return `ffmpeg -y -ss ${safeSnapshotTime.value} -i "${input}" -frames:v 1 -q:v 2${scale} "${outPath}"`
  }
  if (mode.value === 'gif') {
    const outPath = generateOutputPath(input, 'gif', outputDir.value, outputFileName.value)
    const fps = gifFps.value || 10
    const scale = gifSize.value ? `scale=${gifSize.value}:flags=lanczos` : 'scale=iw:ih'
    return `ffmpeg -y -ss ${safeGifStart.value} -t ${gifDuration.value || 5} -i "${input}" -vf "fps=${fps},${scale},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${outPath}"`
  }
  if (mode.value === 'thumbnails') {
    const outPath = generateOutputPath(input, outFmt.value, outputDir.value, outputFileName.value)
    // 批量截图的输出文件名用 thumbnail_%04d 格式，放在输出目录下
    const lastSep = Math.max(outPath.lastIndexOf('/'), outPath.lastIndexOf('\\'))
    const outDir = lastSep >= 0 ? outPath.substring(0, lastSep) : '.'
    const fps = thumbMode.value === 'time'
      ? `1/${thumbTimeInterval.value || 10}`
      : `1/${(thumbFrameInterval.value || 300) / videoFps.value}`
    return `ffmpeg -y -i "${input}" -vf fps=${fps} "${outDir}/thumbnail_%04d.${outFmt.value}"`
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
  const outPath = args[args.length - 1] || ''
  await shell.value.runner.execute(args)
  if (shell.value.runner.lastResult.value?.success && loadSettings().autoOpenDir !== false && outPath) {
    await openExternalPath(outPath)
  }
}
</script>
<style scoped>
</style>
