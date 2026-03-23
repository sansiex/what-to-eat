/**
 * 北京时间自然日边界（点餐列表分组）
 */
const {
  getMealListBeijingBoundaries,
  addBeijingCalendarDays,
  startOfCurrentBeijingCalendarDay,
  partitionMealsByBeijingCalendar,
  partitionMealsByScheduledBeijingDate,
  mealEffectiveScheduledBeijingYmd
} = require('../utils/beijing-day.js')

describe('beijing-day', () => {
  test('getMealListBeijingBoundaries 返回 ISO 且昨天 < 今天 < 明天', () => {
    const b = getMealListBeijingBoundaries()
    expect(b.todayStartISO).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(b.tomorrowStartISO).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(b.yesterdayStartISO).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const y = new Date(b.yesterdayStartISO).getTime()
    const t = new Date(b.todayStartISO).getTime()
    const n = new Date(b.tomorrowStartISO).getTime()
    expect(y).toBeLessThan(t)
    expect(t).toBeLessThan(n)
    expect(n - t).toBe(86400000)
    expect(t - y).toBe(86400000)
  })

  test('addBeijingCalendarDays 步进一天', () => {
    const start = startOfCurrentBeijingCalendarDay()
    const next = addBeijingCalendarDays(start, 1)
    expect(next.getTime() - start.getTime()).toBe(86400000)
  })

  test('partitionMealsByBeijingCalendar 按边界分桶', () => {
    const b = getMealListBeijingBoundaries()
    const t0 = new Date(b.todayStartISO).getTime()
    const mealToday = { id: 1, createdAt: new Date(t0 + 3600000).toISOString() }
    const mealYesterday = { id: 2, createdAt: new Date(t0 - 3600000).toISOString() }
    const { today, yesterday, history } = partitionMealsByBeijingCalendar(
      [mealToday, mealYesterday],
      b
    )
    expect(today.map(m => m.id)).toContain(1)
    expect(yesterday.map(m => m.id)).toContain(2)
    expect(history.length).toBe(0)
  })

  test('partitionMealsByScheduledBeijingDate 按用餐日期分桶（明天及以后 / 今天 / 历史）', () => {
    const nowMs = new Date('2026-06-15T12:00:00+08:00').getTime()
    const meals = [
      { id: 1, scheduledAt: '2026-06-14 12:00:00', createdAt: '2026-06-10T00:00:00.000Z' },
      { id: 2, scheduledAt: '2026-06-15 00:00:00', createdAt: '2026-06-10T00:00:00.000Z' },
      { id: 3, scheduledAt: '2026-06-16 18:00:00', createdAt: '2026-06-10T00:00:00.000Z' },
      { id: 4, createdAt: '2026-06-15T02:00:00.000Z' }
    ]
    const { future, today, history } = partitionMealsByScheduledBeijingDate(meals, nowMs)
    expect(history.map((m) => m.id)).toEqual([1])
    expect(today.map((m) => m.id).sort()).toEqual([2, 4])
    expect(future.map((m) => m.id)).toEqual([3])
  })

  test('mealEffectiveScheduledBeijingYmd 无 scheduledAt 时用发起日（北京日历）', () => {
    const ymd = mealEffectiveScheduledBeijingYmd({
      createdAt: '2026-03-20T10:00:00.000Z'
    })
    expect(ymd).toBe('2026-03-20')
  })
})
