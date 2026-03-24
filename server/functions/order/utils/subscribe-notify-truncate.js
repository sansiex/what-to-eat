/** 订阅消息 thing 类字段长度限制（按 Unicode 字符截断） */
function truncateThing(str, maxChars) {
  if (str == null) return ''
  const s = String(str).trim()
  const chars = Array.from(s)
  if (chars.length <= maxChars) return s
  return chars.slice(0, maxChars - 1).join('') + '…'
}

module.exports = { truncateThing }
