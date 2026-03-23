/**
 * 北京时间自然日边界（与 meal-list 分组、云函数时间筛选一致）
 * 使用 UTC+8 固定偏移，不依赖 Intl（小程序环境兼容）
 */

const MS_8H = 8 * 60 * 60 * 1000

/** 某 UTC 时刻对应的北京日历日 YYYY-MM-DD */
function beijingYmdFromUtcMs(ms) {
  const b = new Date(ms + MS_8H)
  const y = b.getUTCFullYear()
  const mo = b.getUTCMonth() + 1
  const d = b.getUTCDate()
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function scheduledAtStringHasExplicitTimezone(str) {
  const t = String(str).trim()
  return /Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/i.test(t)
}

/** 将 scheduled_at 原始值解析为北京日历日 YYYY-MM-DD（无时区串按北京时间墙钟日期） */
function scheduledRawToBeijingYmd(raw) {
  if (raw == null || raw === '') return null
  let s = String(raw).trim()
  if (scheduledAtStringHasExplicitTimezone(s)) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return null
    return beijingYmdFromUtcMs(d.getTime())
  }
  if (s.includes('T')) s = s.replace('T', ' ')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/**
 * 列表分桶用：有 scheduledAt 则取其北京日期；否则用发起时间北京日期（与存量补全策略一致）
 * @param {{ scheduledAt?: string, scheduled_at?: string, createdAt?: string, created_at?: string }} meal
 * @returns {string|null} YYYY-MM-DD
 */
function mealEffectiveScheduledBeijingYmd(meal) {
  if (!meal) return null
  const sch = meal.scheduledAt != null ? meal.scheduledAt : meal.scheduled_at
  if (sch != null && String(sch).trim() !== '') {
    return scheduledRawToBeijingYmd(sch)
  }
  const c = meal.createdAt != null ? meal.createdAt : meal.created_at
  if (c == null) return null
  const t = new Date(c).getTime()
  if (Number.isNaN(t)) return null
  return beijingYmdFromUtcMs(t)
}

/**
 * 点餐列表：按「用餐日期（北京时间）」分为 明天及以后 / 今天 / 历史（早于今天）
 * @param {Array} meals
 * @param {number} [nowMs] 可选，便于测试固定「今天」
 * @returns {{ future: typeof meals, today: typeof meals, history: typeof meals }}
 */
function partitionMealsByScheduledBeijingDate(meals, nowMs) {
  const todayYmd = beijingYmdFromUtcMs(nowMs != null ? nowMs : Date.now())
  const future = []
  const today = []
  const history = []
  for (let i = 0; i < (meals || []).length; i++) {
    const m = meals[i]
    const ymd = mealEffectiveScheduledBeijingYmd(m)
    if (ymd == null) continue
    if (ymd > todayYmd) future.push(m)
    else if (ymd === todayYmd) today.push(m)
    else history.push(m)
  }
  return { future, today, history }
}

function startOfCurrentBeijingCalendarDay() {
  const now = new Date()
  const b = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const y = b.getUTCFullYear()
  const mo = b.getUTCMonth()
  const d = b.getUTCDate()
  return new Date(Date.UTC(y, mo, d, 0, 0, 0, 0) - 8 * 60 * 60 * 1000)
}

function addBeijingCalendarDays(beijingDayStartUtc, deltaDays) {
  return new Date(beijingDayStartUtc.getTime() + deltaDays * 86400000)
}

/**
 * @returns {{ todayStartISO: string, tomorrowStartISO: string, yesterdayStartISO: string }}
 */
function getMealListBeijingBoundaries() {
  const todayStart = startOfCurrentBeijingCalendarDay()
  return {
    todayStartISO: todayStart.toISOString(),
    tomorrowStartISO: addBeijingCalendarDays(todayStart, 1).toISOString(),
    yesterdayStartISO: addBeijingCalendarDays(todayStart, -1).toISOString()
  }
}

/**
 * 按北京时间自然日把一餐列表分成「当天 / 昨天 / 更早」
 * 用于点餐列表前端分组，避免依赖服务端 created_at 与 ISO 边界比较不一致导致当天为空
 * @param {Array<{ createdAt?: string, created_at?: string }>} meals
 * @param {{ todayStartISO: string, tomorrowStartISO: string, yesterdayStartISO: string }} boundaries
 * @returns {{ today: typeof meals, yesterday: typeof meals, history: typeof meals }}
 */
function partitionMealsByBeijingCalendar(meals, boundaries) {
  const t0 = new Date(boundaries.todayStartISO).getTime()
  const t1 = new Date(boundaries.tomorrowStartISO).getTime()
  const ty = new Date(boundaries.yesterdayStartISO).getTime()
  const today = []
  const yesterday = []
  const history = []
  for (let i = 0; i < (meals || []).length; i++) {
    const m = meals[i]
    const raw = m.createdAt != null ? m.createdAt : m.created_at
    if (raw == null) continue
    const t = new Date(raw).getTime()
    if (Number.isNaN(t)) continue
    if (t >= t0 && t < t1) today.push(m)
    else if (t >= ty && t < t0) yesterday.push(m)
    else if (t < ty) history.push(m)
    else if (t >= t1) today.push(m) // 时钟略快等，归入当天
  }
  return { today, yesterday, history }
}

module.exports = {
  getMealListBeijingBoundaries,
  startOfCurrentBeijingCalendarDay,
  addBeijingCalendarDays,
  partitionMealsByBeijingCalendar,
  beijingYmdFromUtcMs,
  mealEffectiveScheduledBeijingYmd,
  partitionMealsByScheduledBeijingDate
}
