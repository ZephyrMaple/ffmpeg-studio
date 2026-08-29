<template>
  <el-dialog
    v-model="visible"
    title="全局设置"
    width="520px"
    :close-on-click-modal="true"
    :before-close="handleClose"
    destroy-on-close
  >
    <div class="settings-form">
      <el-form label-position="top">
        <el-form-item label="主题外观" class="label-pad">
          <el-radio-group v-model="local.theme">
            <el-radio-button value="light">白天</el-radio-button>
            <el-radio-button value="dark">夜晚</el-radio-button>
            <el-radio-button value="auto">跟随系统</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <div class="settings-inline-row">
          <el-form-item label="默认输出目录" class="inline-item-dir">
            <div class="output-dir-row">
              <el-input
                v-model="local.defaultOutputDir"
                placeholder="留空则使用输入文件所在目录"
              />
              <el-button @click="browseDefaultDir">选择目录</el-button>
            </div>
          </el-form-item>
          <el-form-item label="自动打开目录" class="inline-item-override label-pad">
            <el-radio-group v-model="local.autoOpenDir" class="override-row">
              <el-radio-button :value="true">是</el-radio-button>
              <el-radio-button :value="false">否</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>

        <el-form-item label="日志与进度">
          <el-checkbox v-model="local.autoShowLog">执行时自动展开日志面板</el-checkbox>
        </el-form-item>

        <el-form-item label="硬件加速（全局默认）">
          <div class="hw-row">
            <el-select v-model="local.hwType" style="flex:1">
              <el-option v-for="opt in hwOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </el-select>
            <el-button @click="redetectHw" :loading="detecting">检测设备</el-button>
          </div>
          <div v-if="hwDetected" class="hw-status">已检测到：{{ hwDetectedText }}</div>
        </el-form-item>

        <el-form-item label="硬件加速质量（CRF 0~51）">
          <el-slider v-model="local.hwQuality" :min="0" :max="51" show-input />
        </el-form-item>

        <el-form-item label="语言">
          <el-select v-model="local.language" disabled placeholder="当前仅支持中文">
            <el-option label="简体中文" value="zh-CN" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose(() => visible = false)">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { openDirectory, applyTheme, loadSettings, saveSettings, detectHardwareAccel } from '@/utils/platform'

const emit = defineEmits(['save'])

const availableHw = ref({
  cuda: false,
  qsv: false,
  amf: false,
  videotoolbox: false,
})

const hwOptions = ref([
  { value: 'none', label: '关闭（CPU 编码）' },
])
const detecting = ref(false)
const hwDetected = ref(false)
const hwDetectedText = computed(() => {
  const list = []
  if (availableHw.value.cuda) list.push('NVIDIA CUDA')
  if (availableHw.value.qsv) list.push('Intel QSV')
  if (availableHw.value.amf) list.push('AMD AMF')
  if (availableHw.value.videotoolbox) list.push('VideoToolbox')
  return list.length > 0 ? list.join('、') : '未检测到硬件加速'
})

// 从 localStorage 读取已有配置，提供默认值
const saved = loadSettings()
const local = reactive({
  theme: saved.theme || 'light',
  defaultOutputDir: saved.defaultOutputDir || '',
  autoOpenDir: saved.autoOpenDir !== false,
  autoShowLog: saved.autoShowLog !== false,
  hwType: saved.hwType || 'none',
  hwQuality: saved.hwQuality != null ? saved.hwQuality : 23,
  language: saved.language || 'zh-CN',
})

const visible = defineModel()

// 原始设置快照，用于检测未保存修改
const original = reactive({ ...local })

async function handleClose(done) {
  const hasChanges = Object.keys(local).some(k => String(local[k]) !== String(original[k]))
  if (!hasChanges) { done(); return }
  try {
    await ElMessageBox.confirm('你有修改未保存，是否保存？', '提示', {
      confirmButtonText: '保存', cancelButtonText: '放弃修改', distinguishCancelAndClose: true,
      closeOnClickModal: false,
    })
    handleSave()
    done()
  } catch (action) {
    if (action === 'cancel') { done() }  // 放弃修改
    // 'close' → 不关闭
  }
}

function updateHwOptions() {
  const options = [{ value: 'none', label: '关闭（CPU 编码）' }]
  if (availableHw.value.cuda) options.push({ value: 'cuda', label: 'NVIDIA CUDA (h264_nvenc)' })
  if (availableHw.value.qsv) options.push({ value: 'qsv', label: 'Intel QSV (h264_qsv)' })
  if (availableHw.value.amf) options.push({ value: 'amf', label: 'AMD AMF (h264_amf)' })
  if (availableHw.value.videotoolbox) options.push({ value: 'videotoolbox', label: 'Apple VideoToolbox (h264_videotoolbox)' })
  hwOptions.value = options
}

async function redetectHw() {
  detecting.value = true
  try {
    availableHw.value = { cuda: false, qsv: false, amf: false, videotoolbox: false }
    const result = await detectHardwareAccel(true)
    availableHw.value = result
    updateHwOptions()
    hwDetected.value = true
    if (local.hwType !== 'none' && !result[local.hwType]) {
      local.hwType = 'none'
    }
    ElMessage.success('设备检测完成')
  } catch(e) {
    ElMessage.error('设备检测失败: ' + (e.message || e))
  } finally {
    detecting.value = false
  }
}

onMounted(async () => {
  availableHw.value = await detectHardwareAccel()
  updateHwOptions()
  hwDetected.value = true
  if (local.hwType !== 'none' && !availableHw.value[local.hwType]) {
    local.hwType = 'none'
  }
})

watch(visible, (val) => {
  if (val) {
    // 重新打开时从 localStorage 刷新
    const fresh = loadSettings()
    const vals = {
      theme: fresh.theme || 'light',
      defaultOutputDir: fresh.defaultOutputDir || '',
      autoOpenDir: fresh.autoOpenDir !== false,
      autoShowLog: fresh.autoShowLog !== false,
      hwType: fresh.hwType || 'none',
      hwQuality: fresh.hwQuality != null ? fresh.hwQuality : 23,
      language: fresh.language || 'zh-CN',
    }
    Object.assign(local, vals)
    Object.assign(original, vals)
  }
})

async function browseDefaultDir() {
  const dir = await openDirectory()
  if (dir) {
    local.defaultOutputDir = dir
  }
}

function handleSave() {
  saveSettings({ ...local })
  // 立即应用主题
  applyTheme(local.theme)
  emit('save', { ...local })
  ElMessage.success('设置已保存')
  visible.value = false
}
</script>

<style scoped>
.settings-form {
  padding: 4px 8px;
}

.settings-inline-row {
  display: flex;
  gap: 16px;
}
.inline-item-dir { flex: 0 0 60%; min-width: 0; }
.inline-item-override { flex-shrink: 0; }
.inline-item-dir .el-input { flex: 1; min-width: 0; }
.output-dir-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.output-dir-row .el-button { flex-shrink: 0; }

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.el-form-item) { margin-bottom: 14px; }
:deep(.el-form-item:first-child .el-form-item__label) { padding-left: 10px; }
:deep(.inline-item-override .el-form-item__label) { padding-right: 3px; }
.hw-row { display: flex; gap: 10px; width: 100%; }
.hw-status { font-size: 12px; color: var(--text-tertiary); margin-top: 6px; }

.settings-form {
  max-height: 60vh;
  overflow-y: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE */
}
.settings-form::-webkit-scrollbar { display: none; } /* Chrome */

:deep(.el-dialog__body) { padding-top: 10px; padding-bottom: 0; }
:deep(.label-pad .el-form-item__label) { padding-left: 10px; }
</style>
