<template>
  <ToolPageShell ref="shell" title="字幕处理" icon="Message" :files="files" :command="command"
    :can-execute="canExec" :active-file="activeFile" @add-files="addFiles" @remove-file="removeFile"
    @execute="doExec">
    <template #hint><el-tag size="small" type="info">嵌入字幕、提取字幕、格式转换</el-tag></template>
    <template #toolbar>
      <div class="settings-grid">
        <div class="setting-card"><div class="card-header">操作模式</div>
          <el-radio-group v-model="mode" style="width:100%">
            <el-radio-button value="burn">烧录字幕</el-radio-button>
            <el-radio-button value="extract">提取字幕</el-radio-button>
            <el-radio-button value="convert">格式转换</el-radio-button>
          </el-radio-group>
        </div>

        <div class="setting-card" v-if="mode==='burn'">
          <div class="card-header">烧录参数</div>
          <div class="hint-box">💡 将字幕永久嵌入视频画面（无法关闭）。需要准备一个字幕文件（.srt/.ass）</div>
          <el-form label-position="top">
            <div class="burn-row">
              <el-form-item label="字幕文件路径" class="burn-flex">
                <div class="path-inline">
                  <el-input v-model="subtitlePath" placeholder="如 C:\subtitles\file.srt" />
                  <el-button @click="browseSubtitle">选择字幕文件</el-button>
                </div>
              </el-form-item>
              <el-form-item label="字幕语言" class="burn-lang">
                <el-input v-model="subLang" placeholder="如 chi / eng（可选）" />
              </el-form-item>
            </div>
          </el-form>
        </div>

        <div class="setting-card" v-if="mode==='extract'">
          <div class="card-header">提取参数</div>
          <div class="hint-box">💡 从视频中导出内嵌字幕为独立 .srt 文件。并非所有视频都包含字幕轨道。</div>
          <el-form label-position="top">
            <div class="form-row">
              <el-form-item label="字幕轨道编号"><el-input v-model="subStreamIndex" @blur="validateSubStreamIndex(subStreamIndex)" :class="{ 'is-error': subStreamIndexErr }" placeholder="默认 0（第一个字幕轨）" /></el-form-item>
              <el-form-item label="输出格式"><el-select v-model="subOutFmt"><el-option value="srt" label="SRT" /><el-option value="ass" label="ASS" /><el-option value="vtt" label="WebVTT" /></el-select></el-form-item>
            </div>
          </el-form>
        </div>

        <div class="setting-card" v-if="mode==='convert'">
          <div class="card-header">格式转换参数</div>
          <div class="hint-box">💡 在 SRT / ASS / WebVTT 之间互转。源文件必须是字幕文件。</div>
          <el-form label-position="top">
            <el-form-item label="输出格式"><el-select v-model="subOutFmt"><el-option value="srt" label="SRT" /><el-option value="ass" label="ASS" /><el-option value="vtt" label="WebVTT" /></el-select></el-form-item>
          </el-form>
        </div>
      </div>
    </template>
    <template #outputSettings>
      <OutputSettings
        :format="outFmt"
        :formats="[{'value': 'srt', 'label': 'SRT'}, {'value': 'ass', 'label': 'ASS'}, {'value': 'vtt', 'label': 'VTT'}, {'value': 'mp4', 'label': 'MP4 (烧录到视频)'}]"
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
import { validateInteger } from '@/utils/validators'
import { useValidate } from '@/utils/useValidate'
import { useFileManager } from '@/utils/useFileManager'

const { files, activeFile, addFiles, removeFile } = useFileManager()
const shell = ref(null)
const mode = ref('burn')
const subtitlePath = ref('')
const subLang = ref('')
const { error: subStreamIndexErr, check: validateSubStreamIndex } = useValidate(validateInteger)
const subStreamIndex = ref('0')
const subOutFmt = ref('srt')
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


const command = computed(() => {
  if (!activeFile.value) return ''
  const input = activeFile.value.path || activeFile.value.name

  if (mode.value === 'burn') {
    if (!subtitlePath.value) return ''
    const lang = subLang.value ? ` -metadata:s:s:0 language=${subLang.value}` : ''
    return `ffmpeg -y -i "${input}" -vf "subtitles=${subtitlePath.value.replace(/\\/g, '/').replace(/:/g, '\\:')}"${lang} -c:a copy "${noExt(input)}_converted.mp4"`
  }
  if (mode.value === 'extract') {
    return `ffmpeg -y -i "${input}" -map 0:s:${subStreamIndex.value || 0} "${noExt(input)}_converted.${subOutFmt.value}"`
  }
  if (mode.value === 'convert') {
    return `ffmpeg -y -i "${input}" "${noExt(input)}_converted.${subOutFmt.value}"`
  }
  return ''
})

function browseSubtitle() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.srt,.ass,.ssa,.vtt'
  input.onchange = () => {
    if (input.files?.[0]) subtitlePath.value = input.files[0].path || input.files[0].name
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
.burn-row { display: flex; gap: 12px; align-items: flex-start; }
.burn-row .burn-flex { flex: 2; min-width: 0; max-width: 480px; }
.burn-row .burn-lang { flex: 1; min-width: 140px; }
.burn-row .path-inline { display: flex; gap: 8px; align-items: center; }
.burn-row .path-inline .el-input { flex: 1; min-width: 0; max-width: 360px; }
.burn-row .path-inline .el-button { flex-shrink: 0; }
.hint-box { background: var(--bg-selected); padding: 10px 14px; border-radius: 8px; font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5; }
</style>
