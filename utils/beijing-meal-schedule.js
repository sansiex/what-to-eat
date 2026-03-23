/**
 * 发起点餐「用餐时间」：北京时间日期下拉 + 5 分钟粒度时刻
 */
const { startOfCurrentBeijingCalendarDay, addBeijingCalendarDays } = require('./beijing-day.js')

const MS_8H = 8 * 60 * 60 * 1000

/** 与 getUTCDay() 一致：0=周日 … 6=周六 */
const WEEKDAY_ZH_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** ISO 8601 带 Z 或末尾 ±hh:mm / ±hhmm，需按绝对时刻转北京时间 */
function scheduledAtHasExplicitIsoTimezone(str) {
  const t = String(str).trim()
  return /Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/i.test(t)
}

/**
 * 将 UTC 毫秒转为北京时间下的展示文案
 * @param {number} utcMs
 * @param {boolean} scheduledTimeSpecified
 */
function formatScheduledMealCoreFromUtcMs(utcMs, scheduledTimeSpecified) {
  const b = new Date(utcMs + MS_8H)
  const y = b.getUTCFullYear()
  const mo = b.getUTCMonth() + 1
  const d = b.getUTCDate()
  const dayStart = beijingCalendarDayStartUtc(y, mo, d)
  const wk = weekdayZhFromBeijingDayStart(dayStart)
  const mo2 = String(mo).padStart(2, '0')
  const d2 = String(d).padStart(2, '0')
  const dateStr = `${wk} ${y}年${mo2}月${d2}日`
  if (scheduledTimeSpecified) {
    const hh = b.getUTCHours()
    const mm = b.getUTCMinutes()
    return `${dateStr} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
  return dateStr
}

/**
 * 将「北京时间日界线起点」对应的 UTC Date 转为 YYYY-MM-DD（该日在北京的日历日）
 * @param {Date} dayStartUtc
 * @returns {string}
 */
function ymdFromBeijingDayStart(dayStartUtc) {
  const b = new Date(dayStartUtc.getTime() + MS_8H)
  const y = b.getUTCFullYear()
  const m = b.getUTCMonth() + 1
  const d = b.getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * 展示用：yyyy年MM月dd日（北京时间日历日，月日两位补零）
 * @param {Date} dayStartUtc
 * @returns {string}
 */
function ymdChineseFromBeijingDayStart(dayStartUtc) {
  const b = new Date(dayStartUtc.getTime() + MS_8H)
  const y = b.getUTCFullYear()
  const m = b.getUTCMonth() + 1
  const d = b.getUTCDate()
  return `${y}年${String(m).padStart(2, '0')}月${String(d).padStart(2, '0')}日`
}

/**
 * @param {Date} dayStartUtc
 * @returns {string} 如 03月18日（MM/dd 两位）
 */
function mdLabelFromBeijingDayStart(dayStartUtc) {
  const b = new Date(dayStartUtc.getTime() + MS_8H)
  const m = b.getUTCMonth() + 1
  const d = b.getUTCDate()
  return `${String(m).padStart(2, '0')}月${String(d).padStart(2, '0')}日`
}

/**
 * 该北京日历日对应「周几」（周一至周日文案）
 * @param {Date} dayStartUtc
 * @returns {string}
 */
function weekdayZhFromBeijingDayStart(dayStartUtc) {
  const b = new Date(dayStartUtc.getTime() + MS_8H)
  return WEEKDAY_ZH_SHORT[b.getUTCDay()]
}

/** 展示用：周X + 空格 + MM月dd日（与列表/详情「用餐时间」一致：周几在前） */
function mdWeekdayLabelFromBeijingDayStart(dayStartUtc) {
  return `${weekdayZhFromBeijingDayStart(dayStartUtc)} ${mdLabelFromBeijingDayStart(dayStartUtc)}`
}

/**
 * 北京日历日 0 点对应的 UTC 时刻（与 beijing-day 自然日一致）
 * @param {number} y
 * @param {number} month1Based
 * @param {number} d
 * @returns {Date}
 */
function beijingCalendarDayStartUtc(y, month1Based, d) {
  return new Date(Date.UTC(y, month1Based - 1, d, 0, 0, 0, 0) - MS_8H)
}

/**
 * 点餐页顶部展示：日期与时间均按北京时间（不在文案末尾标注「北京时间」）
 * - 带 Z/± 的 ISO：按绝对时刻换算为北京日历与时刻
 * - YYYY-MM-DD HH:mm（无时区）：与云端约定一致，按北京时间字面量展示
 * @param {string|null|undefined} scheduledAt
 * @param {boolean} [scheduledTimeSpecified]
 * @returns {string} 空字符串表示不展示该行
 */
function formatScheduledMealDisplayForOrderFood(scheduledAt, scheduledTimeSpecified) {
  if (scheduledAt == null || scheduledAt === '') return ''
  let s = String(scheduledAt).trim()

  if (scheduledAtHasExplicitIsoTimezone(s)) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      const core = formatScheduledMealCoreFromUtcMs(d.getTime(), !!scheduledTimeSpecified)
      return core || ''
    }
  }

  if (s.includes('T') && !scheduledAtHasExplicitIsoTimezone(s)) {
    s = s.replace('T', ' ')
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::\d{2})?)?/)
  if (!m) return ''
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  const hh = m[4] !== undefined ? parseInt(m[4], 10) : null
  const mm = m[5] !== undefined ? parseInt(m[5], 10) : null
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return ''

  const dayStart = beijingCalendarDayStartUtc(y, mo, d)
  const wk = weekdayZhFromBeijingDayStart(dayStart)
  /** 展示：周几在前，再接 yyyy年MM月dd日，含时刻时末尾接 HH:mm */
  const mo2 = String(mo).padStart(2, '0')
  const d2 = String(d).padStart(2, '0')
  const dateStr = `${wk} ${y}年${mo2}月${d2}日`

  let core
  if (scheduledTimeSpecified && hh != null && mm != null && !Number.isNaN(hh) && !Number.isNaN(mm)) {
    core = `${dateStr} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  } else {
    core = dateStr
  }
  return core
}

/**
 * 日期下拉：前 3 项为 今天/明天/后天，其后为连续日历日
 * @param {number} extraCount 后天之后再展示的天数（不含今天明天后天）
 * @returns {{ labels: string[], values: string[] }}
 */
function buildMealDatePickerOptions(extraCount = 28) {
  const todayStart = startOfCurrentBeijingCalendarDay()
  const labels = []
  const values = []
  const quick = [
    { prefix: '今天', day: todayStart },
    { prefix: '明天', day: addBeijingCalendarDays(todayStart, 1) },
    { prefix: '后天', day: addBeijingCalendarDays(todayStart, 2) }
  ]
  for (let i = 0; i < quick.length; i++) {
    const q = quick[i]
    labels.push(`${q.prefix}（${mdWeekdayLabelFromBeijingDayStart(q.day)}）`)
    values.push(ymdFromBeijingDayStart(q.day))
  }
  const totalMore = Math.max(0, extraCount)
  for (let delta = 3; delta < 3 + totalMore; delta++) {
    const day = addBeijingCalendarDays(todayStart, delta)
    const ymd = ymdFromBeijingDayStart(day)
    labels.push(`${ymdChineseFromBeijingDayStart(day)}（${weekdayZhFromBeijingDayStart(day)}）`)
    values.push(ymd)
  }
  return { labels, values }
}

/**
 * multiSelector 两列：0–23 时、0–55 分（步长 5）
 * @returns {[string[], string[]]}
 */
function buildMealTimeMultiRange() {
  const hours = []
  for (let h = 0; h < 24; h++) {
    hours.push(`${String(h).padStart(2, '0')}时`)
  }
  const minutes = []
  for (let m = 0; m < 60; m += 5) {
    minutes.push(`${String(m).padStart(2, '0')}分`)
  }
  return [hours, minutes]
}

/**
 * 当前北京时间，时刻向下取整到 5 分钟
 * @returns {{ hour: number, minute: number, hourIndex: number, minuteIndex: number }}
 */
function getBeijingNowRoundedTo5Min() {
  const now = new Date()
  const t = now.getTime() + MS_8H
  const d = new Date(t)
  let h = d.getUTCHours()
  let m = d.getUTCMinutes()
  m = Math.floor(m / 5) * 5
  return {
    hour: h,
    minute: m,
    hourIndex: h,
    minuteIndex: m / 5
  }
}

/**
 * 餐名关键字 → 打开时间选择器时的默认滚轮位置（5 分钟粒度，分钟为 0）
 * 顺序：先匹配更长/更具体的词（如「下午茶」早于「午餐」无关）
 */
const MEAL_NAME_TIME_HINTS = [
  { kw: '下午茶', hour: 15, minute: 0 },
  { kw: '夜宵', hour: 23, minute: 0 },
  { kw: '早餐', hour: 8, minute: 0 },
  { kw: '午餐', hour: 12, minute: 0 },
  { kw: '晚餐', hour: 18, minute: 0 }
]

/**
 * @param {string} name 餐名
 * @returns {{ hourIndex: number, minuteIndex: number } | null}
 */
function getSuggestedTimePickerIndicesForMealName(name) {
  const s = (name || '').trim()
  if (!s) return null
  for (let i = 0; i < MEAL_NAME_TIME_HINTS.length; i++) {
    const { kw, hour, minute } = MEAL_NAME_TIME_HINTS[i]
    if (s.includes(kw)) {
      return { hourIndex: hour, minuteIndex: minute / 5 }
    }
  }
  return null
}

/**
 * @param {number} hourIndex
 * @param {number} minuteIndex 0–11 对应 0–55 分
 */
function formatMealTimeDisplay(hourIndex, minuteIndex) {
  const h = Math.min(23, Math.max(0, Number(hourIndex) || 0))
  const mi = Math.min(11, Math.max(0, Number(minuteIndex) || 0))
  const m = mi * 5
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 解析服务端返回的 scheduledAt（YYYY-MM-DD HH:mm:ss 或 ISO）
 * @param {string|null|undefined} raw
 * @returns {{ ymd: string, hourIndex: number, minuteIndex: number, timeSpecified: boolean }|null}
 */
function parseScheduledAtFromApi(raw, timeSpecified) {
  if (raw == null || raw === '') return null
  let s = String(raw).trim()
  const specified = !!timeSpecified

  if (scheduledAtHasExplicitIsoTimezone(s)) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return null
    const b = new Date(d.getTime() + MS_8H)
    const y = b.getUTCFullYear()
    const mo = b.getUTCMonth() + 1
    const day = b.getUTCDate()
    const ymd = `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (!specified) {
      return { ymd, hourIndex: 0, minuteIndex: 0, timeSpecified: false }
    }
    const hh = b.getUTCHours()
    const mm = b.getUTCMinutes()
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null
    return {
      ymd,
      hourIndex: hh,
      minuteIndex: Math.floor(mm / 5),
      timeSpecified: true
    }
  }

  if (s.includes('T')) {
    s = s.replace('T', ' ')
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return null
  const ymd = m[1]
  const hh = parseInt(m[2], 10)
  const mm = parseInt(m[3], 10)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return {
    ymd,
    hourIndex: hh,
    minuteIndex: Math.floor(mm / 5),
    timeSpecified: specified
  }
}

module.exports = {
  ymdFromBeijingDayStart,
  buildMealDatePickerOptions,
  buildMealTimeMultiRange,
  getBeijingNowRoundedTo5Min,
  getSuggestedTimePickerIndicesForMealName,
  formatMealTimeDisplay,
  formatScheduledMealDisplayForOrderFood,
  parseScheduledAtFromApi,
  startOfCurrentBeijingCalendarDay,
  addBeijingCalendarDays
}
