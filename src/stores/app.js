import { defineStore } from 'pinia'
import { loadSettings } from '@/utils/platform'

/**
 * 共享状态 Store：不属于转换或合并任一方的基础状态
 */
export const useAppStore = defineStore('app', {
  state: () => ({
    // ── 活动标签页 ──
    activeTab: 'convert',

    // ── 左侧导航栏显示状态 ──
    sidebarVisible: true,

    // ── 全局设置缓存 ──
    settings: {
      autoShowLog: true,
      autoOpenDir: true,
      hwaccel: 'none',
    },

    // ── 时间轴（裁剪状态，不绑定具体文件） ──
    timeline: {
      linked: true,       // 视频/音频轨道是否绑定
      start: 0,           // 裁剪起始（秒）
      end: 0,             // 裁剪结束（秒），0 = 末尾
      videoStart: 0,
      videoEnd: 0,
      audioStart: 0,
      audioEnd: 0,
      ready: false,       // 时间轴是否已初始化
      playing: false,     // 是否正在播放预览
      currentTime: 0,     // 当前播放位置（秒）
    },
  }),

  actions: {
    /** 从 localStorage 刷新全局设置 */
    refreshSettings() {
      const s = loadSettings()
      this.settings.autoShowLog = s.autoShowLog !== false
      this.settings.autoOpenDir = s.autoOpenDir !== false
      this.settings.hwaccel = s.hwType || 'none'
    },

    setActiveTab(tab) {
      this.activeTab = tab
    },

    /** 切换左侧导航栏显示/隐藏 */
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible
    },

    /** 根据文件时长初始化时间轴范围 */
    initTimeline(duration = 0) {
      const t = this.timeline
      t.ready = duration > 0
      t.start = 0
      t.end = 0
      t.videoStart = 0
      t.videoEnd = 0
      t.audioStart = 0
      t.audioEnd = 0
      t.currentTime = 0
      t.playing = false
    },

    /** 切换视频/音频轨道链接 */
    toggleTimelineLink(hasVideo = false, hasAudio = false) {
      const t = this.timeline
      if (t.linked) {
        // 断开链接：保存共享值到各自轨道
        t.videoStart = t.start
        t.videoEnd = t.end
        t.audioStart = t.start
        t.audioEnd = t.end
      } else {
        // 重新链接：以视频轨为准（如有）
        const vs = hasVideo ? t.videoStart : t.audioStart
        const ve = hasVideo ? t.videoEnd : t.audioEnd
        t.start = vs
        t.end = ve
        t.videoStart = vs
        t.videoEnd = ve
        t.audioStart = vs
        t.audioEnd = ve
      }
      t.linked = !t.linked
    },

    /** 设置裁剪点（不依赖 store 文件时长，由调用方传入 duration） */
    setTimelineTrim(track, type, value, duration = 0) {
      const t = this.timeline
      const dur = duration || 1
      const clamped = Math.max(0, Math.min(value, dur))

      if (t.linked) {
        if (type === 'start') {
          t.start = clamped >= (t.end || dur) ? (t.end || dur) - 0.001 : clamped
        } else {
          t.end = clamped <= t.start ? t.start + 0.001 : (clamped >= dur ? 0 : clamped)
        }
        t.videoStart = t.start
        t.videoEnd = t.end
        t.audioStart = t.start
        t.audioEnd = t.end
      } else {
        if (track === 'video') {
          if (type === 'start') {
            t.videoStart = clamped >= (t.videoEnd || dur) ? (t.videoEnd || dur) - 0.001 : clamped
          } else {
            t.videoEnd = clamped <= t.videoStart ? t.videoStart + 0.001 : (clamped >= dur ? 0 : clamped)
          }
        } else if (track === 'audio') {
          if (type === 'start') {
            t.audioStart = clamped >= (t.audioEnd || dur) ? (t.audioEnd || dur) - 0.001 : clamped
          } else {
            t.audioEnd = clamped <= t.audioStart ? t.audioStart + 0.001 : (clamped >= dur ? 0 : clamped)
          }
        }
      }
    },

    /** 重置时间轴裁剪到全范围 */
    resetTimelineTrim() {
      const t = this.timeline
      t.start = 0
      t.end = 0
      t.videoStart = 0
      t.videoEnd = 0
      t.audioStart = 0
      t.audioEnd = 0
    },
  },
})
