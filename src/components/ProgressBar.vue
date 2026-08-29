<template>
  <div class="execution-bar">
    <!-- 执行控制行 -->
    <div class="control-row">
      <div class="status-area">
        <template v-if="isRunning">
          <el-icon class="is-loading status-icon running"><Loading /></el-icon>
          <span class="status-text running">正在处理...</span>
          <span class="status-detail" v-if="progress.percent > 0">{{ progress.percent }}%</span>
        </template>
        <template v-else-if="lastResult?.success">
          <el-icon class="status-icon success"><CircleCheckFilled /></el-icon>
          <span class="status-text success">完成</span>
          <span class="status-detail" v-if="lastResult.elapsed">用时 {{ lastResult.elapsed }}s</span>
        </template>
        <template v-else-if="lastResult?.cancelled">
          <el-icon class="status-icon cancelled"><CircleCloseFilled /></el-icon>
          <span class="status-text cancelled">已取消</span>
        </template>
        <template v-else-if="lastResult?.error">
          <el-icon class="status-icon error"><CircleCloseFilled /></el-icon>
          <span class="status-text error">执行失败</span>
          <span class="status-detail error-detail">{{ lastResult.error }}</span>
        </template>
        <template v-else>
          <span class="status-text idle">就绪</span>
        </template>
      </div>

      <div class="button-area">
        <el-button v-if="showExecute && !isRunning" type="primary" size="large" :disabled="disabled" @click="$emit('execute')">
          <el-icon><VideoPlay /></el-icon>
          <span>{{ executeLabel }}</span>
        </el-button>
        <el-button v-if="showExecute && isRunning" type="danger" size="large" @click="$emit('cancel')">
          <el-icon><VideoPause /></el-icon>
          <span>停止</span>
        </el-button>
        <el-button v-if="lastResult?.error" text size="small" @click="copyError">
          <el-icon><CopyDocument /></el-icon> 复制错误
        </el-button>
        <el-button text @click="showLog = !showLog">
          {{ showLog ? '隐藏日志' : '显示日志' }}
          <el-icon class="log-arrow" :class="{ rotated: showLog }"><ArrowUp /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 进度条 -->
    <div v-if="isRunning || progress.percent > 0" class="progress-track">
      <el-progress :percentage="progress.percent" :stroke-width="6" text-inside />
    </div>

    <!-- 日志面板 -->
    <div v-if="showLog" class="log-panel">
        <div class="log-header">
          <span>FFmpeg 输出日志</span>
          <div class="log-actions">
            <el-button text size="small" @click="copyLogs">
              <el-icon><CopyDocument /></el-icon> 复制日志
            </el-button>
            <el-button text size="small" @click="$emit('clearLogs')">清空</el-button>
          </div>
        </div>
        <div ref="logContainer" class="log-content">
          <div v-for="(line, i) in logs" :key="i" class="log-line">{{ line }}        </div>
      </div>
      </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, CircleCheckFilled, CircleCloseFilled,
  VideoPlay, VideoPause, ArrowUp, CopyDocument } from '@element-plus/icons-vue'

const props = defineProps({
  /** 是否正在执行 */
  isRunning: { type: Boolean, default: false },
  /** 进度对象 { percent, frame, fps, sizeKB, speed } */
  progress: { type: Object, default: () => ({ percent: 0 }) },
  /** 最后结果 { success, error, cancelled, elapsed } */
  lastResult: { type: Object, default: null },
  /** 日志字符串数组 */
  logs: { type: Array, default: () => [] },
  /** 执行按钮文本 */
  executeLabel: { type: String, default: '开始转码' },
  /** 是否显示执行/停止按钮 */
  showExecute: { type: Boolean, default: true },
  /** 按钮是否禁用 */
  disabled: { type: Boolean, default: false },
  /** 是否自动展开日志（全局设置） */
  autoShowLog: { type: Boolean, default: true },
})

defineEmits(['execute', 'cancel', 'clearLogs'])

const showLog = ref(false)
const logContainer = ref(null)

// 执行开始时自动展开日志（如果全局设置开启）
watch(() => props.isRunning, (running) => {
  if (running && props.autoShowLog) showLog.value = true
})

watch(showLog, async (val) => {
  if (val) { await nextTick(); logContainer.value?.closest('.page-scroll')?.scrollTo({ top: 9999, behavior: 'smooth' }) }
})

watch(() => props.logs.length, async () => {
  await nextTick()
  if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight
})

function copyLogs() {
  const text = props.logs.join('\n')
  if (!text) return
  navigator.clipboard.writeText(text).then(() => ElMessage.success('日志已复制')).catch(() => {})
}

function copyError() {
  const text = props.lastResult?.error || ''
  if (!text) return
  navigator.clipboard.writeText(text).then(() => ElMessage.success('错误已复制')).catch(() => {})
}
</script>

<style scoped>
.execution-bar { padding: 4px 0 20px; }

.control-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.status-area { display: flex; align-items: center; gap: 8px; font-size: 13px; min-width: 0; flex: 1; }
.status-icon { font-size: 18px; flex-shrink: 0; }
.status-icon.is-loading { animation: rotating 1.5s linear infinite; }
@keyframes rotating { to { transform: rotate(360deg); } }
.status-text { font-weight: 600; flex-shrink: 0; }
.status-text.running { color: var(--accent); }
.status-text.success { color: var(--success); }
.status-text.cancelled { color: var(--text-tertiary); }
.status-text.error { color: var(--danger); }
.status-text.idle { color: var(--text-tertiary); }
.status-detail { color: var(--text-tertiary); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.button-area { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.progress-track { margin-bottom: 10px; }

.log-panel {
  border: 1px solid var(--border-color); border-radius: var(--radius);
  overflow: hidden; margin-top: 4px;
}
.log-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 12px; background: var(--bg-hover); font-size: 12px;
}
.log-content {
  height: 300px; overflow-y: auto; padding: 8px 12px;
  background: var(--terminal-bg); font-family: 'Consolas', monospace;
  font-size: 11px; color: var(--terminal-text);
}
.log-slide-enter-active, .log-slide-leave-active { transition: all 0.25s ease; }
.log-slide-enter-from, .log-slide-leave-to { opacity: 0; }

.log-line { padding: 1px 0; white-space: pre-wrap; word-break: break-all; }

.log-arrow { transition: transform 0.2s; }
.log-arrow.rotated { transform: rotate(180deg); }

</style>
