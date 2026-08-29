<template>
  <ToolPageShell ref="shell" title="音频处理" icon="Headset" :files="files" :command="command"
    :can-execute="canExec" :active-file="activeFile" @add-files="addFiles" @remove-file="removeFile"
    @execute="doExec">
    <template #hint><el-tag size="small" type="info">提取音频、格式转换、降噪、音量调节</el-tag></template>
    <template #toolbar>
      <div class="settings-grid">
        <div class="setting-card"><div class="card-header">操作模式</div>
          <el-radio-group v-model="mode" style="width:100%">
            <el-radio-button value="extract">提取音频</el-radio-button>
            <el-radio-button value="convert">音频转码</el-radio-button>
            <el-radio-button value="volume">音量调整</el-radio-button>
            <el-radio-button value="fade">淡入淡出</el-radio-button>
          </el-radio-group>
        </div>

        <div class="setting-card" v-if="mode==='extract'"><div class="card-header">提取参数</div>
          <el-form label-position="top">
            <div class="form-row">
              <el-form-item label="音频码率">
                <el-select v-model="outBitrate" class="full-width" filterable allow-create default-first-option placeholder="默认码率">
                  <el-option v-for="b in AUDIO_BITRATE_PRESETS" :key="b" :value="b" :label="b" />
                </el-select>
              </el-form-item>
              <el-form-item label="采样率">
                <el-select v-model="sampleRate" class="full-width" filterable allow-create default-first-option placeholder="原始采样率">
                  <el-option v-for="s in SAMPLE_RATE_PRESETS" :key="s" :value="s" :label="`${s} Hz`" />
                </el-select>
              </el-form-item>
              <el-form-item label="声道">
                <el-select v-model="channels" class="full-width" placeholder="原始声道">
                  <el-option v-for="c in CHANNEL_PRESETS" :key="c.value" :value="c.value" :label="c.label" />
                </el-select>
              </el-form-item>
            </div>
          </el-form>
        </div>

        <div class="setting-card" v-if="mode==='convert'"><div class="card-header">转码参数</div>
          <el-form label-position="top">
            <div class="form-row">
              <el-form-item label="采样率">
                <el-select v-model="sampleRate" class="full-width" filterable allow-create default-first-option placeholder="原始采样率">
                  <el-option v-for="s in SAMPLE_RATE_PRESETS" :key="s" :value="s" :label="`${s} Hz`" />
                </el-select>
              </el-form-item>
              <el-form-item label="声道">
                <el-select v-model="channels" class="full-width" placeholder="原始声道">
                  <el-option v-for="c in CHANNEL_PRESETS" :key="c.value" :value="c.value" :label="c.label" />
                </el-select>
              </el-form-item>
            </div>
          </el-form>
        </div>

        <div class="setting-card" v-if="mode==='volume'"><div class="card-header">音量参数</div>
          <el-form label-position="top">
            <el-form-item label="音量倍数"><el-slider v-model="volFactor" :min="0" :max="300" show-input /> <span style="margin-left:8px">{{ volFactor }}%</span></el-form-item>
          </el-form>
          <el-tag type="info" size="small">推荐 50%~200% 范围，超出可能失真</el-tag>
        </div>

        <div class="setting-card" v-if="mode==='fade'"><div class="card-header">淡入淡出参数</div>
          <el-form label-position="top">
            <el-form-item>
              <div class="fade-row">
                <div class="fade-group">
                  <label>淡入开始</label>
                  <el-input v-model="fadeInStart" @blur="validateFadeInStart(fadeInStart)" :class="{ 'is-error': fadeInStartErr }" placeholder="如 0" />
                  <span class="fade-info">起 {{ fadeInStart || 0 }}s</span>
                </div>
                <div class="fade-group">
                  <label>淡入时长</label>
                  <el-input v-model="fadeIn" @blur="validateFadeIn(fadeIn)" :class="{ 'is-error': fadeInErr }" placeholder="如 2" />
                  <span class="fade-info">终 {{ fadeInEnd }}s</span>
                </div>
                <div class="fade-group">
                  <label>淡出开始</label>
                  <el-input v-model="fadeOutStart" @blur="validateFadeOutStart(fadeOutStart)" :class="{ 'is-error': fadeOutStartErr }" placeholder="自动" />
                  <span class="fade-info">起 {{ fadeOutStart || '0' }}s</span>
                </div>
                <div class="fade-group">
                  <label>淡出时长</label>
                  <el-input v-model="fadeOut" @blur="validateFadeOut(fadeOut)" :class="{ 'is-error': fadeOutErr }" placeholder="如 3" />
                  <span class="fade-info">终 {{ fadeOutEnd }}s</span>
                </div>
              </div>
              <div v-if="fadeError" class="fade-warn">
                <el-icon><WarningFilled /></el-icon> {{ fadeError }}
              </div>
              <div v-else class="fade-hint">
                淡入区间 {{ fadeInStart }}s ~ {{ fadeInEnd }}s，淡出区间 {{ fadeOutStart }}s ~ {{ fadeOutEnd }}s
              </div>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </template>
    <template #outputSettings>
      <OutputSettings
        :format="outFmt"
        :formats="[{'value': 'mp3', 'label': 'MP3'}, {'value': 'wav', 'label': 'WAV'}, {'value': 'flac', 'label': 'FLAC'}, {'value': 'aac', 'label': 'AAC'}, {'value': 'm4a', 'label': 'M4A'}, {'value': 'ogg', 'label': 'OGG'}, {'value': 'opus', 'label': 'Opus'}]"
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
import { ElMessage } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import OutputSettings from '@/components/OutputSettings.vue'
import ToolPageShell from '@/components/ToolPageShell.vue'
import { parseArgs, noExt, loadSettings, openDirectory } from '@/utils/platform'
import { validateNumber } from '@/utils/validators'
import { useValidate } from '@/utils/useValidate'
import { useFileManager } from '@/utils/useFileManager'
import { AUDIO_BITRATE_PRESETS, SAMPLE_RATE_PRESETS, CHANNEL_PRESETS } from '@/utils/ffmpegCommand'

const { files, activeFile, addFiles, removeFile } = useFileManager()
const shell = ref(null)
const mode = ref('extract')
const outFmt = ref('mp3')
const outBitrate = ref('192k')
const sampleRate = ref(44100)
const channels = ref(2)
const volFactor = ref(100)
const { error: fadeInErr, check: validateFadeIn } = useValidate(validateNumber)
const fadeIn = ref('2')
const { error: fadeOutErr, check: validateFadeOut } = useValidate(validateNumber)
const fadeOut = ref('3')
const { error: fadeInStartErr, check: validateFadeInStart } = useValidate(validateNumber)
const fadeInStart = ref('0')
const { error: fadeOutStartErr, check: validateFadeOutStart } = useValidate(validateNumber)
const fadeOutStart = ref('')  // 自动计算
const globalSettings = { ...loadSettings() }; const outputDir = ref(globalSettings.defaultOutputDir || '')
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

// 当前音频总时长
const audioDuration = computed(() => {
  return activeFile.value?.format?.duration ? parseFloat(activeFile.value.format.duration) : 0
})

// 淡入区间结束时间 = 淡入开始 + 淡入时长
const fadeInEnd = computed(() => {
  const s = parseFloat(fadeInStart.value) || 0
  const d = parseFloat(fadeIn.value) || 0
  return (s + d).toFixed(1)
})

// 淡出区间结束时间 = 淡出开始 + 淡出时长
const fadeOutEnd = computed(() => {
  const s = parseFloat(fadeOutStart.value) || 0
  const d = parseFloat(fadeOut.value) || 0
  return (s + d).toFixed(1)
})

// 错误检测
const fadeError = computed(() => {
  const fIn = parseFloat(fadeIn.value) || 0
  const fOut = parseFloat(fadeOut.value) || 0
  if (fIn <= 0 || fOut <= 0) return null
  const inEnd = parseFloat(fadeInEnd.value) || 0
  const outStartStr = fadeOutStart.value || '0'
  const outStart = parseFloat(outStartStr) || 0
  const outEnd = parseFloat(fadeOutEnd.value) || 0
  if (isNaN(inEnd) || isNaN(outStart) || isNaN(outEnd)) return null
  if (inEnd >= outStart) return '淡入结束必须小于淡出开始，当前时间区间重叠'
  if (audioDuration.value > 0 && outEnd > audioDuration.value) return `淡出结束 (${outEnd}s) 超出音频时长 (${audioDuration.value.toFixed(1)}s)`
  return null
})

// 自动同步淡出开始 = 音频总时长 - 淡出时长
watch([audioDuration, () => parseFloat(fadeOut.value)], ([dur, fadeOutD]) => {
  if (dur > 0 && fadeOutD > 0 && (fadeOutStart.value === '' || fadeOutStart.value === 'auto')) {
    fadeOutStart.value = Math.max(0, dur - fadeOutD).toFixed(1)
  }
}, { immediate: true })

// 获取输入文件目录
function inputDir(input) {
  const sep = input.lastIndexOf('/') > input.lastIndexOf('\\') ? '/' : '\\'
  const idx = input.lastIndexOf(sep)
  return idx >= 0 ? input.substring(0, idx + 1) : ''
}

const command = computed(() => {
  if (!activeFile.value) return ''
  const input = activeFile.value.path || activeFile.value.name
  const srcDir = inputDir(input)
  // 输出目录：用户设置优先，否则与源文件同目录
  const outDir = (outputDir.value || '').trim() || srcDir
  // 输出文件名：用户输入优先，否则源文件名_converted
  const fileName = (outputFileName.value || '').trim() || `${noExt(input)}_converted`
  const out = (p) => `${outDir}${fileName}.${p}`
  if (mode.value === 'extract') {
    let cmd = `ffmpeg -y -i "${input}" -vn -c:a ${outFmt.value === 'mp3' ? 'libmp3lame' : outFmt.value} -b:a ${outBitrate.value}`
    if (sampleRate.value) cmd += ` -ar ${sampleRate.value}`
    if (channels.value) cmd += ` -ac ${channels.value}`
    cmd += ` "${out(outFmt.value)}"`
    return cmd
  }
  if (mode.value === 'convert') return `ffmpeg -y -i "${input}" -c:a ${outFmt.value === 'mp3' ? 'libmp3lame' : outFmt.value} -ar ${sampleRate.value} -ac ${channels.value} "${out(outFmt.value)}"`
  if (mode.value === 'volume') return `ffmpeg -y -i "${input}" -af volume=${volFactor.value/100} -c:a ${outFmt.value === 'mp3' ? 'libmp3lame' : outFmt.value} "${out(outFmt.value)}"`
  if (mode.value === 'fade') {
    if (fadeError.value) {
      ElMessage.warning('时间设置有误请重新设置')
      return ''
    }
    return `ffmpeg -y -i "${input}" -af afade=t=in:st=${fadeInStart.value || 0}:d=${fadeIn.value || 2},afade=t=out:st=${fadeOutStart.value || 0}:d=${fadeOut.value || 3} -c:a aac "${out(outFmt.value)}"`
  }
  return ''
})


async function browseOutputDir() {
  const dir = await openDirectory()
  if (dir) outputDir.value = dir
}
async function doExec() {
  if (mode.value === 'fade' && fadeError.value) {
    ElMessage.warning('时间设置有误请重新设置')
    return
  }
  if (!command.value || !shell.value) return
  const args = parseArgs(command.value).filter(a => a !== 'ffmpeg')
  await shell.value.runner.execute(args)
}
</script>
<style scoped>
.fade-row { display: flex; gap: 16px; align-items: flex-start; padding: 6px 0; }
.fade-group { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fade-group label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.fade-info { font-size: 11px; color: var(--text-tertiary); margin-top: 1px; }
.fade-hint { display: flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 12px; color: var(--text-tertiary); }
.fade-warn { display: flex; align-items: center; gap: 4px; margin-top: 6px; padding: 4px 8px; background: var(--bg-error); border-radius: 6px; font-size: 12px; color: var(--danger); }
</style>

// 首次导入文件时自动填充输出目录
watch(files, (newFiles, oldFiles) => {
  if (newFiles.length > 0 && oldFiles.length === 0 && !outputDir.value) {
    outputDir.value = sourceDir.value
  }
})
