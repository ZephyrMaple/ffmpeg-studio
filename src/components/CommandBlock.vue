<template>
  <div class="command-block">
    <div class="block-header">
      <div class="block-title">
        <el-icon><Monitor /></el-icon>
        <span>{{ title }}</span>
      </div>
      <el-button text size="small" @click="copyCmd" :disabled="!command">
        <el-icon><CopyDocument /></el-icon> 复制
      </el-button>
    </div>
    <pre class="command-text" ref="cmdRef">{{ command }}</pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Monitor, CopyDocument } from '@element-plus/icons-vue'

const props = defineProps({
  command: { type: String, default: '' },
  title: { type: String, default: 'FFmpeg 命令' },
})

const cmdRef = ref(null)

function copyCmd() {
  if (!props.command) return
  navigator.clipboard.writeText(props.command).then(() => {
    ElMessage.success('命令已复制')
  }).catch(() => {
    // 降级方案
    try {
      const ta = document.createElement('textarea')
      ta.value = props.command
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      ElMessage.success('命令已复制')
    } catch {
      ElMessage.warning('复制失败')
    }
  })
}
</script>

<style scoped>
.command-block {
  background: var(--terminal-bg); border-radius: 8px; overflow: hidden;
}
.block-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; background: rgba(255,255,255,0.05);
  font-size: 12px; color: var(--terminal-text);
}
.block-title { display: flex; align-items: center; gap: 6px; }
.command-text {
  margin: 0; padding: 12px 14px;
  font-family: 'Consolas', monospace; font-size: 12px; color: var(--terminal-text);
  white-space: pre-wrap; word-break: break-all; line-height: 1.5;
  user-select: text; overflow-x: auto;
}
</style>
