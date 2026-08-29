<template>
  <section class="custom-page">
    <div class="page-scroll">
      <h2 class="page-title">
        <el-icon><EditPen /></el-icon>
        <span>自行命令</span>
        <el-tag size="small" type="info">需要完整的 ffmpeg 命令</el-tag>
      </h2>

      <!-- 工具栏 -->
      <div class="toolbar">
        <el-button @click="showHelp = !showHelp" :type="showHelp ? 'primary' : 'default'" plain size="small">
          <el-icon><Search /></el-icon> {{ showHelp ? '收起帮助' : '查询指令' }}
        </el-button>
        <el-button v-if="command" @click="command = ''" size="small" text type="warning">
          <el-icon><Delete /></el-icon> 清除命令
        </el-button>
      </div>

      <!-- 命令输入区 -->
      <div class="command-input-area">
        <div class="input-header">
          <span class="prompt-icon">$</span>
          <span class="prompt-text">ffmpeg</span>
        </div>
        <el-input
          v-model="command"
          type="textarea"
          :rows="10"
          placeholder="需要完整的 ffmpeg 命令
示例：ffmpeg -y -i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac output.mp4"
          class="command-textarea"
          :autosize="{ minRows: 10, maxRows: 20 }"
        />
      </div>

      <!-- 帮助面板 -->
      <div v-if="showHelp" class="help-panel">
          <div class="help-header">
            <el-icon><Search /></el-icon>
            <span>FFmpeg 命令参考</span>
            <el-input v-model="helpSearch" class="help-search" size="small" placeholder="搜索命令..." clearable prefix-icon="Search" />
          </div>
          <div class="help-grid">
            <div v-for="group in filteredHelp" :key="group.category" class="help-card">
              <div class="help-card-title">{{ group.category }}</div>
              <div class="help-items">
                <div v-for="item in group.items" :key="item.flag" class="help-item" @click="insertFlag(item.flag)">
                  <code class="help-flag">{{ item.flag }}</code>
                  <span class="help-desc">{{ item.desc }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="help-footer">
            <span>点击任意参数即可插入到命令中 · 完整文档请参考 <a href="https://ffmpeg.org/ffmpeg.html" target="_blank">FFmpeg 官方文档</a></span>
          </div>
      </div>

      <!-- 执行区域 -->
      <div v-if="command.trim()" style="margin: 0 24px 0;">
        <ProgressBar
          :is-running="runner.isRunning.value"
          :progress="runner.progress"
          :last-result="runner.lastResult.value"
          :logs="runner.logs.value"
          execute-label="执行命令"
          @execute="executeCommand"
          @cancel="runner.cancel()"
          @clear-logs="runner.logs.value = []"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { EditPen, Search, Delete } from '@element-plus/icons-vue'
import { useFFmpegRunner } from '@/utils/useRunner'
import { parseArgs, loadSettings, openExternalPath } from '@/utils/platform'
import ProgressBar from '@/components/ProgressBar.vue'

const command = ref('')
const showHelp = ref(false)
const helpSearch = ref('')
const logContainer = ref(null)
const runner = useFFmpegRunner()

async function executeCommand() {
  if (!command.value.trim()) return
  const args = parseArgs(command.value.trim())
  if (args[0] === 'ffmpeg') args.shift()
  // 输出文件是最后一个参数
  const outPath = args[args.length - 1] || ''
  await runner.execute(args)
  // 自动打开输出目录
  if (runner.lastResult.value?.success && loadSettings().autoOpenDir !== false && outPath) {
    await openExternalPath(outPath)
  }
}

function insertFlag(flag) {
  command.value = (command.value + ' ' + flag).trim()
}

// 帮助面板数据
const helpGroups = [
  { category: '视频编码', items: [
    { flag: '-c:v libx264', desc: 'H.264 编码（兼容性最好）' },
    { flag: '-c:v libx265', desc: 'H.265/HEVC 编码（更高压缩比）' },
    { flag: '-c:v libvpx-vp9', desc: 'VP9 编码（WebM）' },
    { flag: '-c:v copy', desc: '视频流复制（无损）' },
    { flag: '-crf 23', desc: 'CRF 质量控制 (0-51，默认23)' },
    { flag: '-preset medium', desc: '编码速度预设' },
    { flag: '-b:v 2M', desc: '视频码率' },
  ]},
  { category: '音频编码', items: [
    { flag: '-c:a aac', desc: 'AAC 音频编码' },
    { flag: '-c:a libmp3lame', desc: 'MP3 音频编码' },
    { flag: '-c:a flac', desc: 'FLAC 无损音频' },
    { flag: '-c:a copy', desc: '音频流复制（无损）' },
    { flag: '-b:a 128k', desc: '音频码率' },
    { flag: '-ar 44100', desc: '采样率 44100Hz' },
    { flag: '-ac 2', desc: '双声道立体声' },
  ]},
  { category: '分辨率/画面', items: [
    { flag: '-s 1920x1080', desc: '设置分辨率 1920×1080' },
    { flag: '-s 1280x720', desc: '设置分辨率 1280×720' },
    { flag: '-r 30', desc: '设置帧率 30fps' },
    { flag: '-aspect 16:9', desc: '宽高比 16:9' },
    { flag: '-vf scale=1920:1080', desc: '缩放滤镜' },
    { flag: '-vn', desc: '移除视频流' },
  ]},
  { category: '裁剪/截取', items: [
    { flag: '-ss 00:01:30', desc: '从 1 分 30 秒开始' },
    { flag: '-t 60', desc: '持续 60 秒' },
    { flag: '-to 00:05:00', desc: '截取到 5 分钟' },
    { flag: '-ss 10 -t 30', desc: '从第 10 秒开始截取 30 秒' },
  ]},
  { category: '输入输出', items: [
    { flag: '-i input.mp4', desc: '指定输入文件' },
    { flag: '-f mp4', desc: '强制输出格式' },
    { flag: '-y', desc: '覆盖输出文件（不询问）' },
    { flag: '-map 0:v', desc: '选择第一个输入的视频流' },
    { flag: '-map 0:a', desc: '选择第一个输入的音频流' },
  ]},
  { category: '滤镜', items: [
    { flag: '-vf "hflip"', desc: '水平翻转' },
    { flag: '-vf "vflip"', desc: '垂直翻转' },
    { flag: '-vf "transpose=1"', desc: '顺时针旋转 90°' },
    { flag: '-vf "crop=w:h:x:y"', desc: '裁剪画面' },
    { flag: '-af "volume=2"', desc: '音量翻倍' },
  ]},
  { category: '合并/拼接', items: [
    { flag: '-f concat -safe 0 -i list.txt', desc: '文件列表合并' },
    { flag: '-filter_complex concat=n=2:v=1:a=1', desc: 'filter_complex 拼接' },
    { flag: '-filter_complex "[0:v][1:v]hstack"', desc: '视频横向拼接' },
    { flag: '-filter_complex "[0:v][1:v]vstack"', desc: '视频纵向拼接' },
  ]},
  { category: '提取/分离', items: [
    { flag: '-vn -c:a copy', desc: '提取音频（丢弃视频）' },
    { flag: '-an -c:v copy', desc: '提取视频（丢弃音频）' },
    { flag: '-vframes 1', desc: '截取 1 帧（截图）' },
  ]},
]

const filteredHelp = computed(() => {
  if (!helpSearch.value) return helpGroups
  const q = helpSearch.value.toLowerCase()
  return helpGroups.map(g => ({
    ...g,
    items: g.items.filter(i => i.flag.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q))
  })).filter(g => g.items.length > 0)
})

watch(() => runner.logs.value.length, async () => {
  await nextTick()
  if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight
})

function copyLogs() {
  const text = runner.logs.value.join('\n')
  if (!text) return
  navigator.clipboard.writeText(text).then(() => ElMessage.success('日志已复制')).catch(() => {})
}
</script>

<style scoped>
.custom-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.page-scroll { flex: 1; overflow-y: auto; }
.page-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; padding: 20px 24px 14px; color: var(--text-primary); }

.toolbar { padding: 0 24px 14px; display: flex; gap: 10px; }

.command-input-area {
  margin: 0 24px 14px;
  background: var(--terminal-bg); border-radius: 10px; overflow: hidden;
}
.input-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px; background: rgba(255,255,255,0.05);
}
.prompt-icon { color: var(--success); font-family: 'Consolas', monospace; font-size: 14px; font-weight: 700; }
.prompt-text { color: var(--el-color-info); font-family: 'Consolas', monospace; font-size: 13px; }
.command-textarea :deep(.el-textarea__inner) {
  background: var(--terminal-bg); border: none; border-radius: 0;
  color: var(--terminal-text); font-family: 'Consolas', monospace;
  font-size: 13px; line-height: 1.6; padding: 10px 16px; resize: none;
}
.command-textarea :deep(.el-textarea__inner):focus { box-shadow: none; }
.command-textarea :deep(.el-textarea__inner)::placeholder { color: var(--text-tertiary); }

.help-panel {
  margin: 0 24px 20px; background: var(--bg-surface);
  border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden;
}
.help-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: var(--bg-hover); font-size: 13px; font-weight: 600; color: var(--text-primary); }
.help-search { width: 200px; margin-left: auto; }
.help-grid { display: flex; flex-wrap: wrap; gap: 0; padding: 12px; }
.help-card { flex: 1 1 300px; min-width: 250px; padding: 10px 12px; }
.help-card-title { font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-color); }
.help-items { display: flex; flex-direction: column; gap: 4px; }
.help-item { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 4px; cursor: pointer; }
.help-item:hover { background: var(--bg-selected); }
.help-flag { font-family: 'Consolas', monospace; font-size: 11px; color: var(--warning); background: var(--bg-warning); padding: 2px 6px; border-radius: 3px; white-space: nowrap; flex-shrink: 0; }
.help-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.4; }
.help-footer { padding: 8px 16px; background: var(--bg-hover); font-size: 11px; color: var(--text-tertiary); border-top: 1px solid var(--border-color); }
.help-footer a { color: var(--accent); }

.execution-area { padding: 4px 24px 20px; }
.control-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.status-area { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.button-area { display: flex; gap: 8px; }
.progress-track { margin-bottom: 10px; }
.log-panel { border: 1px solid var(--border-color); border-radius: var(--radius); overflow: hidden; max-height: 200px; margin-top: 10px; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: var(--bg-hover); font-size: 12px; }
.log-content { max-height: 150px; overflow-y: auto; padding: 8px 12px; background: var(--terminal-bg); font-family: 'Consolas', monospace; font-size: 11px; color: var(--terminal-text); }
.log-line { padding: 1px 0; white-space: pre-wrap; word-break: break-all; }

.is-loading { animation: rotating 1.5s linear infinite; }
@keyframes rotating { to { transform: rotate(360deg); } }
</style>
