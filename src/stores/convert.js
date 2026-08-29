import { defineStore } from 'pinia'
import { loadSettings, openExternalPath } from '@/utils/platform'
import { useFFmpegRunner } from '@/utils/useRunner'
import {
  buildFFmpegCommand, buildConcatCommand, buildImagesToGifCommand, buildImagesToVideoCommand,
  buildAudioConcatCommand,
  generateOutputPath, formatCommandString, validateSettings
} from '@/utils/ffmpegCommand'

import { isElectron, probeMedia, guessFileInfo } from '@/utils/platform'
import { useAppStore } from './app'

export const useConvertStore = defineStore('convert', {
  state: () => ({
    // ── 文件列表 ──
    files: [], // { path, name, size, format: { duration, bitrate, ... }, streams: [...] }
    selectedFileIndex: 0,
    selectedForProcess: [], // 多文件操作时勾选的文件 index 列表

    // ── 输出设置 ──
    settings: {
      outputFormat: 'mp4',
      outputDir: '',
      outputFileName: '',

      operation: 'single',

      // 视频
      videoCodec: 'copy',
      videoStart: '',
      videoEnd: '',
      resolution: 'original',
      customWidth: 1920,
      customHeight: 1080,
      fps: '',
      rateMode: 'crf',
      crf: 23,
      videoBitrate: '4M',
      preset: 'medium',
      pixelFormat: '',

      // 音频
      audioCodec: 'copy',
      audioStart: '',
      audioEnd: '',
      audioBitrate: '128k',
      audioSampleRate: 44100,
      audioChannels: 2,
      volume: 100,

      // 高级
      hwaccel: loadSettings().hwType || 'none',
      trimStart: '',
      trimDuration: '',
      customArgs: '',
      metaTitle: '',
      metaAuthor: '',
      metaComment: '',
      multiOutput: false,
      multiRes1: '1920x1080',
      multiBitrate1: '4000k',
      multiRes2: '1280x720',
      multiBitrate2: '2000k',
      hdrMode: '',

      // 图片
      imageQuality: 90,
      imageScale: 'original',
      imageSize: '',
      imageKeepMeta: false,
      imageBgColor: '#FFFFFF',
      imageBgFill: true,
    },

    // ── 执行状态 ──
    isRunning: false,
    progress: {
      percent: 0,
      frame: 0,
      fps: 0,
      sizeKB: 0,
      time: '00:00:00.00',
      bitrate: 0,
      speed: 0,
      elapsed: 0,
    },
    logs: [],
    lastResult: null,
  }),

  getters: {
    selectedFile(state) {
      return state.files[state.selectedFileIndex] || null
    },

    currentCommand(state) {
      const appStore = useAppStore()
      const op = state.settings.operation || 'single'

      if (op === 'single') {
        const file = state.files[state.selectedFileIndex]
        if (!file) return ''
        const outputPath = generateOutputPath(file.path, state.settings.outputFormat, state.settings.outputDir, state.settings.outputFileName)
        const settingsWithTrim = { ...state.settings }
        const t = appStore.timeline
        if (t.start > 0 || t.end > 0 || t.videoStart > 0 || t.videoEnd > 0 || t.audioStart > 0 || t.audioEnd > 0) {
          const hasV = file.streams.some(s => s.codec_type === 'video')
          const hasA = file.streams.some(s => s.codec_type === 'audio')
          settingsWithTrim.trimStart = String(t.linked ? t.start : Math.min(
            hasV && t.videoStart > 0 ? t.videoStart : (hasA && t.audioStart > 0 ? t.audioStart : 0),
            hasA && t.audioStart > 0 ? t.audioStart : (hasV && t.videoStart > 0 ? t.videoStart : 0)
          ) || 0)
          settingsWithTrim.trimDuration = String(
            ((t.linked ? (t.end || (file.format ? parseFloat(file.format.duration) || 0 : 0)) : Math.max(
              hasV && t.videoEnd > 0 ? t.videoEnd : 0,
              hasA && t.audioEnd > 0 ? t.audioEnd : 0,
              file.format ? parseFloat(file.format.duration) || 0 : 0
            )) - (t.linked ? t.start : Math.min(
              hasV && t.videoStart > 0 ? t.videoStart : 999999,
              hasA && t.audioStart > 0 ? t.audioStart : 999999
            ))) || ''
          )
          const dur = file.format ? parseFloat(file.format.duration) || 0 : 0
          const hasV2 = file.streams.some(s => s.codec_type === 'video')
          const hasA2 = file.streams.some(s => s.codec_type === 'audio')
          const args = buildFFmpegCommand(settingsWithTrim, file.path, outputPath, t, hasV2, hasA2)
          return formatCommandString(args)
        }
        const hasV = file.streams.some(s => s.codec_type === 'video')
        const hasA = file.streams.some(s => s.codec_type === 'audio')
        const args = buildFFmpegCommand(state.settings, file.path, outputPath, null, hasV, hasA)
        return formatCommandString(args)
      }

      const files = this.filesForProcess
      if (files.length === 0) return ''
      const outPath = this._multiOutputPath
      if (op === 'concat') {
        return formatCommandString(buildConcatCommand(files, state.settings, outPath))
      }
      if (op === 'imagesToGif' || op === 'imagesToVideo') {
        const builder = op === 'imagesToGif' ? buildImagesToGifCommand : buildImagesToVideoCommand
        return formatCommandString(builder(files, state.settings, outPath))
      }
      return ''
    },

    commandArgs(state) {
      const appStore = useAppStore()
      const op = state.settings.operation || 'single'

      if (op === 'single') {
        const file = state.files[state.selectedFileIndex]
        if (!file) return []
        const outputPath = generateOutputPath(file.path, state.settings.outputFormat, state.settings.outputDir, state.settings.outputFileName)
        const settingsWithTrim = { ...state.settings }
        const t = appStore.timeline
        // 优先使用设置中的开始/结束时间，其次使用时间轴
        const vs = parseFloat(state.settings.videoStart) || 0
        const ve = state.settings.videoEnd ? parseFloat(state.settings.videoEnd) : 0
        const as = parseFloat(state.settings.audioStart) || 0
        const ae = state.settings.audioEnd ? parseFloat(state.settings.audioEnd) : 0
        if (vs > 0 || ve > 0 || as > 0 || ae > 0) {
          settingsWithTrim.trimStart = String(vs || as)
          const dur = parseFloat(file.format?.duration) || 0
          if (ve > 0) settingsWithTrim.videoDuration = String(ve - (vs || 0))
          if (ae > 0) settingsWithTrim.audioDuration = String(ae - (as || 0))
        } else if (t.start > 0 || t.end > 0 || t.videoStart > 0 || t.videoEnd > 0 || t.audioStart > 0 || t.audioEnd > 0) {
          settingsWithTrim.trimStart = String(t.linked ? t.start : Math.min(
            this.hasVideoStream && t.videoStart > 0 ? t.videoStart : (this.hasAudioStream && t.audioStart > 0 ? t.audioStart : 0),
            this.hasAudioStream && t.audioStart > 0 ? t.audioStart : (this.hasVideoStream && t.videoStart > 0 ? t.videoStart : 0)
          ) || 0)
          settingsWithTrim.trimDuration = String(this.effectiveTrimDuration || '')
        }
        return buildFFmpegCommand(settingsWithTrim, file.path, outputPath, t,
          state.settings.videoCodec !== 'none' && this.hasVideoStream,
          state.settings.audioCodec !== 'none' && this.hasAudioStream)
      }

      const files = this.filesForProcess
      if (files.length === 0) return []
      const outPath = this._multiOutputPath
      if (op === 'concat') {
        return buildConcatCommand(files, state.settings, outPath)
      }
      if (op === 'imagesToGif' || op === 'imagesToVideo') {
        const builder = op === 'imagesToGif' ? buildImagesToGifCommand : buildImagesToVideoCommand
        return builder(files, state.settings, outPath)
      }
      return []
    },

    _multiOutputPath(state) {
      const files = this.filesForProcess
      if (files.length === 0) return ''
      const firstFile = files[0]
      const op = state.settings.operation || 'single'
      const fmt = (op === 'imagesToGif') ? 'gif' : (state.settings.outputFormat || 'mp4')
      return generateOutputPath(firstFile.path, fmt, state.settings.outputDir, state.settings.outputFileName)
    },

    filesForProcess(state) {
      if (state.files.length < 2) return []
      const op = state.settings.operation || 'single'
      if (op === 'single') return []
      if (!state.selectedForProcess || state.selectedForProcess.length === 0) return []
      return state.selectedForProcess
        .map(idx => state.files[idx])
        .filter(Boolean)
    },

    totalDuration(state) {
      const file = state.files[state.selectedFileIndex]
      if (!file || !file.format) return 0
      return parseFloat(file.format.duration) || 0
    },

    hasFiles(state) {
      return state.files.length > 0
    },

    outputPath(state) {
      const op = state.settings.operation || 'single'
      if (op !== 'single') {
        return this._multiOutputPath
      }
      const file = state.files[state.selectedFileIndex]
      if (!file) return ''
      return generateOutputPath(file.path, state.settings.outputFormat, state.settings.outputDir, state.settings.outputFileName)
    },

    validation(state) {
      const op = state.settings.operation || 'single'
      const file = state.files[state.selectedFileIndex]

      if (op !== 'single') {
        const files = this.filesForProcess
        const multiFile = {
          _totalFiles: files.length,
          _notAllImages: files.some(f => {
            const ext = f.name.split('.').pop().toLowerCase()
            return !['jpg','jpeg','png','bmp','webp','gif'].includes(ext)
          })
        }
        return validateSettings(state.settings, multiFile)
      }

      return validateSettings(state.settings, file)
    },

    hasValidationErrors() {
      return this.validation.errors.length > 0
    },

    fileDuration(state) {
      const file = state.files[state.selectedFileIndex]
      if (!file || !file.format) return 0
      return parseFloat(file.format.duration) || 0
    },

    hasVideoStream(state) {
      const file = state.files[state.selectedFileIndex]
      if (!file) return false
      return file.streams.some(s => s.codec_type === 'video')
    },

    hasAudioStream(state) {
      const file = state.files[state.selectedFileIndex]
      if (!file) return false
      return file.streams.some(s => s.codec_type === 'audio')
    },

    effectiveTrimStart() {
      const appStore = useAppStore()
      const t = appStore.timeline
      if (t.linked) return t.start
      const vals = []
      if (this.hasVideoStream) vals.push(t.videoStart)
      if (this.hasAudioStream) vals.push(t.audioStart)
      return vals.length ? Math.min(...vals) : 0
    },

    effectiveTrimEnd() {
      const appStore = useAppStore()
      const t = appStore.timeline
      const dur = this.fileDuration
      const eLink = t.end || dur
      if (t.linked) return eLink
      const vals = [dur]
      if (this.hasVideoStream && t.videoEnd > 0) vals.push(t.videoEnd)
      if (this.hasAudioStream && t.audioEnd > 0) vals.push(t.audioEnd)
      return Math.max(...vals)
    },

    effectiveTrimDuration() {
      return this.effectiveTrimEnd - this.effectiveTrimStart
    },
  },

  actions: {
    setOperation(op) {
      this.settings.operation = op
      if (op !== 'single' && this.files.length >= 2) {
        this.selectedForProcess = this.files.map((_, i) => i)
      } else {
        this.selectedForProcess = []
      }
    },

    async addFiles(fileInputs) {
      for (const input of fileInputs) {
        const isPath = typeof input === 'string'
        const filePath = isPath ? input : (input.path || '')
        const fileObj = isPath ? null : input
        const fileName = isPath ? input.split(/[\\/]/).pop() : input.name
        const fileSize = isPath ? 0 : input.size

        const dedupeKey = filePath || `${fileName}_${fileSize}`
        if (this.files.some(f => {
          const fKey = f.path || `${f.name}_${f.size}`
          return fKey === dedupeKey
        })) continue

        // 第一步：从扩展名快速猜测类型，立即显示
        const guess = guessFileInfo(fileName, fileSize)
        const file = {
          path: filePath,
          name: fileName,
          size: fileSize,
          format: guess.format,
          streams: guess.streams,
          loading: false,      // 立即完成，UI 可交互
          _guessed: true,      // 标记为猜测数据
          _fileObj: fileObj,
        }
        this.files.push(file)

        // 第二步：异步调 ffprobe 获取真实数据，完成后覆盖
        this._probeFile(file, filePath)
      }
      this._syncSelectedForProcess()
    },

    /**
     * 异步探测单个文件，完成后用真实数据覆盖猜测数据
     */
    async _probeFile(file, input) {
      try {
        const info = await probeMedia(input)
        if (info.error) {
          // 猜测数据仍然保留，只标记错误
          file.error = info.error + '（显示为猜测信息）'
          return
        }
        file.format = info.format
        file.streams = info.streams || []
        if (!file.size && info.format?.size) {
          file.size = parseInt(info.format.size) || 0
        }
        file._guessed = false
        // 清除之前的错误（如果有）
        if (file.error && file.error.includes('显示为猜测信息')) {
          delete file.error
        }
      } catch (e) {
        // 忽略探测失败，猜测数据仍可用
        console.warn(`文件探测失败 ${file.name}:`, e)
      }
    },

    removeFile(index) {
      this.files.splice(index, 1)
      this.selectedForProcess = this.selectedForProcess
        .filter(i => i !== index)
        .map(i => (i > index ? i - 1 : i))
      if (this.selectedFileIndex >= this.files.length) {
        this.selectedFileIndex = Math.max(0, this.files.length - 1)
      }
      this._syncSelectedForProcess()
    },

    clearFiles() {
      this.files = []
      this.selectedFileIndex = 0
      this.selectedForProcess = []
    },

    selectFile(index) {
      this.selectedFileIndex = index
      const appStore = useAppStore()
      appStore.initTimeline(this.fileDuration)
    },

    _syncSelectedForProcess() {
      if (this.files.length < 2) {
        this.selectedForProcess = []
        return
      }
      const validSet = new Set(this.files.map((_, i) => i))
      this.selectedForProcess = this.selectedForProcess.filter(i => validSet.has(i))
      if (this.selectedForProcess.length === 0 && this.files.length >= 2) {
        this.selectedForProcess = this.files.map((_, i) => i)
      }
    },

    toggleProcessFile(index) {
      if (this.files.length < 2) return
      const i = this.selectedForProcess.indexOf(index)
      if (i >= 0) {
        this.selectedForProcess.splice(i, 1)
      } else {
        this.selectedForProcess.push(index)
        this.selectedForProcess.sort((a, b) => a - b)
      }
    },

    selectAllProcess(selected = true) {
      if (this.files.length < 2) return
      this.selectedForProcess = selected ? this.files.map((_, i) => i) : []
    },

    isFileSelectedForProcess(index) {
      if (this.files.length < 2) return index === this.selectedFileIndex
      return this.selectedForProcess.includes(index)
    },

    updateSettings(partial) {
      Object.assign(this.settings, partial)
    },

    addLog(text) {
      const lines = text.split('\n').filter(l => l.trim())
      for (const line of lines) this.logs.push(line)
      if (this.logs.length > 2000) {
        this.logs.splice(0, this.logs.length - 2000)
      }
    },

    updateProgress(data) {
      Object.assign(this.progress, data)
    },

    resetProgress() {
      this.progress = {
        percent: 0,
        frame: 0,
        fps: 0,
        sizeKB: 0,
        time: '00:00:00.00',
        bitrate: 0,
        speed: 0,
        elapsed: 0,
      }
      this.logs = []
      this.lastResult = null
    },

    /** 运行前刷新全局设置 */
    _prepareRun() {
      const s = loadSettings()
      this.settings.hwaccel = s.hwType || 'none'
    },

    /** 完成后操作 */
    async _onComplete(outPath) {
      const s = loadSettings()
      if (s.autoOpenDir !== false && outPath) {
        await openExternalPath(outPath)
      }
    },

    async execute() {
      if (this.isRunning) return
      const op = this.settings.operation || 'single'
      const file = this.selectedFile
      const files = this.filesForProcess.length > 0 ? this.filesForProcess : this.files

      if (op === 'single' && files.length > 1) {
        return await this._batchSingleConvert(files)
      }

      if (op === 'single') {
        if (!file) return
        const { errors } = this.validation
        if (errors.length > 0) {
          this.lastResult = { success: false, error: '配置存在错误，无法执行：\n' + errors.join('\n') }
          return
        }
        return await this._runSingle(file)
      }

      if (files.length === 0) return
      const { errors } = this.validation
      if (errors.length > 0) {
        this.lastResult = { success: false, error: '配置存在错误，无法执行：\n' + errors.join('\n') }
        return
      }
      return await this._runMerge(op, files)
    },

    async _batchSingleConvert(files) {
      this._prepareRun()
      this.isRunning = true; this.resetProgress()
      let ok = 0, fail = 0
      let lastOutPath = ''
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i]; this.addLog(`[${i+1}/${files.length}] ${f.name}`)
          const origIdx = this.selectedFileIndex
          this.selectedFileIndex = this.files.indexOf(f)
          const args = this.commandArgs
          try {
            const runner = useFFmpegRunner()
            const result = await runner.execute(args)
            for (const line of runner.logs.value) { this.addLog(line) }
            if (result.success) { ok++; this.addLog(`✅ ${f.name}`); lastOutPath = args[args.length - 1] || '' }
            else { fail++; this.addLog(`❌ ${f.name}`) }
          } catch { fail++; break }
          this.selectedFileIndex = origIdx
        }
        if (ok > 0) this.progress.percent = 100
        this.lastResult = { success: fail===0, batch: true, successCount: ok, failCount: fail, total: files.length }
      } finally { this.isRunning = false; await this._onComplete(lastOutPath) }
    },

    async _runSingle(file) {
      this._prepareRun()
      this.isRunning = true; this.resetProgress()
      let outPath = ''
      try {
        const args = this.commandArgs
        // 输出路径是 args 最后一个元素
        outPath = args[args.length - 1] || ''
        const runner = useFFmpegRunner()
        const result = await runner.execute(args)
        for (const line of runner.logs.value) { this.addLog(line) }
        this.lastResult = result
        if (result.success) this.progress.percent = 100
      } finally { this.isRunning = false; await this._onComplete(outPath) }
    },

    async _runMerge(op, files) {
      this._prepareRun()
      this.isRunning = true; this.resetProgress()
      let outPath = ''
      try {
        const args = this.commandArgs
        outPath = args[args.length - 1] || ''
        const runner = useFFmpegRunner()
        const result = await runner.execute(args)
        for (const line of runner.logs.value) { this.addLog(line) }
        this.lastResult = result
        if (result.success) this.progress.percent = 100
      } finally { this.isRunning = false; await this._onComplete(outPath) }
    },

    async cancel() {
      this.isRunning = false
    },
  },
})
