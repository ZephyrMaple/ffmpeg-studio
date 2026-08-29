import { defineStore } from 'pinia'
import { generateOutputPath, formatCommandString } from '@/utils/ffmpegCommand'
import { useFFmpegRunner } from '@/utils/useRunner'

import { isElectron, probeMedia, guessFileInfo, loadSettings, openExternalPath } from '@/utils/platform'
import { useAppStore } from './app'

function defaultSettings() {
  const settings = loadSettings()
  return {
    outputFormat: 'mp4',
    outputDir: '',
    outputFileName: '',
    videoCodec: 'h264',
    resolution: 'original',
    customWidth: 1920,
    customHeight: 1080,
    fps: '',
    rateMode: 'crf',
    crf: 23,
    videoBitrate: '4M',
    preset: 'medium',
    audioCodec: 'aac',
    audioBitrate: '128k',
    audioSampleRate: 44100,
    audioChannels: 2,
    volume: 100,
    hwaccel: settings.hwType || 'none',
    customArgs: '',
    /** GIF 切换间隔 (s)，0.1~1.0 */
    gifInterval: 0.01,
    /** GIF 目标总时长 (s)，0.1~5.0 */
    gifTotalDuration: 5,
  }
}

// ── 辅助：从流中提取视频宽高 ──
function firstVideoInfo(files) {
  for (const f of files) {
    const v = f.streams?.find(s => s.codec_type === 'video')
    if (v?.width && v?.height) return { width: v.width, height: v.height, fps: parseFps(v.r_frame_rate) || 0 }
  }
  return null
}

function parseFps(rate) {
  if (!rate || typeof rate !== 'string') return 0
  const parts = rate.split('/')
  return parts.length === 2 ? parseFloat(parts[0]) / parseFloat(parts[1]) : parseFloat(rate) || 0
}

function firstAudioParams(files) {
  for (const f of files) {
    const a = f.streams?.find(s => s.codec_type === 'audio')
    if (a) return { codec: a.codec_name, sampleRate: a.sample_rate, channels: a.channels }
  }
  return null
}

/** 图片宽高 */
function firstImageSize(files) {
  for (const f of files) {
    const v = f.streams?.find(s => s.codec_type === 'video')
    if (v?.width && v?.height) return { width: v.width, height: v.height }
  }
  return null
}

// ── 分辨率推导 ──
function resolveResolution(settings, fallbackW, fallbackH) {
  let w = fallbackW, h = fallbackH
  if (settings.resolution && settings.resolution !== 'original' && settings.resolution !== 'custom') {
    const parts = settings.resolution.split('x')
    if (parts.length === 2) { w = parseInt(parts[0]) || w; h = parseInt(parts[1]) || h }
  } else if (settings.resolution === 'original') {
    // 保持回退值
  } else if (settings.resolution === 'custom') {
    w = parseInt(settings.customWidth) || w; h = parseInt(settings.customHeight) || h
  }
  return { width: w, height: h }
}

export const useMergeStore = defineStore('merge', {
  state: () => ({
    mergeFiles: [],
    mergeOperation: 'concat',
    mergeSelectedIndex: -1,
    mergeSettings: defaultSettings(),
    isRunning: false,
    progress: { percent: 0, frame: 0, fps: 0, sizeKB: 0, time: '00:00:00.00', bitrate: 0, speed: 0, elapsed: 0 },
    mergeLogs: [],
    lastResult: null,
    hasAudioMap: {},
  }),

  getters: {
    mergeCommand() {
      if (this.mergeFiles.length < 2) return ''
      const files = this.mergeFiles.filter(f => f._selected !== false)
      if (files.length < 2) return ''
      return this._buildCommandStr(files)
    },
  },

  actions: {
    _buildCommandStr(files) {
      const op = this.mergeOperation || 'concat'
      const firstFile = files[0]
      const settings = this.mergeSettings
      let fmt = 'mp4'
      if (op === 'audioConcat') fmt = settings.outputFormat || 'mp3'
      else if (op === 'imagesToGif') fmt = 'gif'

      const outPath = generateOutputPath(firstFile.path, fmt, settings.outputDir, settings.outputFileName, 0)

      let args
      if (op === 'imagesToVideo') args = this._buildImagesToVideoArgs(files, settings, outPath)
      else if (op === 'imagesToGif') args = this._buildImagesToGifArgs(files, settings, outPath)
      else if (op === 'audioConcat') args = this._buildAudioConcatArgs(files, settings, outPath)
      else args = this._buildConcatArgs(files, settings, outPath)

      return formatCommandString(args || [])
    },

    // ═══════════════════════════════════════════
    // 文件管理（保持不变）
    // ═══════════════════════════════════════════

    async addMergeFiles(fileInputs) {
      for (const input of fileInputs) {
        const isPath = typeof input === 'string'
        const filePath = isPath ? input : (input.path || '')
        const fileName = isPath ? input.split(/[\\/]/).pop() : input.name
        const fileSize = isPath ? 0 : (input.size || 0)
        const dedupeKey = filePath || `${fileName}_${fileSize}`
        if (this.mergeFiles.some(f => (f.path || `${f.name}_${f.size}`) === dedupeKey)) continue

        const guess = guessFileInfo(fileName, fileSize)
        const file = {
          path: filePath, name: fileName, size: fileSize,
          format: guess.format, streams: guess.streams,
          loading: false, _guessed: true, error: '',
          _fileObj: isPath ? null : input, _selected: true,
          _trimStart: 0, _trimEnd: guess.format?.duration ? parseFloat(guess.format.duration) : 0,
          _imgDuration: 0.3,
        }
        this.mergeFiles.push(file)
        this._probeMergeFile(file, filePath)
      }
      // 自动选中第一个可裁剪的媒体文件
      this._autoSelectFirstMedia()
    },

    _autoSelectFirstMedia() {
      this.mergeSelectedIndex = this.mergeFiles.findIndex(f => {
        const ext = (f.name || '').split('.').pop().toLowerCase()
        return ['mp4','mkv','avi','mov','webm','flv','ts','m4v','wmv','mp3','wav','flac','aac','ogg','m4a','ac3','wma','opus'].includes(ext)
      })
    },

    async _probeMergeFile(file, input) {
      try {
        const info = await probeMedia(input)
        if (info.error) { file.error = info.error + '（显示为猜测信息）'; return }
        file.format = info.format
        file.streams = info.streams || []
        if (!file.size && info.format?.size) file.size = parseInt(info.format.size) || 0
        file._guessed = false
        if (file.format?.duration) file._trimEnd = parseFloat(file.format.duration) || 0
        if (file.error && file.error.includes('显示为猜测信息')) delete file.error
        // 探测完成后重新检查是否自动选中第一个媒体文件
        if (this.mergeSelectedIndex < 0) this._autoSelectFirstMedia()
      } catch (e) { console.warn(`文件探测失败 ${file.name}:`, e) }
    },

    removeMergeFile(index) {
      this.mergeFiles.splice(index, 1)
      if (this.mergeSelectedIndex >= this.mergeFiles.length) {
        this.mergeSelectedIndex = Math.max(0, this.mergeFiles.length - 1)
      }
    },

    moveMergeFile(fromIdx, toIdx) {
      const arr = this.mergeFiles
      if (fromIdx < 0 || fromIdx >= arr.length || toIdx < 0 || toIdx >= arr.length) return
      const temp = arr[fromIdx]; arr[fromIdx] = arr[toIdx]; arr[toIdx] = temp
      if (this.mergeSelectedIndex === fromIdx) this.mergeSelectedIndex = toIdx
      else if (this.mergeSelectedIndex === toIdx) this.mergeSelectedIndex = fromIdx
    },

    clearMergeFiles() { this.mergeFiles = []; this.mergeSelectedIndex = -1 },
    selectMergeFile(index) {
      this.mergeSelectedIndex = index
      const f = this.mergeFiles[index]
      if (f) { const appStore = useAppStore(); appStore.initTimeline(f.format?.duration ? parseFloat(f.format.duration) : 0) }
    },
    setMergeOperation(op) { this.mergeOperation = op },
    toggleMergeFile(index) { const f = this.mergeFiles[index]; if (f) f._selected = !f._selected },
    selectAllMergeFiles(selected = true) { for (const f of this.mergeFiles) f._selected = selected },
    updateMergeSettings(partial) { Object.assign(this.mergeSettings, partial) },

    addMergeLog(text) {
      const lines = text.split('\n').filter(l => l.trim())
      for (const line of lines) this.mergeLogs.push(line)
      if (this.mergeLogs.length > 2000) this.mergeLogs.splice(0, this.mergeLogs.length - 2000)
    },
    updateProgress(data) { Object.assign(this.progress, data) },
    resetProgress() {
      this.progress = { percent: 0, frame: 0, fps: 0, sizeKB: 0, time: '00:00:00.00', bitrate: 0, speed: 0, elapsed: 0 }
      this.lastResult = null
    },

    // ═══════════════════════════════════════════
    // 模式1：视频合并（保持原方案不动）
    // ═══════════════════════════════════════════

    _buildConcatArgs(files, settings, outPath) {
      const n = files.length
      const hasCustom = settings.customArgs && settings.customArgs.trim()
      if (hasCustom) return settings.customArgs.trim().split(/\s+/)

      const args = ['-y']
      for (const f of files) args.push('-i', f.path)

      // 分辨率：用户设定 > 首文件 > 兜底 1920×1080
      const firstVInfo = firstVideoInfo(files)
      const { width: targetW, height: targetH } = resolveResolution(
        settings, firstVInfo?.width || 1920, firstVInfo?.height || 1080
      )
      const targetFps = parseInt(settings.fps) || firstVInfo?.fps || 30
      const scaleFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black`

      // 音轨检测
      const hasAudioList = files.map(f => f.streams?.some(s => s.codec_type === 'audio'))
      const allHasAudio = hasAudioList.every(v => v === true)
      const anyHasAudio = hasAudioList.some(v => v === true)

      // filter_complex
      let parts = []
      const concatMap = []

      for (let i = 0; i < n; i++) {
        const f = files[i]
        const dur = f.format?.duration ? parseFloat(f.format.duration) : 0
        const trimStart = f._trimStart || 0
        const trimEnd = f._trimEnd || dur
        let vFilter = ''
        if (trimStart > 0 || (trimEnd > 0 && trimEnd < dur)) {
          const trimDur = trimEnd - trimStart
          vFilter = `trim=start=${trimStart}:duration=${trimDur},setpts=PTS-STARTPTS,${scaleFilter},fps=${targetFps}`
        } else {
          vFilter = `${scaleFilter},fps=${targetFps}`
        }
        parts.push(`[${i}:v]${vFilter}[v${i}]`)
        concatMap.push(`[v${i}]`)
      }

      if (allHasAudio) {
        for (let i = 0; i < n; i++) {
          const f = files[i]
          const dur = f.format?.duration ? parseFloat(f.format.duration) : 0
          const trimStart = f._trimStart || 0
          const trimEnd = f._trimEnd || dur
          let aFilter = ''
          if (trimStart > 0 || (trimEnd > 0 && trimEnd < dur)) {
            const trimDur = trimEnd - trimStart
            aFilter = `atrim=start=${trimStart}:duration=${trimDur},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo`
          } else {
            aFilter = `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo`
          }
          parts.push(`[${i}:a]${aFilter}[a${i}]`)
          concatMap.push(`[a${i}]`)
        }
        parts.push(`${concatMap.join('')}concat=n=${n}:v=1:a=1[vout][aout]`)
        args.push('-filter_complex', parts.join(';'))
        args.push('-map', '[vout]', '-map', '[aout]')
      } else if (anyHasAudio) {
        for (let i = 0; i < n; i++) {
          if (hasAudioList[i]) {
            const f = files[i]
            const dur = f.format?.duration ? parseFloat(f.format.duration) : 0
            const trimStart = f._trimStart || 0
            const trimEnd = f._trimEnd || dur
            let aFilter = ''
            if (trimStart > 0 || (trimEnd > 0 && trimEnd < dur)) {
              const trimDur = trimEnd - trimStart
              aFilter = `atrim=start=${trimStart}:duration=${trimDur},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo`
            } else {
              aFilter = `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo`
            }
            parts.push(`[${i}:a]${aFilter}[a${i}]`)
            concatMap.push(`[a${i}]`)
          } else {
            parts.push(`anullsrc=channel_layout=stereo:sample_rate=44100[a${i}]`)
            concatMap.push(`[a${i}]`)
          }
        }
        parts.push(`${concatMap.join('')}concat=n=${n}:v=1:a=1[vout][aout]`)
        args.push('-filter_complex', parts.join(';'))
        args.push('-map', '[vout]', '-map', '[aout]')
      } else {
        parts.push(`${concatMap.join('')}concat=n=${n}:v=1:a=0[vout]`)
        args.push('-filter_complex', parts.join(';'))
        args.push('-map', '[vout]')
        this.addMergeLog('⚠️ 所有文件均无音轨，输出为纯视频')
      }

      const venc = settings.videoCodec === 'h265' ? 'libx265' : 'libx264'
      args.push('-c:v', venc)
      if (settings.preset) args.push('-preset', settings.preset)
      if (settings.rateMode === 'crf' && settings.crf != null) args.push('-crf', String(settings.crf))
      if (settings.rateMode === 'bitrate' && settings.videoBitrate) args.push('-b:v', settings.videoBitrate)
      if (anyHasAudio) args.push('-c:a', 'aac', '-b:a', settings.audioBitrate || '192k')
      args.push(outPath)
      return args
    },

    // ═══════════════════════════════════════════
    // 模式2：图片转视频（movie + concat 滤镜）
    // ═══════════════════════════════════════════

    _buildImagesToVideoArgs(files, settings, outPath) {
      const n = files.length
      const hasCustom = settings.customArgs && settings.customArgs.trim()
      if (hasCustom) return settings.customArgs.trim().split(/\s+/)

      // 分辨率：用户设定 > 首张图片尺寸 > 兜底 1920×1080
      const imgSize = firstImageSize(files)
      const { width: targetW, height: targetH } = resolveResolution(
        settings, imgSize?.width || 1920, imgSize?.height || 1080
      )
      const fps = parseInt(settings.fps) || 30
      const scaleFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`

      // 背景音乐（可选）：支持选择任意音频文件作为背景
      const imageFiles = files.filter(f => {
        const ext = (f.name || '').split('.').pop().toLowerCase()
        return ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'gif'].includes(ext)
      })
      const bgmFile = files.find(f => !imageFiles.includes(f))

      const args = ['-y']

      const filterParts = []

      // 每张图片的 movie 滤镜
      const concatParts = []
      for (let i = 0; i < imageFiles.length; i++) {
        const dur = (imageFiles[i]._imgDuration > 0) ? imageFiles[i]._imgDuration : 0.3
        const escPath = imageFiles[i].path.replace(/\\/g, '\\\\').replace(/:/g, '\\:')
        filterParts.push(`movie='${escPath}',${scaleFilter},trim=duration=${dur}[v${i}]`)
        concatParts.push(`[v${i}]`)
      }

      filterParts.push(`${concatParts.join('')}concat=n=${imageFiles.length}:v=1:a=0[vout]`)

      // 背景音乐输入和处理
      if (bgmFile) {
        args.push('-i', bgmFile.path)
        const totalDur = imageFiles.reduce((sum, f) => sum + ((f._imgDuration > 0) ? f._imgDuration : 0.3), 0)
        const dur = bgmFile.format?.duration ? parseFloat(bgmFile.format.duration) : 0
        const aStart = bgmFile._trimStart > 0 ? bgmFile._trimStart : 0
        const aEnd = bgmFile._trimEnd > 0 ? bgmFile._trimEnd : Math.min(dur, aStart + totalDur)
        if (aStart > 0 || (aEnd > 0 && aEnd < dur)) {
          const trimDur = aEnd - aStart
          filterParts.push(`[0:a]atrim=start=${aStart}:duration=${trimDur},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]`)
        } else {
          filterParts.push(`[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]`)
        }
        args.push('-filter_complex', filterParts.join(';'))
        args.push('-map', '[vout]', '-map', '[aout]')
        args.push('-c:a', 'aac', '-b:a', settings.audioBitrate || '192k')
        args.push('-shortest')
      } else {
        args.push('-filter_complex', filterParts.join(';'))
        args.push('-map', '[vout]')
      }

      args.push('-c:v', 'libx264', '-r', String(fps), '-preset', 'fast', '-crf', '23')
      args.push(outPath)
      return args
    },

    // ═══════════════════════════════════════════
    // 模式3：图片转 GIF（palettegen + paletteuse）
    // ═══════════════════════════════════════════

    _buildImagesToGifArgs(files, settings, outPath) {
      const hasCustom = settings.customArgs && settings.customArgs.trim()
      if (hasCustom) return settings.customArgs.trim().split(/\s+/)

      // 分辨率：用户设定 > 首张图片 > 兜底 1280×720
      const imgSize = firstImageSize(files)
      const { width: targetW, height: targetH } = resolveResolution(
        settings, imgSize?.width || 1280, imgSize?.height || 720
      )

      // 切换间隔，clamp 0.1~1.0
      let delay = Number(settings.gifInterval) || 0.3
      delay = Math.max(0.01, Math.min(1, delay))

      // 目标总时长，clamp 0.1~5.0
      let targetTotal = Number(settings.gifTotalDuration) || 5
      targetTotal = Math.max(0.1, Math.min(5, targetTotal))

      // ═══ 核心：循环轮播计算片段列表 ═══
      const segments = []
      let currentTime = 0
      let loopIdx = 0
      while (currentTime < targetTotal - 0.001) {
        const pic = files[loopIdx % files.length]
        const picDelay = (pic._imgDuration > 0) ? pic._imgDuration : delay
        const actualDelay = Math.min(picDelay, targetTotal - currentTime)
        if (actualDelay <= 0) break
        segments.push({ file: pic, duration: actualDelay })
        currentTime += actualDelay
        loopIdx++
      }
      if (segments.length === 0) {
        this.addMergeLog('❌ 参数错误：无法生成任何 GIF 片段')
        return null
      }
      const n = segments.length
      const actualTotal = currentTime
      const fps = Math.round(1 / delay)
      if (fps < 1) return null

      this.addMergeLog(`GIF 循环轮播：${files.length} 张图片，目标 ${targetTotal}s，实际 ${actualTotal.toFixed(1)}s（${n} 段）`)

      const args = ['-y']

      const filterParts = []
      const scaleFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1`

      // 第一遍：调色板
      for (let i = 0; i < n; i++) {
        const escPath = segments[i].file.path.replace(/\\/g, '\\\\').replace(/:/g, '\\:')
        filterParts.push(`movie='${escPath}',${scaleFilter},trim=duration=${segments[i].duration}[pv${i}]`)
      }
      const pvConcat = Array.from({ length: n }, (_, i) => `[pv${i}]`).join('')
      filterParts.push(`${pvConcat}concat=n=${n}:v=1:a=0,fps=${fps},palettegen[palette]`)

      // 第二遍：主画面
      for (let i = 0; i < n; i++) {
        const escPath = segments[i].file.path.replace(/\\/g, '\\\\').replace(/:/g, '\\:')
        filterParts.push(`movie='${escPath}',${scaleFilter},trim=duration=${segments[i].duration}[iv${i}]`)
      }
      const ivConcat = Array.from({ length: n }, (_, i) => `[iv${i}]`).join('')
      filterParts.push(`${ivConcat}concat=n=${n}:v=1:a=0,fps=${fps}[main]`)
      filterParts.push('[main][palette]paletteuse=dither=sierra2_4a')

      args.push('-filter_complex', filterParts.join(';'))
      args.push('-loop', '0')
      args.push(outPath)
      return args
    },

    // ═══════════════════════════════════════════
    // 模式4：音频合并（atrim + aconcat 滤镜）
    // ═══════════════════════════════════════════

    _buildAudioConcatArgs(files, settings, outPath) {
      const n = files.length
      const hasCustom = settings.customArgs && settings.customArgs.trim()
      if (hasCustom) return settings.customArgs.trim().split(/\s+/)

      // 参数优先级：用户设定 > 第一条音频 > 兜底 44100/stereo/aac
      const firstAudio = firstAudioParams(files)
      const sampleRate = settings.audioSampleRate || firstAudio?.sampleRate || 44100
      const channels = settings.audioChannels || firstAudio?.channels || 2
      const chLayout = channels === 1 ? 'mono' : 'stereo'

      // 编码器：根据输出格式选择最合适的编码器
      let codecKey = settings.audioCodec || firstAudio?.codec || 'aac'
      const ext = settings.outputFormat || 'mp3'
      const formatCodecMap = {
        mp3: 'libmp3lame', aac: 'aac', m4a: 'aac', flac: 'flac', 
        opus: 'libopus', ogg: 'libvorbis', wav: 'pcm_s16le', wma: 'wmav2'
      }
      const encoder = formatCodecMap[ext] || formatCodecMap[codecKey] || 'aac'
      const bitrate = settings.audioBitrate || '192k'

      const args = ['-y']
      // 逐文件 -i（无需哑输入）
      for (const f of files) args.push('-i', f.path)

      const filterParts = []
      const acatInputs = []

      for (let i = 0; i < n; i++) {
        const f = files[i]
        const dur = f.format?.duration ? parseFloat(f.format.duration) : 0
        const ss = f._trimStart || 0
        const to = (f._trimEnd > 0 && f._trimEnd < dur) ? f._trimEnd : dur
        const trimDur = to - ss

        if (ss > 0 || (to > 0 && to < dur)) {
          filterParts.push(`[${i}:a]atrim=start=${ss}:duration=${trimDur},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${chLayout}[a${i}]`)
        } else {
          filterParts.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${chLayout}[a${i}]`)
        }
        acatInputs.push(`[a${i}]`)
      }
      filterParts.push(`${acatInputs.join('')}concat=n=${n}:v=0:a=1[aout]`)
      args.push('-filter_complex', filterParts.join(';'))
      args.push('-map', '[aout]')
      args.push('-c:a', encoder)
      if (encoder !== 'flac' && encoder !== 'pcm_s16le') {
        args.push('-b:a', bitrate)
      }
      args.push(outPath)
      return args
    },

    /**
     * 视频配音：第一个是视频文件，其余是音频轨道
     * 例如：files = [video.mp4, audio1.mp3, audio2.m4a]
     * 输出：video 流来自 video.mp4，所有 audio 流合并到新视频的音轨中
     */
    _buildVideoDubArgs(files, settings, outPath) {
      const hasCustom = settings.customArgs && settings.customArgs.trim()
      if (hasCustom) return settings.customArgs.trim().split(/\s+/)

      const video = files[0]
      const audios = files.slice(1)
      const args = ['-y']

      // 视频输入
      args.push('-i', video.path)
      // 各个音频输入
      for (const a of audios) args.push('-i', a.path)

      const filterParts = []

      // 视频流裁剪（如果有裁剪设置）
      const vDur = video.format?.duration ? parseFloat(video.format.duration) : 0
      const vStart = video._trimStart || 0
      const vEnd = video._trimEnd || vDur
      if (vStart > 0 || (vEnd > 0 && vEnd < vDur)) {
        const vTrimDur = vEnd - vStart
        filterParts.push(`[0:v]trim=start=${vStart}:duration=${vTrimDur},setpts=PTS-STARTPTS[vout]`)
      } else {
        args.push('-map', '0:v')
      }

      // 音频流处理：合并所有音频
      const audioInputs = []
      for (let i = 0; i < audios.length; i++) {
        const a = audios[i]
        const aDur = a.format?.duration ? parseFloat(a.format.duration) : 0
        const aStart = a._trimStart || 0
        const aEnd = a._trimEnd || aDur
        const aTrimDur = aEnd - aStart

        const idx = i + 1
        if (aStart > 0 || (aEnd > 0 && aEnd < aDur)) {
          filterParts.push(`[${idx}:a]atrim=start=${aStart}:duration=${aTrimDur},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`)
        } else {
          filterParts.push(`[${idx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`)
        }
        audioInputs.push(`[a${i}]`)
      }

      if (audioInputs.length > 0) {
        if (audioInputs.length === 1) {
          filterParts.push(`${audioInputs.join('')}[aout]`)
        } else {
          filterParts.push(`${audioInputs.join('')}amix=inputs=${audioInputs.length}:duration=first[aout]`)
        }
      }

      if (filterParts.length > 0) {
        args.push('-filter_complex', filterParts.join(';'))
        if (vStart > 0 || (vEnd > 0 && vEnd < vDur)) {
          args.push('-map', '[vout]')
        }
        if (audioInputs.length > 0) {
          args.push('-map', '[aout]')
        }
      }

      // 视频编码：优先 copy，否则重新编码
      if (vStart > 0 || (vEnd > 0 && vEnd < vDur)) {
        const venc = settings.videoCodec === 'h265' ? 'libx265' : 'libx264'
        args.push('-c:v', venc)
        if (settings.preset) args.push('-preset', settings.preset)
        if (settings.rateMode === 'crf' && settings.crf != null) args.push('-crf', String(settings.crf))
        if (settings.rateMode === 'bitrate' && settings.videoBitrate) args.push('-b:v', settings.videoBitrate)
      } else {
        args.push('-c:v', 'copy')
      }

      // 音频编码
      if (audioInputs.length > 0) {
        const encoder = settings.audioCodec || 'aac'
        const encoderMap = { mp3: 'libmp3lame', aac: 'aac', flac: 'flac', opus: 'libopus', ogg: 'libvorbis', wav: 'pcm_s16le' }
        args.push('-c:a', encoderMap[encoder] || encoder)
        if (settings.audioBitrate) args.push('-b:a', settings.audioBitrate)
      }

      // 按视频时长裁剪
      args.push('-shortest')

      args.push(outPath)
      return args
    },

    // ═══════════════════════════════════════════
    // 执行
    // ═══════════════════════════════════════════

    /** 运行前刷新全局设置 */
    _prepareRun() {
      const s = loadSettings()
      this.mergeSettings.hwaccel = s.hwType || 'none'
    },

    /** 完成后操作 */
    async _onComplete(outPath) {
      const s = loadSettings()
      if (s.autoOpenDir !== false && outPath) {
        await openExternalPath(outPath)
      }
    },

    async executeMerge() {
      if (this.isRunning) return

      const files = this.mergeFiles.filter(f => f._selected)
      const op = this.mergeOperation || 'concat'

      // 视频配音：必须只能有一个视频，其他都是音频
      if (op === 'videoDub') {
        const videos = files.filter(f => f.streams?.some(s => s.codec_type === 'video'))
        if (videos.length !== 1) {
          this.lastResult = { success: false, error: `视频配音功能只能选择一个视频文件，当前有 ${videos.length} 个。请只保留一个视频，其余必须是音频。` }
          return
        }
        if (files.length < 2) {
          this.lastResult = { success: false, error: '视频配音需要至少一个音频文件' }
          return
        }
      } else if (files.length < 2) {
        this.lastResult = { success: false, error: '至少需要勾选 2 个文件进行合并' }
        return
      }

      this._prepareRun()
      this.isRunning = true
      this.resetProgress()

      const firstFile = files[0]
      let fmt = 'mp4'
      if (op === 'audioConcat') fmt = this.mergeSettings.outputFormat || 'mp3'
      else if (op === 'imagesToGif') fmt = 'gif'

      const outPath = generateOutputPath(firstFile.path, fmt, this.mergeSettings.outputDir, this.mergeSettings.outputFileName, 0)

      let args
      if (op === 'imagesToVideo') args = this._buildImagesToVideoArgs(files, this.mergeSettings, outPath)
      else if (op === 'imagesToGif') args = this._buildImagesToGifArgs(files, this.mergeSettings, outPath)
      else if (op === 'audioConcat') args = this._buildAudioConcatArgs(files, this.mergeSettings, outPath)
      else if (op === 'videoDub') args = this._buildVideoDubArgs(files, this.mergeSettings, outPath)
      else args = this._buildConcatArgs(files, this.mergeSettings, outPath)

      if (!args) { this.isRunning = false; this.lastResult = { success: false, error: '无法构建合并命令' }; return }

      try {
        const runner = useFFmpegRunner()
        const result = await runner.execute(args)
        for (const line of runner.logs.value) { this.addMergeLog(line) }
        this.lastResult = result
        this.lastResult._mergeOutputPath = outPath
        if (result.success) this.progress.percent = 100
      } finally {
        this.isRunning = false
        await this._onComplete(outPath)
      }
    },

    async cancel() {
      this.isRunning = false
    },
  },
})
