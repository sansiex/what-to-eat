/**
 * 发起时间展示（北京时间 yyyy年MM月dd日 HH:mm）
 */
const { formatMealCreatedAtBeijing } = require('../utils/format-meal-created-at-beijing.js')

describe('formatMealCreatedAtBeijing', () => {
  test('空值返回空串', () => {
    expect(formatMealCreatedAtBeijing('')).toBe('')
    expect(formatMealCreatedAtBeijing(null)).toBe('')
    expect(formatMealCreatedAtBeijing(undefined)).toBe('')
  })

  test('UTC 午夜 → 北京时间当日 08:00', () => {
    expect(formatMealCreatedAtBeijing('2024-01-01T00:00:00.000Z')).toBe('2024年01月01日 08:00')
  })

  test('带时分', () => {
    expect(formatMealCreatedAtBeijing('2024-06-15T10:30:00.000Z')).toBe('2024年06月15日 18:30')
  })

  test('withWeekday 时在日期前加周几', () => {
    expect(formatMealCreatedAtBeijing('2024-01-01T00:00:00.000Z', true)).toMatch(
      /^周[一二三四五六日] 2024年01月01日 08:00$/
    )
  })
})
