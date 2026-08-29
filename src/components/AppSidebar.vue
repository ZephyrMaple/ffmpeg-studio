<template>
  <aside class="sidebar" :class="{ collapsed }">
    <!-- Logo 区域 -->
    <div class="logo-area" :class="{ centered: collapsed }">
      <div class="logo-icon" :class="{ clickable: true, centered: collapsed }" @click="toggleCollapse" :title="collapsed ? '展开' : '收起'">
        <el-icon :size="26"><Film /></el-icon>
      </div>
      <div class="logo-text" v-show="!collapsed">
        <span class="logo-title">FFmpeg Studio</span>
      </div>
    </div>

    <!-- 导航菜单 -->
    <nav class="nav-menu">
      <div
        v-for="item in navItems"
        :key="item.key"
        class="nav-item"
        :class="{ active: activeTab === item.key }"
        @click="$emit('select', item.key)"
        :title="item.label"
      >
        <el-icon :size="20"><component :is="item.icon" /></el-icon>
        <span class="nav-label" v-show="!collapsed">{{ item.label }}</span>
      </div>
    </nav>

    <!-- 底部信息 -->
    <div class="sidebar-footer">
      <div class="version-info" v-show="!collapsed">
        <el-icon :size="14"><InfoFilled /></el-icon>
        <span>v0.3.0</span>
      </div>
      <el-button
        text
        class="settings-btn"
        @click="$emit('open-settings')"
        :title="collapsed ? '设置' : ''"
      >
        <el-icon><Setting /></el-icon>
        <span v-show="!collapsed">设置</span>
      </el-button>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import {
  Film, InfoFilled, VideoCamera, FolderAdd,
  Setting, Picture, Headset, Message, Monitor, Upload, Filter, EditPen
} from '@element-plus/icons-vue'

defineProps({
  activeTab: { type: String, default: 'convert' }
})
defineEmits(['select', 'open-settings'])

const collapsed = ref(false)
function toggleCollapse() { collapsed.value = !collapsed.value }

const navItems = [
  { key: 'mediainfo',label: '媒体信息',   icon: InfoFilled },
  { key: 'convert',  label: '格式转换',  icon: VideoCamera },
  { key: 'merge',    label: '文件合并',   icon: FolderAdd },
  { key: 'custom',   label: '自行命令',   icon: EditPen },
  { key: 'snapshot', label: '截图与GIF',  icon: Picture },
  { key: 'audio',    label: '音频处理',   icon: Headset },
  { key: 'subtitle', label: '字幕处理',   icon: Message },
  { key: 'capture',  label: '设备采集',   icon: Monitor },
  { key: 'stream',   label: '流媒体',     icon: Upload },
  { key: 'filter',   label: '滤镜特效',   icon: Filter },
]
</script>

<style scoped>
.sidebar {
  width: 180px;
  min-width: 180px;
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  color: var(--text-sidebar);
  transition: width 0.2s ease, min-width 0.2s ease;
  box-shadow: inset -2px 0 6px rgba(0,0,0,0.05), inset 2px 0 6px rgba(255,255,255,0.3);
}
:root.dark .sidebar {
  box-shadow: inset -2px 0 6px rgba(0,0,0,0.2), inset 2px 0 6px rgba(255,255,255,0.02);
}
.sidebar.collapsed {
  width: 64px;
  min-width: 64px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 10px;
  position: relative;
}
.sidebar.collapsed .logo-area { justify-content: center; padding: 20px 0; }

.logo-icon {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #dde1e6, #d2d7dc);
  border-radius: 12px;
  color: #57606f;
  flex-shrink: 0;
  cursor: pointer;
  box-shadow: 4px 4px 12px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.6);
  transition: all 0.25s ease;
}
.logo-icon:hover { opacity: 0.92; transform: scale(1.05); box-shadow: 6px 6px 18px rgba(0,0,0,0.1), -6px -6px 18px rgba(255,255,255,0.7); }

/* 夜晚模式 - 深灰背景 + 灰色图标 */
:root.dark .logo-icon {
  background: linear-gradient(135deg, #3d4548, #333a3c);
  color: #b2bec3;
  box-shadow: 4px 4px 12px rgba(0,0,0,0.4), -4px -4px 12px rgba(255,255,255,0.04);
}
:root.dark .logo-icon:hover {
  box-shadow: 6px 6px 18px rgba(0,0,0,0.5), -6px -6px 18px rgba(255,255,255,0.06);
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  white-space: nowrap;
}

.nav-menu {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
}
.nav-menu::-webkit-scrollbar { width: 0; display: none; }
.nav-menu { scrollbar-width: none; -ms-overflow-style: none; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-secondary);
  white-space: nowrap;
}
.sidebar.collapsed .nav-item { justify-content: center; padding: 11px 0; }

.nav-item:hover {
  background: var(--bg-hover);
  box-shadow: var(--nm-shadow-sm);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--bg-surface);
  color: var(--accent);
  box-shadow: var(--nm-shadow-inset-sm);
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
}

.sidebar-footer {
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sidebar.collapsed .sidebar-footer { padding: 14px 8px; align-items: center; }

.version-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  justify-content: center;
}

.settings-btn {
  justify-content: flex-start;
  color: var(--text-secondary) !important;
  padding: 8px 12px !important;
  font-size: 13px;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 12px !important;
}
.sidebar.collapsed .settings-btn { padding: 8px !important; }

.settings-btn:hover {
  color: var(--text-primary) !important;
  background: var(--bg-hover) !important;
  box-shadow: var(--nm-shadow-sm) !important;
}

.settings-btn .el-icon {
  margin-right: 8px;
}
.sidebar.collapsed .settings-btn .el-icon { margin-right: 0; }
</style>
