<template>
  <section class="convert-settings">
    <!-- 输出设置 -->
    <OutputSettings
      :format="store.settings.outputFormat"
      :formats="formatOptions"
      :outputDir="store.settings.outputDir"
      :outputFileName="store.settings.outputFileName"
      @update:format="store.settings.outputFormat=$event"
      @update:outputDir="store.settings.outputDir=$event"
      @update:outputFileName="store.settings.outputFileName=$event"
      @browse="browseDir"
    />

    <!-- 视频设置：导入视频且输出为视频格式时显示（输出音频=提取音频，无需视频设置） -->
    <div class="setting-card" v-if="fileType==='video' && !isAudioOutput">
      <div class="card-header">
        <el-icon><VideoCamera /></el-icon><span>视频设置</span>
        <el-select v-model="store.settings.videoCodec" class="header-codec">
          <el-option v-for="(c,k) in availableVideoCodecs" :key="k" :value="k" :label="c.label"/>
          <el-option value="none" label="无视频"/>
        </el-select>
      </div>
      <template v-if="store.settings.videoCodec && store.settings.videoCodec !== 'none'">
        <div class="setting-row">
          <div class="setting-field"><label>开始时间</label><el-input v-model="store.settings.videoStart" placeholder="如 0:00, 15s, 1m30" @blur="fmtVideoStart"/></div>
          <div class="setting-field"><label>结束时间</label><el-input v-model="store.settings.videoEnd" :placeholder="'总长: '+(videoDurSec?fmtSec(videoDurSec):'0')+', 留空=末尾'" @blur="fmtVideoEnd"/></div>
          <div class="setting-field"><label>分辨率</label><el-select v-model="store.settings.resolution" class="full-width"><el-option v-for="r in RES" :key="r.value" :value="r.value" :label="r.label"/></el-select></div>
          <div class="setting-field"><label>帧率</label><el-select v-model="store.settings.fps" class="full-width" filterable allow-create default-first-option placeholder="原始帧率"><el-option value="" label="原始帧率"/><el-option v-for="f in FPS_LIST" :key="f" :value="String(f)" :label="`${f} fps`"/></el-select></div>
        </div>
        <div class="adv-toggle" @click="showVideoAdv = !showVideoAdv">
          <span>高级设置</span><el-icon :class="{rot:showVideoAdv}"><ArrowDown /></el-icon>
        </div>
        <div v-if="showVideoAdv" class="setting-row adv-row">
          <div class="setting-field"><label>视频码率</label><el-select v-model="store.settings.videoBitrate" class="full-width" filterable allow-create default-first-option placeholder="默认码率"><el-option v-for="b in VBR_LIST" :key="b" :value="b" :label="b"/></el-select></div>
          <div class="setting-field"><label>CRF</label><el-slider v-model="store.settings.crf" :min="0" :max="51" show-input/></div>
          <div class="setting-field"><label>预设</label><el-select v-model="store.settings.preset" class="full-width"><el-option v-for="p in PRESETS" :key="p" :value="p" :label="p"/></el-select></div>
          <div class="setting-field"><label>像素格式</label><el-select v-model="store.settings.pixelFormat" class="full-width" filterable allow-create default-first-option placeholder="自动"><el-option v-for="p in PIX_FMT_LIST" :key="p" :value="p" :label="p"/></el-select></div>
        </div>
      </template>
    </div>

    <!-- 音频设置：仅在导入音频 或 视频含音频轨道 时显示 -->
    <div class="setting-card" v-if="fileType==='audio' || (fileType==='video' && hasAudioTrack)">
      <div class="card-header">
        <el-icon><Headset /></el-icon><span>音频设置</span>
        <el-select v-model="store.settings.audioCodec" class="header-codec">
          <el-option v-for="(c,k) in availableAudioCodecs" :key="k" :value="k" :label="c.label"/>
          <el-option value="none" label="无音频"/>
        </el-select>
      </div>
      <template v-if="store.settings.audioCodec && store.settings.audioCodec !== 'none'">
        <div class="setting-row">
          <div class="setting-field"><label>开始时间</label><el-input v-model="store.settings.audioStart" placeholder="如 0:00, 留空=开头" @blur="fmtAudioStart"/></div>
          <div class="setting-field"><label>结束时间</label><el-input v-model="store.settings.audioEnd" :placeholder="'总长: '+(audioDurSec?fmtSec(audioDurSec):'0')+', 留空=末尾'" @blur="fmtAudioEnd"/></div>
          <div class="setting-field"><label>采样率</label><el-select v-model="store.settings.audioSampleRate" class="full-width" placeholder="原始采样率"><el-option value="" label="原始采样率"/><el-option v-for="r in SR_LIST" :key="r" :value="r" :label="r+' Hz'"/></el-select></div>
          <div class="setting-field"><label>声道</label><el-select v-model="store.settings.audioChannels" class="full-width"><el-option v-for="c in CH_LIST" :key="c.value" :value="c.value" :label="c.label"/></el-select></div>
        </div>
        <div class="adv-toggle" @click="showAudioAdv = !showAudioAdv">
          <span>高级设置</span><el-icon :class="{rot:showAudioAdv}"><ArrowDown /></el-icon>
        </div>
        <div v-if="showAudioAdv" class="setting-row adv-row">
          <div class="setting-field"><label>音频码率</label><el-select v-model="store.settings.audioBitrate" class="full-width" filterable allow-create default-first-option placeholder="默认码率"><el-option v-for="b in ABR_LIST" :key="b" :value="b" :label="b"/></el-select></div>
        </div>
      </template>
    </div>

    <!-- 图片设置：仅在导入图片时显示 -->
    <div class="setting-card" v-if="fileType==='image'">
      <div class="card-header">
        <el-icon><Picture /></el-icon><span>图片设置</span>
      </div>
      <div class="setting-row">
        <div class="setting-field"><label>质量</label><el-slider v-model="store.settings.imageQuality" :min="1" :max="100" show-input/></div>
        <div class="setting-field" style="flex:0.5"><label>缩放</label><el-select v-model="store.settings.imageScale" class="full-width"><el-option value="original" label="原始"/><el-option value="1920x1080" label="1920×1080"/><el-option value="1280x720" label="1280×720"/><el-option value="854x480" label="854×480"/><el-option value="640x480" label="640×480"/><el-option value="480x360" label="480×360"/><el-option value="320x240" label="320×240"/><el-option value="1x1" label="1×1"/><el-option value="custom" label="自定义"/></el-select></div>
        <div class="setting-field" v-if="store.settings.imageScale==='custom'"><label>自定义宽×高</label><el-input v-model="store.settings.imageSize" placeholder="如 1280x720" @blur="validateImageSize" :class="{ 'is-error': imageSizeError }"/><span v-if="imageSizeError" class="field-error">格式错误，请重新输入</span></div>
        <div class="setting-field" v-if="store.settings.outputFormat==='jpg'"><label>透明背景填充</label><el-color-picker v-model="store.settings.imageBgColor" size="small"/></div>
      </div>
      <div class="adv-toggle" @click="showImageAdv = !showImageAdv">
        <span>高级设置</span><el-icon :class="{rot:showImageAdv}"><ArrowDown /></el-icon>
      </div>
      <div v-if="showImageAdv" class="setting-row adv-row">
        <div class="setting-field"><label>修改元数据</label><el-radio-group v-model="store.settings.imageModifyMeta"><el-radio-button :value="false">不修改</el-radio-button><el-radio-button :value="true">修改</el-radio-button></el-radio-group></div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useConvertStore } from '@/stores/convert'
import { VideoCamera, Headset, Picture, ArrowDown } from '@element-plus/icons-vue'
import { openDirectory } from '@/utils/platform'
import { validateSize } from '@/utils/validators'
import { useValidate } from '@/utils/useValidate'
import OutputSettings from '@/components/OutputSettings.vue'
import { FORMAT_PRESETS, VIDEO_CODECS, AUDIO_CODECS, RESOLUTION_PRESETS, FPS_PRESETS, VIDEO_BITRATE_PRESETS, AUDIO_BITRATE_PRESETS, PIXEL_FORMAT_PRESETS, SAMPLE_RATE_PRESETS, CHANNEL_PRESETS, parseTime } from '@/utils/ffmpegCommand'

const store = useConvertStore()
const { error: imageSizeError, check: validateImageSize } = useValidate(validateSize)
const showVideoAdv = ref(false)
const showAudioAdv = ref(false)
const showImageAdv = ref(false)

const PRESETS = ['ultrafast','superfast','veryfast','faster','fast','medium','slow','slower','veryslow']
const FPS_LIST = FPS_PRESETS
const VBR_LIST = VIDEO_BITRATE_PRESETS
const PIX_FMT_LIST = PIXEL_FORMAT_PRESETS
const SR_LIST = SAMPLE_RATE_PRESETS
const CH_LIST = CHANNEL_PRESETS
const ABR_LIST = AUDIO_BITRATE_PRESETS

const RES = RESOLUTION_PRESETS

const firstFile = computed(() => store.files?.[0] || null)
const streams = computed(() => firstFile.value?.streams || [])

const fileType = computed(() => {
  const f = firstFile.value
  if (!f) return ''
  const ext = (f.path||f.name||'').split('.').pop()?.toLowerCase()
  if (['jpg','jpeg','png','gif','webp','bmp','tiff'].includes(ext)) return 'image'
  if (['mp3','wav','aac','flac','ogg','m4a','wma','opus'].includes(ext)) return 'audio'
  if (streams.value.some(s => s.codec_type === 'video')) return 'video'
  if (streams.value.some(s => s.codec_type === 'audio')) return 'audio'
  return ''
})

const hasAudioTrack = computed(() => streams.value.some(s => s.codec_type === 'audio'))
const videoDurSec = computed(() => parseFloat(firstFile.value?.format?.duration) || 0)
const audioDurSec = computed(() => parseFloat(firstFile.value?.format?.duration) || 0)

function fmtSec(s) { const m=Math.floor(s/60),ss=Math.floor(s%60); return m+':'+String(ss).padStart(2,'0') }
function fmtVideoStart() { const t=parseTime(store.settings.videoStart); if(t!==null) store.settings.videoStart=String(t) }
function fmtVideoEnd() { const t=parseTime(store.settings.videoEnd); if(t!==null) store.settings.videoEnd=String(t) }
function fmtAudioStart() { const t=parseTime(store.settings.audioStart); if(t!==null) store.settings.audioStart=String(t) }
function fmtAudioEnd() { const t=parseTime(store.settings.audioEnd); if(t!==null) store.settings.audioEnd=String(t) }

const availableFormats = computed(() => {
  const result = {}
  const addByCat = cats => { for (const [k, p] of Object.entries(FORMAT_PRESETS)) { if (cats.includes(p.cat || 'both')) result[k] = p } }
  const type = fileType.value
  if (!type) { addByCat(['both','audio','image','subtitle','stream']); return result }
  // 视频 → 可输出视频(both)或音频(audio)；无音频轨道时不允许音频
  if (type === 'video') { addByCat(['both']); if (hasAudioTrack.value) addByCat(['audio']) }
  // 音频 → 只能输出音频
  else if (type === 'audio') { addByCat(['audio']) }
  // 图片 → 只能输出图片（不含动图）
  else if (type === 'image') { addByCat(['image']) }
  delete result.gif
  return result
})

const formatOptions = computed(() => Object.entries(availableFormats.value).map(([k,v]) => ({ value:k, label:v.label, desc:v.desc })))
const isAudioOutput = computed(() => FORMAT_PRESETS[store.settings.outputFormat]?.cat === 'audio')
const availableVideoCodecs = computed(() => { const r={}; for(const[k,c]of Object.entries(VIDEO_CODECS)){if(k!=='none')r[k]=c}; return r })
const availableAudioCodecs = computed(() => { const r={}; for(const[k,c]of Object.entries(AUDIO_CODECS)){if(k!=='none')r[k]=c}; return r })

async function browseDir() { const dir=await openDirectory(); if(dir) store.settings.outputDir=dir }
</script>

<style scoped>
.convert-settings { display:flex; flex-direction:column; gap:18px; margin-top: 18px; margin-bottom: 28px; }
.setting-card {
  background: var(--bg-surface);
  border-radius: 16px;
  padding: 18px;
  box-shadow: var(--nm-shadow-sm);
  border: none;
}
.card-header { font-size:14px; font-weight:600; margin-bottom:14px; display:flex; align-items:center; gap:12px; color: var(--text-primary); }
.card-header .header-codec { width:140px; flex-shrink:0; margin-left:auto; }
.setting-row { display:flex; gap:16px; align-items:flex-start; }
.setting-field { display:flex; flex-direction:column; gap:5px; min-width:0; flex:1; }
.setting-field label { font-size:13px; color:var(--text-secondary); font-weight:500; }
.full-width { width:100%; }
.adv-toggle { display:flex; align-items:center; gap:4px; cursor:pointer; color:var(--text-tertiary); font-size:12px; margin-top:10px; padding:4px 0; user-select:none; }
.adv-toggle:hover { color:var(--text-secondary); }
.adv-toggle .el-icon { transition:transform 0.2s; }
.adv-toggle .rot { transform:rotate(180deg); }
.adv-row { margin-top:10px; padding-top:12px; border-top:1px solid var(--border-color); }
</style>
