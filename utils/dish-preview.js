/**
 * 菜品图预览：占位图不应调用 wx.previewImage（易卡在加载页）
 */

const DISH_PLACEHOLDER_PATH = '/images/dish-placeholder.png'

/**
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
function isDishPlaceholderUrl(url) {
  if (url == null) return true
  const s = String(url).trim()
  if (!s) return true
  if (s === DISH_PLACEHOLDER_PATH) return true
  // 兼容带 query、或仅文件名结尾
  if (s.endsWith('/dish-placeholder.png') || s.endsWith('dish-placeholder.png')) return true
  return false
}

/**
 * 预览单张菜品图（占位图直接忽略）
 * @param {string} url
 */
function previewSingleDishImage(url) {
  if (isDishPlaceholderUrl(url)) return
  wx.previewImage({ current: url, urls: [url] })
}

module.exports = {
  DISH_PLACEHOLDER_PATH,
  isDishPlaceholderUrl,
  previewSingleDishImage
}
