/** 与 getUTCDay() 一致：0=周日 … 6=周六（配合 +8h 后的 UTC 分量表示北京时间） */
const WEEKDAY_ZH_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/**
 * 点餐发起时间展示（北京时间）：yyyy年MM月dd日 HH:mm
 * @param {string} isoString
 * @param {boolean} [withWeekday] 为 true 时在日期前加「周X 」（与列表页发起时间一致）
 * @returns {string}
 */
function formatMealCreatedAtBeijing(isoString, withWeekday) {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    const year = beijingTime.getUTCFullYear()
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(beijingTime.getUTCDate()).padStart(2, '0')
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0')
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0')
    const base = `${year}年${month}月${day}日 ${hours}:${minutes}`
    if (!withWeekday) return base
    const wk = WEEKDAY_ZH_SHORT[beijingTime.getUTCDay()]
    return `${wk} ${base}`
  } catch (e) {
    return ''
  }
}

module.exports = { formatMealCreatedAtBeijing }
