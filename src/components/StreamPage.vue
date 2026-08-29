<template>
  <ToolPageShell ref="shell" title="流媒体" icon="Upload" :files="streamFiles" :command="command"
    :can-execute="canExec" :show-file-select="false"
    @execute="doExec">
    <template #hint><el-tag size="small" type="warning">推流、拉流、HLS、RTSP — 需网络连接</el-tag></template>
    <template #toolbar>
      <div class="settings-grid">
        <div class="setting-card"><div class="card-header">操作模式</div>
          <el-radio-group v-model="mode" style="width:100%">
            <el-radio-button value="push">推流直播</el-radio-button>
            <el-radio-button value="pull">拉流保存</el-radio-button>
            <el-radio-button value="hls">生成 HLS</el-radio-button>
          </el-radio-group>
        </div>

        <div class="setting-card" v-if="mode==='push'"><div class="card-header">推流参数</div>
          <el-form label-position="top">
            <div class="form-row">
              <el-form-item label="媒体文件"><div class="file-row"><el-input v-model="pushInput" placeholder="选择文件路径" /><el-button @click="browseFile">选择</el-button></div></el-form-item>
              <el-form-item label="推流地址（RTMP）"><el-input v-model="rtmpUrl" placeholder="rtmp://..." /></el-form-item>
            </div>
            <div class="form-row">
              <el-form-item label="编码"><el-select v-model="pushCodec"><el-option value="libx264" label="H.264" /><el-option value="libx265" label="H.265" /></el-select></el-form-item>
              <el-form-item label="码率"><el-select v-model="pushBitrate" class="full-width" filterable allow-create default-first-option placeholder="默认码率"><el-option v-for="b in VIDEO_BITRATE_PRESETS" :key="b" :value="b" :label="b"/></el-select></el-form-item>
              <el-form-item label="分辨率"><el-select v-model="pushSize" class="full-width" filterable allow-create default-first-option placeholder="原始分辨率"><el-option v-for="r in RESOLUTION_PRESETS.filter(r => r.value !== 'original' && r.value !== 'custom')" :key="r.value" :value="r.value" :label="r.label"/></el-select></el-form-item>
            </div>
          </el-form>
          <el-tag type="warning" size="small">💡 推流到 B站/抖音/YouTube 需要先获取 RTMP 推流地址和密钥</el-tag>
        </div>

        <div class="setting-card" v-if="mode==='pull'"><div class="card-header">拉流参数</div>
          <el-form label-position="top">
            <div class="form-row pull-row">
              <el-form-item label="网络流地址" style="flex:2 1 280px">
                <el-input v-model="pullUrl" placeholder="如 rtmp://..., rtsp://..., https://.../index.m3u8" />
              </el-form-item>
              <el-form-item label="录制时长" style="flex:1 1 140px">
                <el-input v-model="pullDuration" placeholder="留空=全部" @blur="fmtPullDuration" />
                <div class="hint">支持格式：30、1:30、1m30s</div>
              </el-form-item>
              <el-form-item label="超时重连" style="flex:0 0 auto; align-self:flex-end">
                <el-checkbox v-model="pullReconnect" label="启用自动重连" />
              </el-form-item>
            </div>
          </el-form>
        </div>

        <div class="setting-card" v-if="mode==='hls'"><div class="card-header">HLS 参数</div>
          <el-form label-position="top">
            <el-form-item label="媒体文件"><div class="file-row"><el-input v-model="hlsInput" placeholder="选择或输入文件路径" /><el-button @click="browseFile">选择</el-button></div></el-form-item>
            <div class="form-row">
              <el-form-item label="切片时长">
                <el-input v-model="hlsTime" placeholder="默认 10" @blur="fmtHlsTime" />
                <div class="hint">支持格式：10、0:10、10s 等</div>
              </el-form-item>
              <el-form-item label="输出目录"><el-input v-model="hlsDir" placeholder="留空=当前目录" /></el-form-item>
            </div>
          </el-form>
          <el-tag type="info" size="small">💡 生成 .m3u8 播放列表 + .ts 切片，可直接上传 CDN</el-tag>
        </div>

        <div class="setting-card" style="background:var(--bg-warning)">
          <div class="card-header">📋 常用直播平台推流地址格式</div>
          <ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.8;color:var(--text-secondary)">
            <li>B站: rtmp://live-push.bilivideo.com/live-bvc/{密钥}</li>
            <li>抖音: rtmp://push.{region}.douyin.com/live/{密钥}</li>
            <li>YouTube: rtmp://a.rtmp.youtube.com/live2/{密钥}</li>
            <li>自定义 SRS: rtmp://your-server.com/live/{streamKey}</li>
          </ul>
        </div>
      </div>
    </template>
    <template #outputSettings v-if="mode !== 'push'">
      <OutputSettings
        :format="outFmt"
        :formats="[{'value': 'mp4', 'label': 'MP4'}, {'value': 'ts', 'label': 'TS'}, {'value': 'mkv', 'label': 'MKV'}, {'value': 'flv', 'label': 'FLV'}]"
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
import { parseArgs, noExt, loadSettings, openDirectory } from '@/utils/platform'
import { validateStreamUrl, validateNumber } from '@/utils/validators'
import { useValidate } from '@/utils/useValidate'
import { parseTime, VIDEO_BITRATE_PRESETS, RESOLUTION_PRESETS } from '@/utils/ffmpegCommand'

const shell = ref(null)
const mode = ref('push')
const pushInput = ref('')
const { error: rtmpUrlErr, check: validateRtmpUrl } = useValidate(validateStreamUrl)
const rtmpUrl = ref('')
const pushCodec = ref('libx264')
const pushBitrate = ref('2000k')
const pushSize = ref('1280x720')
const { error: pullUrlErr, check: validatePullUrl } = useValidate(validateStreamUrl)
const pullUrl = ref('')
const pullDuration = ref('')
const pullReconnect = ref(true)
const hlsInput = ref('')
const hlsTime = ref('10')
const hlsDir = ref('')
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


const outFmt = ref('mp4')

const streamFiles = ref([])
const canExec = computed(() => {
  if (mode.value === 'push') return !!pushInput.value && !!rtmpUrl.value
  if (mode.value === 'pull') return !!pullUrl.value
  if (mode.value === 'hls') return !!hlsInput.value
  return false
})


function fmtSec(s) {
  if (!s || s <= 0) return '0'
  if (s < 60) return String(Math.round(s * 10) / 10)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60 * 10) / 10
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}

function fmtPullDuration() {
  if (!pullDuration.value) return
  const t = parseTime(pullDuration.value)
  if (t !== null && t > 0) pullDuration.value = fmtSec(t)
}

function fmtHlsTime() {
  if (!hlsTime.value) return
  const t = parseTime(hlsTime.value)
  if (t !== null && t > 0) hlsTime.value = fmtSec(t)
}

const command = computed(() => {
  if (mode.value === 'push') {
    return `ffmpeg -y -re -i "${pushInput.value}" -c:v ${pushCodec.value} -b:v ${pushBitrate.value} -vf scale=${pushSize.value} -c:a aac -b:a 128k -f flv "${rtmpUrl.value}"`
  }
  if (mode.value === 'pull') {
    const reconnect = pullReconnect.value ? ' -reconnect 1 -reconnect_at_eof 1 -reconnect_streamed 1 -reconnect_delay_max 60' : ''
    const durSec = parseTime(pullDuration.value)
    const dur = (durSec && durSec > 0) ? ` -t ${durSec}` : ''
    return `ffmpeg -y${reconnect} -i "${pullUrl.value}"${dur} -c copy "recorded_${Date.now()}.mp4"`
  }
  if (mode.value === 'hls') {
    const dir = hlsDir.value ? `${hlsDir.value}/` : ''
    const hlsSec = parseTime(hlsTime.value) || 10
    return `ffmpeg -y -i "${hlsInput.value}" -c:v libx264 -c:a aac -hls_time ${hlsSec} -hls_list_size 0 "${dir}${noExt(hlsInput.value)}_converted.m3u8"`
  }
  return ''
})

function browseFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = () => {
    if (input.files?.[0]) {
      const path = input.files[0].path || input.files[0].name
      if (mode.value === 'push') pushInput.value = path
      if (mode.value === 'hls') hlsInput.value = path
    }
    input.remove()
  }
  input.click()
}



async function browseOutputDir() {
  const dir = await openDirectory()
  if (dir) outputDir.value = dir
}
async function doExec() {
  if (!command.value || !shell.value) return
  const args = parseArgs(command.value).filter(a => a !== 'ffmpeg')
  await shell.value.runner.execute(args)
}
</script>
<style scoped>
.file-row { display: flex; gap: 8px; width: 100%; }
.file-row .el-input { flex: 1; }
.hint { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.4; }
.pull-row { flex-wrap: nowrap !important; }
.pull-row :deep(.el-form-item) { margin-bottom: 0; }
</style>
