/**
 * FFmpeg 执行器组合式函数（Tauri v2）
 * 通过 invoke + event 与 Rust 后端通信
 */
import { ref, reactive } from 'vue'

let unlistenLog = () => {}
let unlistenProgress = () => {}
let unlistenComplete = () => {}
let currentPid = null

const isTauri = () => !!(window.__TAURI_INTERNALS__ || window.__TAURI__)

export function useFFmpegRunner() {
  const isRunning = ref(false)
  const lastResult = ref(null)
  const progress = reactive({ percent: 0, frame: 0, fps: 0, sizeKB: 0, time: '00:00:00.00', bitrate: 0, speed: 0 })
  const logs = ref([])

  function addLog(text) {
    const lines = text.split('\n').filter(l => l.trim())
    for (const line of lines) {
      logs.value.push(line)
    }
    if (logs.value.length > 2000) logs.value.splice(0, logs.value.length - 2000)
  }

  function updateProgress(data) {
    Object.assign(progress, data)
  }

  function reset() {
    progress.percent = 0; progress.frame = 0; progress.fps = 0
    progress.sizeKB = 0; progress.time = '00:00:00.00'
    progress.bitrate = 0; progress.speed = 0
    logs.value = []; lastResult.value = null
  }

  async function execute(args, duration = 0) {
    if (isRunning.value) return
    if (!isTauri()) {
      lastResult.value = { success: false, error: 'FFmpeg 需要在桌面环境下运行（Tauri）' }
      return
    }

    isRunning.value = true
    reset()
    currentPid = null

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const { listen } = await import('@tauri-apps/api/event')

      unlistenLog = await listen('ffmpeg:log', (e) => {
        if (!currentPid || e.payload.pid === currentPid) {
          addLog(e.payload.data)
        }
      })

      let progressTimer = null
      unlistenProgress = await listen('ffmpeg:progress', (e) => {
        if (e.payload.pid === currentPid) {
          const t = e.payload.time
          if (t) {
            updateProgress({ time: t })
            if (duration > 0) {
              const sec = parseHms(t)
              if (sec > 0) progress.percent = Math.min(99, Math.round((sec / duration) * 100))
            }
          }
        }
      })

      const completePromise = new Promise((resolve) => {
        unlistenComplete = listen('ffmpeg:complete', (e) => {
          if (!currentPid || e.payload.pid === currentPid) {
            resolve(e.payload)
          }
        }).then(un => { unlistenComplete = un })
      })

      currentPid = await invoke('run_ffmpeg', { args })
      const result = await completePromise
      lastResult.value = result
      if (result.success) progress.percent = 100
      return result
    } catch (e) {
      lastResult.value = { success: false, error: String(e) }
      return lastResult.value
    } finally {
      unlistenLog(); unlistenProgress(); unlistenComplete()
      isRunning.value = false
    }
  }

  async function cancel() {
    if (currentPid && isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('cancel_ffmpeg', { pid: currentPid })
      } catch {}
    }
    isRunning.value = false
  }

  return { isRunning, lastResult, progress, logs, addLog, reset, execute, cancel }
}

function parseHms(t) {
  if (!t) return 0
  const p = t.split(':')
  if (p.length >= 3) return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2])
  if (p.length === 2) return parseInt(p[0]) * 60 + parseFloat(p[1])
  return parseFloat(t) || 0
}
