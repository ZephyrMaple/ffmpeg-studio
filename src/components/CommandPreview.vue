<template>
  <section class="command-section">
    <div class="section-header">
      <h2 class="section-title">
        <el-icon><Monitor /></el-icon>
        <span>命令预览</span>
      </h2>
      <div class="header-actions">
        <el-button text size="small" @click="copyCommand">
          <el-icon><CopyDocument /></el-icon> 复制
        </el-button>
      </div>
    </div>

    <div class="command-box">
      <div class="command-prefix">
        <span class="prompt">命令&gt;</span>
      </div>
      <pre class="command-text">{{ store.currentCommand }}</pre>
    </div>

    <!-- 验证状态提示 -->
    <div v-if="store.hasValidationErrors" class="validation-tag error">
      <el-icon><WarningFilled /></el-icon>
      <span>配置存在 {{ store.validation.errors.length }} 个错误，无法执行转码</span>
    </div>
    <div v-else-if="store.validation.warnings.length > 0" class="validation-tag warning">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ store.validation.warnings.length }} 个注意事项</span>
      <el-tooltip placement="top">
        <template #content>
          <div v-for="(w, i) in store.validation.warnings" :key="i">{{ w }}</div>
        </template>
        <el-icon class="info-icon"><InfoFilled /></el-icon>
      </el-tooltip>
    </div>
    <div v-else class="validation-tag ok">
      <el-icon><CircleCheckFilled /></el-icon>
      <span>配置有效</span>
    </div>
  </section>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { useConvertStore } from '@/stores/convert'
import { Monitor, CopyDocument, WarningFilled, InfoFilled, CircleCheckFilled } from '@element-plus/icons-vue'

const store = useConvertStore()

async function copyCommand() {
  try {
    await navigator.clipboard.writeText(store.currentCommand)
    ElMessage.success('命令已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择文本复制')
  }
}
</script>

<style scoped>
.command-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.command-box {
  background: var(--terminal-bg);
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  gap: 10px;
  overflow: hidden;
}

.command-prefix {
  flex-shrink: 0;
}

.prompt {
  color: var(--terminal-prompt);
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
}

.command-text {
  flex: 1;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  color: var(--terminal-text);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  overflow-x: auto;
}

.validation-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.validation-tag.error {
  background: var(--bg-error);
  color: var(--danger);
}

.validation-tag.warning {
  background: var(--bg-warning);
  color: var(--warning);
}

.validation-tag.ok {
  background: var(--bg-success);
  color: var(--success);
}

.info-icon {
  cursor: help;
}
</style>
