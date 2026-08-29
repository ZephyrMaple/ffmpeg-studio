<template>
  <div class="output-card">
    <div class="output-card-header">
      <el-icon><FolderOpened /></el-icon>
      <span>输出设置</span>
    </div>
    <div class="output-row">
      <div class="output-field" style="flex:0 0 30%">
        <label>输出格式</label>
        <el-select :model-value="format" @update:model-value="$emit('update:format',$event)" style="width:100%" popper-class="fmt-popper">
          <el-option v-for="f in formats" :key="f.value" :value="f.value" :label="f.label + (f.desc ? ' - ' + f.desc : '')">
            <div class="fmt-row"><span>{{ f.label }}</span><span class="fmt-desc">{{ f.desc }}</span></div>
          </el-option>
        </el-select>
      </div>
      <div class="output-field" style="flex:0 0 30%">
        <label>输出文件名</label>
        <el-input :model-value="outputFileName" @update:model-value="$emit('update:outputFileName',$event)" placeholder="默认：源文件_converted" />
      </div>
      <div class="output-field" style="flex:0 0 35%">
        <label>输出目录</label>
        <div class="output-dir-row">
          <el-input :model-value="outputDir" @update:model-value="$emit('update:outputDir',$event)" placeholder="默认与源文件相同目录" />
          <el-button class="browse-btn" @click="$emit('browse')"><el-icon :size="16"><FolderOpened /></el-icon></el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, onMounted } from 'vue'

const props = defineProps({
  format: String,
  formats: { type: Array, default: () => [] },
  outputDir: String,
  outputFileName: String,
})
const emit = defineEmits(['update:format','update:outputDir','update:outputFileName','browse'])

onMounted(() => {
  if ((!props.format || props.format === 'mp4') && props.formats.length > 0) {
    emit('update:format', props.formats[0].value)
  }
})

watch(() => props.formats, (newFormats) => {
  if (newFormats.length > 0 && (!props.format || !newFormats.some(f => f.value === props.format))) {
    emit('update:format', newFormats[0].value)
  }
}, { immediate: false })
</script>

<style scoped>
.output-card {
  background: var(--bg-surface);
  border: 1.5px solid var(--border-color);
  border-radius: 16px;
  padding: 18px;
  box-shadow: var(--nm-shadow-sm);
}
.output-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
  color: var(--text-primary);
}
.output-row { display: flex; gap: 14px; align-items: flex-start; }
.output-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.output-field label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
.output-dir-row { display: flex; gap: 8px; align-items: center; }
.output-dir-row .el-input { flex: 1; min-width: 0; }
.browse-btn { flex-shrink: 0; padding: 4px 12px; height: 34px; }
.fmt-row { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 12px; }
.fmt-row span:first-child { font-size: 13px; }
.fmt-desc { font-size: 11px; color: var(--text-tertiary); opacity: 0.7; }
</style>

<style>
.fmt-popper .el-select-dropdown__item { height:auto; line-height:1.5; padding:6px 12px; }
</style>
