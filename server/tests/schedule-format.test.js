/**
 * meal 云函数：scheduled_at 序列化为 API 字符串（北京时间墙钟）
 */
const { formatScheduledForApi } = require('../functions/meal/utils/schedule-format');

describe('formatScheduledForApi', () => {
  test('Date：UTC 04:00 对应北京时间 12:00（云函数常见 TZ=UTC 下 mysql2 读入的 Date）', () => {
    const d = new Date('2026-03-24T04:00:00.000Z');
    expect(formatScheduledForApi(d, 1).scheduledAt).toBe('2026-03-24 12:00:00');
    expect(formatScheduledForApi(d, 1).scheduledTimeSpecified).toBe(true);
  });

  test('字符串：已是北京时间墙钟则原样取前 19 位', () => {
    expect(formatScheduledForApi('2026-03-24 12:00:00', 1).scheduledAt).toBe('2026-03-24 12:00:00');
  });

  test('ISO 带 Z：转为北京时间墙钟字符串', () => {
    expect(formatScheduledForApi('2026-03-24T04:00:00.000Z', 1).scheduledAt).toBe('2026-03-24 12:00:00');
  });

  test('null', () => {
    expect(formatScheduledForApi(null, 0)).toEqual({
      scheduledAt: null,
      scheduledTimeSpecified: false
    });
  });
});
