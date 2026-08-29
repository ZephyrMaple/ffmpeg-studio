/**
 * 输入格式校验工具
 * 返回错误消息，合法返回 null
 */

// 纯数字（正数，可含小数点）
const numRe = /^\d+(\.\d+)?$/
export function validateNumber(v) {
  if (!v) return null
  return numRe.test(v) ? null : '格式错误，请重新输入'
}

// 正整数
const intRe = /^\d+$/
export function validateInteger(v) {
  if (!v) return null
  return intRe.test(v) ? null : '格式错误，请重新输入'
}

// 尺寸 WxH（分隔符支持 xX*×:：和空格，如 1280x720 / 640:480 / 1920 1080）
const sizeRe = /^\d+\s*[xX*\u00D7:：\s]\s*\d+$/
export function validateSize(v) {
  if (!v) return null
  return sizeRe.test(v) ? null : '格式错误，请重新输入'
}

// RTMP/RTSP/HTTP URL（协议部分不区分大小写，路径分隔符兼容 /\）
const urlRe = /^(rtmp|rtsp|https?|rtp|udp|srt):[\\/]{2}.+/i
export function validateStreamUrl(v) {
  if (!v) return null
  return urlRe.test(v) ? null : '格式错误，请重新输入'
}

// 频率:增益 参数（冒号不区分中英文，如 "0:1 50:0.8" 或 "0：1 50：0.8"）
const eqRe = /^(\d+[：:]\d+(\.\d+)?)(\s+\d+[：:]\d+(\.\d+)?)*$/
export function validateEqParams(v) {
  if (!v) return null
  return eqRe.test(v) ? null : '格式错误，请重新输入'
}

// 时间/时长（斜杠不区分正反：/\）
const timeRe = /^\d+([/:\\：]\d+)*$/
export function validateTime(v) {
  if (!v) return null
  return timeRe.test(v) ? null : '格式错误，请重新输入'
}

// 文件名（无特殊字符）
export function validateNotEmpty(v) {
  return (v && v.trim()) ? null : '格式错误，请重新输入'
}
