<template>
  <ToolPageShell ref="shell" title="滤镜特效" icon="Filter" :files="files" :command="command"
    :can-execute="canExec" :active-file="activeFile" @add-files="addFiles" @remove-file="removeFile"
    @execute="doExec">
    <template #hint><el-tag size="small" type="info">视频/音频滤镜效果 — FFmpeg 最强大能力</el-tag></template>
    <template #toolbar>
      <div class="settings-grid">
        <div class="setting-card"><div class="card-header">滤镜类别</div>
          <el-radio-group v-model="filterCat" style="width:100%">
            <el-radio-button value="video">视频滤镜</el-radio-button>
            <el-radio-button value="audio">音频滤镜</el-radio-button>
            <el-radio-button value="complex">复杂滤镜</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 视频滤镜 -->
        <div class="setting-card" v-if="filterCat==='video'"><div class="card-header">视频效果</div>
          <el-form label-position="top">
            <el-form-item label="效果"><el-select v-model="vfPreset">
              <el-option value="" label="无" />
              <el-option value="color" label="色彩调节（亮度/对比度/饱和度）" />
              <el-option value="blur" label="模糊" />
              <el-option value="sharpen" label="锐化" />
              <el-option value="edge" label="边缘检测" />
              <el-option value="oldfilm" label="旧电影效果" />
              <el-option value="hflip" label="水平翻转" />
              <el-option value="vflip" label="垂直翻转" />
              <el-option value="rotate90" label="旋转 90°" />
              <el-option value="rotate180" label="旋转 180°" />
              <el-option value="vignette" label="暗角效果" />
              <el-option value="negate" label="负片效果" />
              <el-option value="watermark" label="图片水印（需额外选择图片）" />
            </el-select></el-form-item>
            <div class="form-row">
              <el-form-item v-if="vfPreset==='color'" label="亮度"><el-slider v-model="brightness" :min="-1" :max="1" :step="0.1" show-input /></el-form-item>
              <el-form-item v-if="vfPreset==='color'" label="对比度"><el-slider v-model="contrast" :min="0" :max="3" :step="0.1" show-input /></el-form-item>
            </div>
            <el-form-item v-if="vfPreset==='color'" label="饱和度"><el-slider v-model="saturation" :min="0" :max="3" :step="0.1" show-input /></el-form-item>
            <el-form-item v-if="vfPreset==='watermark'" label="水印图片"><div class="file-row"><el-input v-model="watermarkImg" placeholder="选择水印图片" /><el-button @click="browseWatermark">选择</el-button></div></el-form-item>
            <el-form-item v-if="vfPreset==='watermark'" label="水印位置"><el-select v-model="wmPosition"><el-option value="10:10" label="左上" /><el-option value="main_w-overlay_w-10:10" label="右上" /><el-option value="10:main_h-overlay_h-10" label="左下" /><el-option value="main_w-overlay_w-10:main_h-overlay_h-10" label="右下" /></el-select></el-form-item>
          </el-form>
        </div>

        <!-- 音频滤镜 -->
        <div class="setting-card" v-if="filterCat==='audio'"><div class="card-header">音频效果</div>
          <el-form label-position="top">
            <el-form-item label="效果"><el-select v-model="afPreset">
              <el-option value="" label="无" />
              <el-option value="eq" label="均衡器 EQ" />
              <el-option value="lowpass" label="低通滤波" />
              <el-option value="highpass" label="高通滤波" />
              <el-option value="echo" label="回声效果" />
              <el-option value="tempo" label="变速（不变调）" />
              <el-option value="pitch" label="变调（不变速）" />
              <el-option value="denoise" label="降噪" />
            </el-select></el-form-item>
            <el-form-item v-if="afPreset==='eq'" label="均衡器参数"><el-input v-model="eqParams" @blur="validateEqParamsFn(eqParams)" :class="{ 'is-error': eqParamsErr }" placeholder="如 0:1 50:0.8 100:0.6 500:0.4 1000:0.3 5000:0.5 16000:0.2" /></el-form-item>
            <el-form-item v-if="afPreset==='lowpass'||afPreset==='highpass'" label="截止频率 Hz"><el-input v-model="filterFreq" @blur="validateFilterFreq(filterFreq)" :class="{ 'is-error': filterFreqErr }" placeholder="如 3000" /></el-form-item>
            <el-form-item v-if="afPreset==='tempo'" label="速度倍率"><el-slider v-model="tempoVal" :min="0.5" :max="2" :step="0.05" show-input /></el-form-item>
            <el-form-item v-if="afPreset==='pitch'" label="音调半音数"><el-slider v-model="pitchVal" :min="-12" :max="12" :step="1" show-input /></el-form-item>
          </el-form>
        </div>

        <!-- 复杂滤镜 -->
        <div class="setting-card" v-if="filterCat==='complex'">
          <div class="card-header">复杂滤镜（多路输入合成）</div>
          <el-alert type="warning" :closable="false" show-icon>
            <template #title>复杂滤镜需要手动编写 filter_complex 参数，或使用「自定义 FFmpeg 命令」</template>
          </el-alert>
          <div style="margin-top:10px;padding:10px 14px;background:var(--bg-hover);border-radius:8px;font-size:12px;line-height:1.8">
            <p><b>常见场景：</b></p>
            <ul style="margin:4px 0;padding-left:16px">
              <li>画中画: <code>-filter_complex "[0:v]scale=1280:720[bg];[1:v]scale=320:240[fg];[bg][fg]overlay=20:20"</code></li>
              <li>2分屏: <code>-filter_complex "[0:v][1:v]hstack"</code></li>
              <li>4宫格: <code>-filter_complex "[0:v][1:v]hstack[top];[2:v][3:v]hstack[bot];[top][bot]vstack"</code></li>
              <li>叠加文字: <code>-vf "drawtext=text='Hello':fontsize=24:fontcolor=white:x=10:y=10"</code></li>
            </ul>
          </div>
        </div>
      </div>
    </template>
    <template #outputSettings>
      <OutputSettings
        :format="outFmt"
        :formats="[{'value': 'mp4', 'label': 'MP4'}, {'value': 'mkv', 'label': 'MKV'}, {'value': 'mov', 'label': 'MOV'}, {'value': 'gif', 'label': 'GIF'}]"
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
import { validateEqParams, validateNumber } from '@/utils/validators'
import { useValidate } from '@/utils/useValidate'
import { useFileManager } from '@/utils/useFileManager'

const { files, activeFile, addFiles, removeFile } = useFileManager()
const shell = ref(null)
const filterCat = ref('video')
const vfPreset = ref('')
const brightness = ref(0)
const contrast = ref(1)
const saturation = ref(1)
const watermarkImg = ref('')
const wmPosition = ref('10:10')
const afPreset = ref('')
const { error: eqParamsErr, check: validateEqParamsFn } = useValidate(validateEqParams)
const eqParams = ref('')
const { error: filterFreqErr, check: validateFilterFreq } = useValidate(validateNumber)
const filterFreq = ref('3000')
const tempoVal = ref(1)
const pitchVal = ref(0)
const customFilterArgs = ref('')
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



const outFmt = ref('mp4')

const canExec = computed(() => files.value.length > 0 || filterCat.value === 'complex')


const command = computed(() => {
  if (filterCat.value === 'complex') return ''
  if (!activeFile.value) return ''
  const input = activeFile.value.path || activeFile.value.name

  if (filterCat.value === 'video') {
    let vf = ''
    if (vfPreset.value === 'color') vf = `eq=brightness=${brightness.value}:contrast=${contrast.value}:saturation=${saturation.value}`
    else if (vfPreset.value === 'blur') vf = 'boxblur=10:5'
    else if (vfPreset.value === 'sharpen') vf = 'unsharp=5:5:1'
    else if (vfPreset.value === 'edge') vf = 'edgedetect'
    else if (vfPreset.value === 'oldfilm') vf = 'curves=vintage,noise=alls=20:allf=t+u,colorchannelmixer=.33:.33:.33'
    else if (vfPreset.value === 'hflip') vf = 'hflip'
    else if (vfPreset.value === 'vflip') vf = 'vflip'
    else if (vfPreset.value === 'rotate90') vf = 'transpose=1'
    else if (vfPreset.value === 'rotate180') vf = 'transpose=1,transpose=1'
    else if (vfPreset.value === 'vignette') vf = 'vignette=PI/3'
    else if (vfPreset.value === 'negate') vf = 'negate'
    else if (vfPreset.value === 'watermark' && watermarkImg.value) {
      return `ffmpeg -y -i "${input}" -i "${watermarkImg.value}" -filter_complex "overlay=${wmPosition.value}" -c:a copy "${noExt(input)}_converted.mp4"`
    }
    if (vf) return `ffmpeg -y -i "${input}" -vf "${vf}" -c:a copy "${noExt(input)}_converted.mp4"`
    return ''
  }

  if (filterCat.value === 'audio') {
    let af = ''
    if (afPreset.value === 'eq') af = `equalizer=f=${eqParams.value || '0'}:width_type=o:width=1`
    else if (afPreset.value === 'lowpass') af = `lowpass=f=${filterFreq.value}`
    else if (afPreset.value === 'highpass') af = `highpass=f=${filterFreq.value}`
    else if (afPreset.value === 'echo') af = 'aecho=0.8:0.9:1000:0.3'
    else if (afPreset.value === 'tempo') af = `atempo=${tempoVal.value}`
    else if (afPreset.value === 'pitch') af = `rubberband=pitch=${Math.pow(2, pitchVal.value/12).toFixed(4)}`
    else if (afPreset.value === 'denoise') af = 'afftdn=nf=-25'
    if (af) return `ffmpeg -y -i "${input}" -af "${af}" "${noExt(input)}_converted.wav"`
    return ''
  }
  return ''
})

function browseWatermark() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => { if (input.files?.[0]) watermarkImg.value = input.files[0].path || input.files[0].name; input.remove() }
  input.click()
}



async function browseOutputDir() {
  const dir = await openDirectory()
  if (dir) outputDir.value = dir
}
async function doExec() {
  const cmd = filterCat.value === 'complex' ? customFilterArgs.value : command.value
  if (!cmd || !shell.value) return
  const args = parseArgs(cmd).filter(a => a !== 'ffmpeg')
  await shell.value.runner.execute(args)
}
</script>
<style scoped>
.file-row { display: flex; gap: 8px; width: 100%; }
.file-row .el-input { flex: 1; }
code { background: var(--bg-hover); padding: 1px 4px; border-radius: 3px; font-size: 11px; color: var(--danger); }
</style>
