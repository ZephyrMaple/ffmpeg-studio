/**
 * FFmpeg 命令构建器
 * 根据用户设置生成 ffmpeg 命令参数数组
 */

// 输出格式预设
/**
 * 解析时间字符串为秒
 * 支持: H:M:S, M:S, 纯整数, 2h30m, 2m30s 等
 */
export function parseTime(val) {
  if (!val || !String(val).trim()) return null
  const s = String(val).trim()
  if (/^\d+$/.test(s)) return parseFloat(s)
  if (/:/.test(s)) { const p=s.split(':'); if(p.length>=3) return p[0]*3600+p[1]*60+parseFloat(p[2]); return p[0]*60+parseFloat(p[1]) }
  if (/-/.test(s)) { const p=s.split('-'); if(p.length>=3) return p[0]*3600+p[1]*60+parseFloat(p[2]); return p[0]*60+parseFloat(p[1]) }
  let t=0; const h=s.match(/(\d+)\s*h/); if(h) t+=parseInt(h[1])*3600
  const m=s.match(/(\d+)\s*m/); if(m) t+=parseInt(m[1])*60
  const sec=s.match(/(\d+)\s*s/); if(sec) t+=parseInt(sec[1])
  if(t>0) return t
  return parseFloat(s)
}

export const FORMAT_PRESETS = {
  // ── 两者皆可（音视频通用容器） ──
  mp4:  { ext: '.mp4',  label: 'MP4',   desc: '通用·H.264/AAC',     cat: 'both' },
  mkv:  { ext: '.mkv',  label: 'MKV',   desc: '开源万能容器',         cat: 'both' },
  mov:  { ext: '.mov',  label: 'MOV',   desc: 'Apple QuickTime',     cat: 'both' },
  ts:   { ext: '.ts',   label: 'TS',    desc: 'MPEG 传输流',         cat: 'both' },
  avi:  { ext: '.avi',  label: 'AVI',   desc: '传统音视频容器',       cat: 'both' },
  webm: { ext: '.webm', label: 'WebM',  desc: '网页·VP9/Opus',       cat: 'both' },
  flv:  { ext: '.flv',  label: 'FLV',   desc: 'Flash 流媒体',        cat: 'both' },
  ogv:  { ext: '.ogv',  label: 'OGV',   desc: 'Ogg 视频封装',        cat: 'both' },
  mpg:  { ext: '.mpg',  label: 'MPG',   desc: 'MPEG-PS·DVD/VCD',     cat: 'both' },
  f4v:  { ext: '.f4v',  label: 'F4V',   desc: '基于 MP4 流媒体',     cat: 'both' },
  wmv:  { ext: '.wmv',  label: 'WMV',   desc: 'Windows Media 视频',  cat: 'both' },
  // ── 纯音频容器 ──
  mp3:  { ext: '.mp3',  label: 'MP3',   desc: 'MPEG 音频',           cat: 'audio' },
  wav:  { ext: '.wav',  label: 'WAV',   desc: 'PCM 无损',            cat: 'audio' },
  aac:  { ext: '.aac',  label: 'AAC',   desc: 'AAC 裸流',            cat: 'audio' },
  flac: { ext: '.flac', label: 'FLAC',  desc: '无损压缩',            cat: 'audio' },
  ogg:  { ext: '.ogg',  label: 'OGG',   desc: 'Vorbis/Opus 音频',    cat: 'audio' },
  m4a:  { ext: '.m4a',  label: 'M4A',   desc: 'AAC·MP4 音频分支',    cat: 'audio' },
  wma:  { ext: '.wma',  label: 'WMA',   desc: 'Windows 音频',        cat: 'audio' },
  opus: { ext: '.opus', label: 'OPUS',  desc: '低延迟高质量',        cat: 'audio' },
  // ── 图片 / 序列 ──
  gif:  { ext: '.gif',  label: 'GIF',   desc: '动图·动画图片',       cat: 'image' },
  jpg:  { ext: '.jpg',  label: 'JPG',   desc: 'JPEG 图片',           cat: 'image' },
  png:  { ext: '.png',  label: 'PNG',   desc: 'PNG 无损图片',        cat: 'image' },
  webp: { ext: '.webp', label: 'WebP',  desc: 'WebP 高效图片',       cat: 'image' },
  bmp:  { ext: '.bmp',  label: 'BMP',   desc: '位图',                cat: 'image' },
  tiff: { ext: '.tiff', label: 'TIFF',  desc: 'TIFF 无损',           cat: 'image' },
  // ── 字幕容器 ──
  srt:  { ext: '.srt',  label: 'SRT',   desc: 'SubRip 文本字幕',     cat: 'subtitle' },
  ass:  { ext: '.ass',  label: 'ASS',   desc: 'ASS 高级字幕',        cat: 'subtitle' },
  vtt:  { ext: '.vtt',  label: 'VTT',   desc: 'WebVTT 网页字幕',     cat: 'subtitle' },
  // ── 流媒体（索引/清单） ──
  m3u8: { ext: '.m3u8', label: 'HLS',   desc: 'HTTP Live Streaming', cat: 'stream' },
}

// 视频编码器映射
export const VIDEO_CODECS = {
  h264:    { value: 'libx264',   label: 'H.264（x264）',   formats: ['mp4','mkv','mov','avi','flv'] },
  h265:    { value: 'libx265',   label: 'H.265 / HEVC（x265）', formats: ['mp4','mkv','mov'] },
  vp9:     { value: 'libvpx-vp9',label: 'VP9',             formats: ['webm','mkv'] },
  vp8:     { value: 'libvpx',    label: 'VP8',             formats: ['webm','mkv'] },
  av1:     { value: 'libaom-av1',label: 'AV1',             formats: ['mp4','mkv','webm'] },
  mpeg4:   { value: 'mpeg4',     label: 'MPEG-4',          formats: ['mp4','avi'] },
  copy:    { value: 'copy',      label: '直接复制（不重编码）', formats: ['mp4','mkv','mov','avi','flv','ts','webm'] },
  none:    { value: null,        label: '无视频（仅音频）', formats: ['mp3','wav','aac','flac','ogg','m4a','wma','opus'] },
}

// 音频编码器映射
export const AUDIO_CODECS = {
  aac:   { value: 'aac',        label: 'AAC',           formats: ['mp4','mkv','mov','flv','ts','m4a'] },
  mp3:   { value: 'libmp3lame', label: 'MP3',           formats: ['mp3','mkv','mov'] },
  opus:  { value: 'libopus',    label: 'Opus',          formats: ['webm','mkv','ogg','opus'] },
  vorbis:{ value: 'libvorbis',  label: 'Vorbis',        formats: ['webm','mkv','ogg'] },
  flac:  { value: 'flac',       label: 'FLAC 无损',     formats: ['flac','mkv','ogg'] },
  pcm:   { value: 'pcm_s16le',  label: 'PCM 16位',      formats: ['wav'] },
  ac3:   { value: 'ac3',        label: 'AC3 / Dolby Digital',     formats: ['mp4','mkv','mov','avi','ts'] },
  eac3:  { value: 'eac3',       label: 'E-AC3 / Dolby Digital Plus', formats: ['mp4','mkv','mov'] },
  dts:   { value: 'dts',        label: 'DTS',            formats: ['mp4','mkv','mov','avi'] },
  alac:  { value: 'alac',       label: 'ALAC / Apple Lossless',    formats: ['mp4','mkv','mov','m4a'] },
  copy:  { value: 'copy',       label: '直接复制',       formats: ['mp4','mkv','mov','avi','flv','ts','webm','ogg','m4a','wma','opus'] },
  none:  { value: null,         label: '无音频',         formats: ['mp4','mkv','mov','avi','flv','ts','webm','gif','ogg','m4a','wma','opus'] },
}

// 分辨率预设
export const RESOLUTION_PRESETS = [
  { value: 'original', label: '原始分辨率' },
  { value: '3840x2160',label: '4K 超高清（3840×2160）' },
  { value: '2560x1440',label: '2K（2560×1440）' },
  { value: '1920x1080',label: '1080p 全高清（1920×1080）' },
  { value: '1280x720', label: '720p 高清（1280×720）' },
  { value: '854x480',  label: '480p（854×480）' },
  { value: '640x360',  label: '360p（640×360）' },
  { value: 'custom',   label: '自定义' },
]

// 帧率预设
export const FPS_PRESETS = [15, 20, 24, 25, 29.97, 30, 48, 50, 60]

// 视频码率预设
export const VIDEO_BITRATE_PRESETS = ['500k', '1M', '2M', '4M', '6M', '8M', '10M', '15M', '20M']

// 音频码率预设
export const AUDIO_BITRATE_PRESETS = ['32k', '48k', '64k', '96k', '128k', '160k', '192k', '224k', '256k', '320k']

// 像素格式预设
export const PIXEL_FORMAT_PRESETS = ['yuv420p', 'yuv422p', 'yuv444p', 'yuv420p10le', 'rgb24', 'rgba', 'nv12', 'nv21']

// 采样率预设
export const SAMPLE_RATE_PRESETS = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 96000]

// 声道预设
export const CHANNEL_PRESETS = [
  { value: 1, label: '单声道 (1.0)' },
  { value: 2, label: '立体声 (2.0)' },
  { value: 3, label: '2.1 声道' },
  { value: 6, label: '5.1 环绕声' },
  { value: 7, label: '6.1 环绕声' },
  { value: 8, label: '7.1 环绕声' },
]

// x264/x265 编码速度预设
export const PRESETS = [
  { value: 'ultrafast', label: '极速（画质最低）' },
  { value: 'superfast', label: '超快' },
  { value: 'veryfast',  label: '很快' },
  { value: 'faster',    label: '较快' },
  { value: 'fast',      label: '快' },
  { value: 'medium',    label: '中等（默认）' },
  { value: 'slow',      label: '慢' },
  { value: 'slower',    label: '较慢' },
  { value: 'veryslow',  label: '极慢（画质最高）' },
]

// 硬件加速选项
export const HWACCEL_OPTIONS = [
  { value: 'none',    label: '不使用',       encoders: {} },
  { value: 'cuda',    label: 'NVIDIA CUDA（NVENC 硬件编码）', encoders: {
      h264: 'h264_nvenc', h265: 'hevc_nvenc'
    }},
  { value: 'qsv',     label: 'Intel QSV（快速同步视频）',   encoders: {
      h264: 'h264_qsv', h265: 'hevc_qsv'
    }},
  { value: 'amf',     label: 'AMD AMF（硬件编码）',     encoders: {
      h264: 'h264_amf', h265: 'hevc_amf'
    }},
]

/**
 * 构建完整的 FFmpeg 命令参数
 * @param {Object} settings - 转码设置
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @param {Object|null} timeline - 时间轴状态（可选，用于分离裁剪）
 * @param {boolean} hasVideo - 是否有视频流
 * @param {boolean} hasAudio - 是否有音频流
 * @returns {string[]} FFmpeg 参数数组
 */
export function buildFFmpegCommand(settings, inputPath, outputPath, timeline = null, hasVideo = true, hasAudio = true) {
  // ── 如果填写了自定义参数，完全由用户控制整个指令（含 -y） ──
  if (settings.customArgs && settings.customArgs.trim()) {
    return settings.customArgs.trim().split(/\s+/)
  }

  const args = ['-y']

  // 硬件加速 (仅解码)
  if (settings.hwaccel && settings.hwaccel !== 'none') {
    args.push('-hwaccel', settings.hwaccel)
  }

  // ── 分离式裁剪：视频/音频各自不同的 trim 范围，用 filter_complex ──
  const useComplexTrim = timeline && !timeline.linked &&
    hasVideo && hasAudio &&
    (timeline.videoStart > 0 || timeline.videoEnd > 0 || timeline.audioStart > 0 || timeline.audioEnd > 0)

  if (useComplexTrim) {
    // 先添加输入，再用 filter_complex 做各轨裁剪
    args.push('-i', inputPath)

    const filterParts = []
    const mapParts = []
    let fi = 0

    if (hasVideo) {
      const vs = timeline.videoStart || 0
      const ve = timeline.videoEnd || 0
      const veArg = ve > 0 ? `:end=${ve}` : ''
      filterParts.push(`[0:v]trim=start=${vs}${veArg},setpts=PTS-STARTPTS[v]`)
      mapParts.push('-map', `[v]`)
    }

    if (hasAudio) {
      const as = timeline.audioStart || 0
      const ae = timeline.audioEnd || 0
      const aeArg = ae > 0 ? `:end=${ae}` : ''
      filterParts.push(`[0:a]atrim=start=${as}${aeArg},asetpts=PTS-STARTPTS[a]`)
      mapParts.push('-map', `[a]`)
    }

    args.push('-filter_complex', filterParts.join(';'))
    args.push(...mapParts)
  } else {
    // 普通裁剪：用 -ss / -t
    if (settings.trimStart) {
      args.push('-ss', settings.trimStart)
    }
    args.push('-i', inputPath)
    if (settings.trimDuration && settings.trimDuration !== '0') {
      args.push('-t', settings.trimDuration)
    }
  }

  const isGif = settings.outputFormat === 'gif'

  // ── 图片输入：无视频流时跳过视频编码器，让 FFmpeg 按输出扩展名自动选择 ──
  if (!isGif && !hasVideo) {
    if (settings.imageSize && settings.imageScale && settings.imageScale !== 'original' && settings.imageScale !== 'custom') {
      const [w, h] = settings.imageScale.split(/[xX*\u00D7:：\s]/).filter(Boolean)
      if (w && h) args.push('-vf', `scale=${w}:${h}`)
    } else if (settings.imageSize && settings.imageScale === 'custom') {
      const [w, h] = settings.imageSize.split(/[xX*\u00D7:：\s]/).filter(Boolean)
      if (w && h) args.push('-vf', `scale=${w}:${h}`)
    }
    const inExt = (inputPath.split('.').pop() || '').toLowerCase()
    const outExt = settings.outputFormat
    // 透明背景填充
    if (settings.imageBgColor && settings.outputFormat === 'jpg' && (inExt === 'png' || inExt === 'webp')) {
      args.push('-vf', `${args[args.length-1]},pad=ceil(iw/2)*2:ceil(ih/2)*2:color=${settings.imageBgColor}`)
    }
    // JPG 质量
    if (settings.imageQuality && outExt === 'jpg') {
      args.push('-q:v', String(Math.max(1, Math.min(31, Math.round(31 - (settings.imageQuality - 1) * 30 / 99)))))
    }
  } else if (isGif) {
    // GIF 特殊处理
    const filters = [`fps=${settings.fps || 15}`]
    const scaleFilter = getScaleFilter(settings)
    if (scaleFilter) filters.push(scaleFilter)
    filters.push('split[s0][s1]')
    const filterStr = filters.join(',') + ';[s0]palettegen[p];[s1][p]paletteuse'
    args.push('-vf', filterStr)
    args.push('-loop', '0')
  } else {
    // 视频处理
    const vCodecSetting = settings.videoCodec || 'h264'
    const vCodecMap = VIDEO_CODECS[vCodecSetting] || VIDEO_CODECS['h264']

    if (vCodecMap.value === null) {
      args.push('-vn')
    } else {
      let encoder = vCodecMap.value
      if (settings.hwaccel && settings.hwaccel !== 'none' && settings.videoCodec !== 'copy') {
        const hwOpt = HWACCEL_OPTIONS.find(h => h.value === settings.hwaccel)
        if (hwOpt && hwOpt.encoders[vCodecSetting]) encoder = hwOpt.encoders[vCodecSetting]
      }

      if (settings.videoCodec === 'copy') {
        args.push('-c:v', 'copy')
      } else {
        args.push('-c:v', encoder)

        if (settings.preset && (encoder.includes('x264') || encoder.includes('x265'))) {
          args.push('-preset', settings.preset)
        }
        if (settings.rateMode === 'crf' && settings.crf != null) {
          args.push('-crf', String(settings.crf))
        } else if (settings.videoBitrate) {
          args.push('-b:v', settings.videoBitrate)
        }
        if (settings.fps) args.push('-r', String(settings.fps))
        const scaleFilter = getScaleFilter(settings)
        if (scaleFilter) args.push('-vf', scaleFilter)
        if (settings.pixelFormat) args.push('-pix_fmt', settings.pixelFormat)
      }
    }
  }

  // ── 音频处理 ──
  if (!isGif && hasAudio) {
    let aCodecSetting = settings.audioCodec || 'aac'

    // 自动纠正：copy 在部分容器（如 mp3 / wmv）不兼容
    if (aCodecSetting === 'copy') {
      const srcExt = inputPath.split('.').pop().toLowerCase()
      if (srcExt !== settings.outputFormat) {
        const fmt = settings.outputFormat
        if (fmt === 'mp3' || fmt === 'mp2') aCodecSetting = 'mp3'
        else if (fmt === 'flac') aCodecSetting = 'flac'
        else if (fmt === 'opus') aCodecSetting = 'opus'
        else if (fmt === 'ogg' || fmt === 'oga') aCodecSetting = 'vorbis'
        else if (fmt === 'wav') aCodecSetting = 'pcm'
      }
    }

    // 自动纠正：用户选择的编码器和输出容器不兼容
    const aCodecMap = AUDIO_CODECS[aCodecSetting]
    const outFmtCompat = aCodecMap?.formats || []
    if (!outFmtCompat.includes(settings.outputFormat)) {
      const fmt = settings.outputFormat
      const compatKeys = ['copy', 'none'] // 排除这些
      for (const key of Object.keys(AUDIO_CODECS)) {
        if (compatKeys.includes(key)) continue
        if (AUDIO_CODECS[key].formats.includes(fmt)) {
          aCodecSetting = key
          break
        }
      }
    }

    const aCodecMapUsed = AUDIO_CODECS[aCodecSetting]

    if (aCodecMapUsed.value === null) {
      args.push('-an')
    } else if (aCodecSetting === 'copy') {
      args.push('-c:a', 'copy')
    } else {
      args.push('-c:a', aCodecMapUsed.value)
      if (settings.audioBitrate) {
        args.push('-b:a', settings.audioBitrate)
      }
      if (settings.audioSampleRate) {
        args.push('-ar', String(settings.audioSampleRate))
      }
      if (settings.audioChannels) {
        args.push('-ac', String(settings.audioChannels))
      }
    }

    // 音量调节 — volume 是音频滤镜，始终使用 -af
    if (settings.volume != null && settings.volume !== 100) {
      const volFilter = `volume=${settings.volume / 100}`
      args.push('-af', volFilter)
    }
  }

  // 输出文件
  args.push(outputPath)

  return args
}

/**
 * 获取 scale 滤镜字符串
 */
function getScaleFilter(settings) {
  if (settings.resolution === 'original' || !settings.resolution) {
    return null
  }
  if (settings.resolution === 'custom') {
    if (settings.customWidth && settings.customHeight) {
      return `scale=${settings.customWidth}:${settings.customHeight}`
    }
    return null
  }
  return `scale=${settings.resolution.replace('x', ':')}`
}

/**
 * 根据输入文件路径和输出格式生成输出文件路径
 * @param {string} inputPath - 输入文件路径（多文件时传第一个）
 * @param {string} outputFormat - 输出格式
 * @param {string} outputDir - 输出目录
 * @param {string} customName - 自定义文件名（不含扩展名）
 * @param {number} fileIndex - 文件序号（批量时用）
 */
export function generateOutputPath(inputPath, outputFormat, outputDir, customName = '', fileIndex = -1) {
  const ext = FORMAT_PRESETS[outputFormat]?.ext || '.mp4'
  // 纯字符串操作，兼容浏览器环境
  const lastSep = Math.max(inputPath.lastIndexOf('/'), inputPath.lastIndexOf('\\'))
  const dir = (outputDir || (lastSep >= 0 ? inputPath.substring(0, lastSep) : '.')).replace(/\\/g, '/')
  const fileName = lastSep >= 0 ? inputPath.substring(lastSep + 1) : inputPath
  const dotIdx = fileName.lastIndexOf('.')
  const basename = dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName

  let outName
  if (customName && customName.trim()) {
    // 自定义文件名：多文件时追加序号
    outName = customName.trim()
    if (fileIndex >= 0) {
      outName += `_${String(fileIndex + 1).padStart(2, '0')}`
    }
  } else {
    // 默认：第一个文件名称 + _converted
    outName = `${basename}_converted`
  }
  return `${dir}/${outName}${ext}`
}

/**
 * 构建视频合并(concat)命令
 * @param {Object[]} files - 文件列表 [{ path, name }]
 * @param {Object} settings - 输出设置
 * @param {string} outputPath - 输出文件路径
 * @returns {string[]} FFmpeg 参数数组
 */
export function buildConcatCommand(files, settings, outputPath) {
  const args = ['-y']
  const hasCustom = settings.customArgs && settings.customArgs.trim()

  // 如果填写了自定义参数，完全由用户控制整个指令
  if (hasCustom) {
    const custom = settings.customArgs.trim().split(/\s+/)
    args.push(...custom)
    return args
  }

  // 使用 concat 协议拼接多个文件（file1|file2|file3）
  const concatInput = files.map(f => f.path || f).join('|')
  args.push('-i', `concat:${concatInput}`)

  // 编码设置 - 不复用 -c copy，改为逐流指定以兼容格式差异
  const vCodecSetting = settings.videoCodec || 'copy'
  let aCodecSetting = settings.audioCodec || 'copy'
  const outFmt = (settings.outputFormat || 'mp4').toLowerCase()

  if (vCodecSetting === 'copy') {
    args.push('-c:v', 'copy')
  } else {
    const vCodecMap = VIDEO_CODECS[vCodecSetting]
    if (vCodecMap) args.push('-c:v', vCodecMap.value)
  }

  // 自动纠正音频编码器与容器不兼容
  if (aCodecSetting === 'copy') {
    if (outFmt === 'mp3' || outFmt === 'mp2') aCodecSetting = 'mp3'
    else if (outFmt === 'flac') aCodecSetting = 'flac'
    else if (outFmt === 'opus') aCodecSetting = 'opus'
    else if (outFmt === 'ogg' || outFmt === 'oga') aCodecSetting = 'vorbis'
    else if (outFmt === 'wav') aCodecSetting = 'pcm'
  }
  if (aCodecSetting !== 'copy' && aCodecSetting !== 'none') {
    const acMap = AUDIO_CODECS[aCodecSetting]
    if (acMap && !acMap.formats.includes(outFmt)) {
      for (const key of Object.keys(AUDIO_CODECS)) {
        if (key === 'copy' || key === 'none') continue
        if (AUDIO_CODECS[key].formats.includes(outFmt)) { aCodecSetting = key; break }
      }
    }
  }

  if (aCodecSetting === 'copy') {
    args.push('-c:a', 'copy')
  } else {
    const aCodecMap = AUDIO_CODECS[aCodecSetting]
    if (aCodecMap && aCodecMap.value) args.push('-c:a', aCodecMap.value)
  }

  args.push(outputPath)
  return args
}

/**
 * 构建图片序列转 GIF 命令
 * @param {Object[]} files - 文件列表（图片）
 * @param {Object} settings - 输出设置
 * @param {string} outputPath - 输出文件路径
 * @returns {string[]} FFmpeg 参数数组
 */
export function buildImagesToGifCommand(files, settings, outputPath) {
  const args = ['-y']
  const hasCustom = settings.customArgs && settings.customArgs.trim()

  // 如果填写了自定义参数，完全由用户控制整个指令
  if (hasCustom) {
    const custom = settings.customArgs.trim().split(/\s+/)
    args.push(...custom)
    return args
  }

  const fps = settings.fps || 10
  const outputFormat = settings.outputFormat || 'gif'

  if (files.length >= 2) {
    // 多图片：用 concat 滤镜合成
    for (const file of files) {
      args.push('-i', file.path || file)
    }
    const inputs = files.map((_, i) => `[${i}:v]`).join('')
    const filterComplex = `${inputs}concat=n=${files.length}:v=1:a=0,scale=${settings.resolution !== 'original' ? settings.resolution + ':flags=lanczos' : 'iw:ih'}[v]`
    args.push('-filter_complex', filterComplex)
    args.push('-map', '[v]')
    args.push('-r', String(fps))
    args.push('-loop', '0')

    if (outputFormat !== 'gif') {
      args.push('-c:v', VIDEO_CODECS[settings.videoCodec]?.value || 'libx264')
    }
  } else if (files.length === 1) {
    // 单图片转 GIF
    args.push('-i', files[0].path || files[0])
    const loops = settings.loopCount != null ? String(settings.loopCount) : '0'
    args.push('-vf', `fps=${fps},scale=${settings.resolution !== 'original' ? settings.resolution + ':flags=lanczos' : 'iw:ih'}`)
    args.push('-loop', loops)
  }

  args.push(outputPath)
  return args
}

/**
 * 构建图片序列转视频命令
 */
export function buildImagesToVideoCommand(files, settings, outputPath) {
  const args = ['-y']
  const fps = settings.fps || 24
  const hasCustom = settings.customArgs && settings.customArgs.trim()

  // 如果填写了自定义参数，完全由用户控制整个指令
  if (hasCustom) {
    const custom = settings.customArgs.trim().split(/\s+/)
    args.push(...custom)
    return args
  }

  if (files.length >= 2) {
    // 使用 concat 滤镜
    for (const file of files) {
      args.push('-i', file.path || file)
    }
    const inputs = files.map((_, i) => `[${i}:v]`).join('')
    const filterComplex = `${inputs}concat=n=${files.length}:v=1:a=0`
    args.push('-filter_complex', filterComplex)
    args.push('-map', '[v]')

    if (settings.videoCodec && settings.videoCodec !== 'none') {
      const vCodecMap = VIDEO_CODECS[settings.videoCodec]
      if (vCodecMap) args.push('-c:v', vCodecMap.value)
    }
    args.push('-r', String(fps))

    // 分辨率
    if (settings.resolution && settings.resolution !== 'original' && settings.resolution !== 'custom') {
      const vfIdx = args.indexOf('-filter_complex')
      if (vfIdx >= 0) {
        args[vfIdx + 1] = `${args[vfIdx + 1]},scale=${settings.resolution}`
      }
    }
  }

  args.push(outputPath)
  return args
}

export function buildAudioConcatCommand(files, settings, outputPath) {
  const args = ['-y']
  const hasCustom = settings.customArgs && settings.customArgs.trim()

  // 如果填写了自定义参数，完全由用户控制
  if (hasCustom) {
    const custom = settings.customArgs.trim().split(/\s+/)
    args.push(...custom)
    return args
  }

  // 逐个添加输入
  for (const file of files) {
    args.push('-i', file.path || file)
  }

  // 使用 filter_complex 将多个音频流串联
  const n = files.length
  const inputs = files.map((_, i) => `[${i}:a]`).join('')
  const filterComplex = `${inputs}concat=n=${n}:v=0:a=1[a]`
  args.push('-filter_complex', filterComplex)
  args.push('-map', '[a]')

  // 音频编码
  let aCodecSetting = settings.audioCodec || 'aac'

  // 自动纠正编码器与容器不兼容
  if (aCodecSetting === 'copy') {
    const fmt = (settings.outputFormat || 'mp3').toLowerCase()
    if (fmt === 'flac') aCodecSetting = 'flac'
    else if (fmt === 'opus') aCodecSetting = 'opus'
    else if (fmt === 'ogg' || fmt === 'oga') aCodecSetting = 'vorbis'
    else if (fmt === 'wav') aCodecSetting = 'pcm'
  }
  if (aCodecSetting !== 'copy' && aCodecSetting !== 'none') {
    const acMap = AUDIO_CODECS[aCodecSetting]
    const fmt = (settings.outputFormat || 'mp3').toLowerCase()
    if (acMap && !acMap.formats.includes(fmt)) {
      for (const key of Object.keys(AUDIO_CODECS)) {
        if (key === 'copy' || key === 'none') continue
        if (AUDIO_CODECS[key].formats.includes(fmt)) { aCodecSetting = key; break }
      }
    }
  }

  const aCodecMap = AUDIO_CODECS[aCodecSetting]

  if (aCodecMap?.value === null) {
    args.push('-an')
  } else if (aCodecSetting === 'copy') {
    const fmt = (settings.outputFormat || 'mp3').toLowerCase()
    if (fmt === 'flac') args.push('-c:a', 'flac')
    else if (fmt === 'opus') args.push('-c:a', 'libopus')
    else if (fmt === 'ogg' || fmt === 'oga') args.push('-c:a', 'libvorbis')
    else if (fmt === 'wav') args.push('-c:a', 'pcm_s16le')
    else args.push('-c:a', 'copy')
  } else if (aCodecMap) {
    args.push('-c:a', aCodecMap.value)
    if (settings.audioBitrate) args.push('-b:a', settings.audioBitrate)
    if (settings.audioSampleRate) args.push('-ar', String(settings.audioSampleRate))
    if (settings.audioChannels) args.push('-ac', String(settings.audioChannels))
  }

  args.push(outputPath)
  return args
}

/**
 * 将参数数组格式化为可读命令字符串
 */
export function formatCommandString(args) {
  return 'ffmpeg ' + args.map(a => {
    // 仅当参数包含空格时加引号；: 不需要（FFmpeg 参数中的 : 如 -c:v 不需要引号）
    if (a.includes(' ')) {
      return `"${a}"`
    }
    return a
  }).join(' ')
}

// ─────────────────────────────────────────────
// 防呆验证
// ─────────────────────────────────────────────

/**
 * 验证时间格式（支持 HH:MM:SS、HH:MM:SS.mm、纯秒数）
 */
function isValidTimeFormat(str) {
  if (!str || !str.trim()) return true // 空值合法（不裁剪）
  const s = str.trim()
  // 纯数字（秒）
  if (/^\d+(\.\d+)?$/.test(s)) return true
  // HH:MM:SS 或 HH:MM:SS.mm
  if (/^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) return true
  // MM:SS 或 MM:SS.mm
  if (/^\d{1,2}:\d{2}(\.\d+)?$/.test(s)) return true
  return false
}

/**
 * 验证转码设置，返回错误和警告列表
 * @param {Object} settings - 转码设置
 * @param {Object|null} file - 当前选中的文件信息（含 format/streams）
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateSettings(settings, file = null) {
  const errors = []
  const warnings = []
  const fmt = settings.outputFormat
  const isGif = fmt === 'gif'
  const vCodecKey = settings.videoCodec || 'h264'
  const aCodecKey = settings.audioCodec || 'aac'

  // ── 1. 直接复制 + 分辨率/帧率冲突 ──
  if (vCodecKey === 'copy') {
    if (settings.resolution && settings.resolution !== 'original') {
      warnings.push('视频编码为「直接复制」时修改分辨率无效，FFmpeg 将忽略')
    }
    if (settings.fps) {
      warnings.push('视频编码为「直接复制」时修改帧率无效，FFmpeg 将忽略')
    }
  }

  // ── 5. 自定义分辨率校验 ──
  if (settings.resolution === 'custom') {
    const w = parseInt(settings.customWidth)
    const h = parseInt(settings.customHeight)
    if (!w || w < 2 || w > 16384) {
      errors.push('自定义宽度必须是 2~16384 之间的整数')
    }
    if (!h || h < 2 || h > 16384) {
      errors.push('自定义高度必须是 2~16384 之间的整数')
    }
    // 宽高需为偶数（部分编码器要求）
    if (w && w % 2 !== 0) {
      warnings.push(`自定义宽度 ${w} 为奇数，部分编码器要求偶数，建议调整为 ${w + 1}`)
    }
    if (h && h % 2 !== 0) {
      warnings.push(`自定义高度 ${h} 为奇数，部分编码器要求偶数，建议调整为 ${h + 1}`)
    }
  }

  // ── 6. 码率模式校验 ──
  if (settings.rateMode === 'bitrate') {
    if (!settings.videoBitrate || !settings.videoBitrate.trim()) {
      errors.push('码率控制模式为「固定码率」时必须填写视频码率')
    } else if (!/^\d+[kKmM]?$/.test(settings.videoBitrate.trim())) {
      errors.push(`视频码率「${settings.videoBitrate}」格式无效，请使用如 4M、2500k 的格式`)
    }
  }

  // ── 7. 时间裁剪格式校验 ──
  if (!isValidTimeFormat(settings.trimStart)) {
    errors.push(`起始时间「${settings.trimStart}」格式无效，请使用 HH:MM:SS 或秒数（如 90）`)
  }
  if (!isValidTimeFormat(settings.trimDuration)) {
    errors.push(`持续时间「${settings.trimDuration}」格式无效，请使用 HH:MM:SS 或秒数（如 30）`)
  }

  // ── 8. 裁剪时间逻辑校验 ──
  if (file && file.format && file.format.duration) {
    const totalSec = parseFloat(file.format.duration) || 0
    const startSec = parseTimeToSeconds(settings.trimStart)
    const durSec = parseTimeToSeconds(settings.trimDuration)
    if (startSec != null && totalSec > 0 && startSec >= totalSec) {
      errors.push(`起始时间（${startSec.toFixed(1)}秒）超过了视频总时长（${totalSec.toFixed(1)}秒）`)
    }
    if (startSec != null && durSec != null && totalSec > 0) {
      if (startSec + durSec > totalSec + 0.5) {
        warnings.push(`裁剪范围（${startSec.toFixed(1)}s + ${durSec.toFixed(1)}s）超出视频总时长（${totalSec.toFixed(1)}秒），超出部分将被忽略`)
      }
    }
  }

  // ── 9. GIF 输出警告 ──
  if (isGif && file && file.format && file.format.duration) {
    const dur = parseFloat(file.format.duration) || 0
    if (dur > 30) {
      warnings.push(`GIF 输出时长约 ${dur.toFixed(1)} 秒，文件可能非常大，建议先裁剪到 15 秒以内`)
    }
  }

  // ── 10. 硬件加速 + copy 冲突 ──
  if (settings.hwaccel && settings.hwaccel !== 'none' && vCodecKey === 'copy') {
    warnings.push('硬件加速对「直接复制」模式无效，已自动忽略硬件加速')
  }

  // ── 11. 多文件操作验证 ──
  const op = settings.operation || 'single'
  const fileCount = (file && file._totalFiles) || 0

  if (op === 'concat') {
    if (fileCount < 2) {
      errors.push('视频合并至少需要 2 个文件')
    }
  } else if (op === 'audioConcat') {
    if (fileCount < 2) {
      errors.push('音频合并至少需要 2 个文件')
    }
  } else if (op === 'imagesToGif' || op === 'imagesToVideo') {
    if (fileCount < 1) {
      errors.push('请至少勾选 1 个图片文件')
    } else if (op === 'imagesToGif' && fileCount < 2) {
      warnings.push('图片转 GIF 建议至少 2 张图，1 张图将生成静态 GIF')
    }
    // 检查是否都是图片
    if (file && file._notAllImages) {
      errors.push('图片序列操作只支持图片文件')
    }
    if (op === 'imagesToGif' && fmt !== 'gif') {
      warnings.push(`当前操作是「图片转 GIF」，但输出格式选择的是「${FORMAT_PRESETS[fmt]?.label || fmt}」，将强制输出为 GIF`)
    }
  }

  return { errors, warnings }
}

/**
 * 将时间字符串解析为秒数（解析失败返回 null）
 */
export function parseTimeToSeconds(str) {
  if (!str || !str.trim()) return null
  const s = str.trim()
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s)
  const parts = s.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}
