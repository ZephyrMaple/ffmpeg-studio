/**
 * 文件管理组合式函数
 * 所有工具页面共用：添加文件（快速猜测 + 异步探测）、移除、选中
 */
import { ref, reactive } from 'vue'
import { guessFileInfo, probeMedia } from './platform'

export function useFileManager() {
  const files = ref([])
  const activeFile = ref(null)

  function addFiles(list) {
    for (const input of list) {
      const isPath = typeof input === 'string'
      const filePath = isPath ? input : (input.path || '')
      const fileName = isPath ? input.split(/[\\/]/).pop() : input.name
      const fileSize = isPath ? 0 : (input.size || 0)

      // 去重
      if (files.value.some(f => f.path === filePath && filePath)) continue

      // 快速猜测
      const guess = guessFileInfo(fileName, fileSize)
      const entry = reactive({
        path: filePath,
        name: fileName,
        size: fileSize,
        format: guess.format,
        streams: guess.streams,
        _guessed: true,
        _fileObj: isPath ? null : input,
        _error: '',
      })
      files.value.push(entry)
      if (!activeFile.value) activeFile.value = entry

      // 异步探测
      probeFile(entry, input)
    }
  }

  async function probeFile(entry, input) {
    try {
      const filePath = typeof input === 'string' ? input : (input.path || '')
      if (!filePath) return
      const info = await probeMedia(filePath)
      if (!info) return  // Tauri not available, keep guess data
      if (info.error) { entry._error = info.error; return }
      entry.format = info.format
      entry.streams = info.streams || entry.streams  // keep guess streams if none
      if (!entry.size && info.format && info.format.size) entry.size = parseInt(info.format.size) || 0
      entry._guessed = false
    } catch (e) {
      entry._error = String(e)
    }
  }

  function removeFile(index) {
    files.value.splice(index, 1)
    if (activeFile.value && !files.value.includes(activeFile.value)) {
      activeFile.value = files.value[0] || null
    }
  }

  function clearFiles() {
    files.value = []
    activeFile.value = null
  }

  return { files, activeFile, addFiles, removeFile, clearFiles }
}
