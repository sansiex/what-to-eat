/**
 * 发起点餐用餐时间工具（北京时间）
 */
const {
  buildMealDatePickerOptions,
  buildMealTimeMultiRange,
  formatMealTimeDisplay,
  parseScheduledAtFromApi,
  getSuggestedTimePickerIndicesForMealName,
  formatScheduledMealDisplayForOrderFood
} = require('../utils/beijing-meal-schedule.js');

describe('beijing-meal-schedule', () => {
  test('日期下拉前三项为今天明天后天且含月日与周几', () => {
    const { labels, values } = buildMealDatePickerOptions(5);
    expect(labels[0].startsWith('今天（')).toBe(true);
    expect(labels[1].startsWith('明天（')).toBe(true);
    expect(labels[2].startsWith('后天（')).toBe(true);
    expect(labels[0]).toMatch(/周[一二三四五六日]/);
    expect(labels[0]).toMatch(/\d{2}月\d{2}日/);
    expect(labels[3]).toMatch(/^\d{4}年\d{2}月\d{2}日（周[一二三四五六日]）$/);
    expect(values[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(values.length).toBe(3 + 5);
  });

  test('时间为 24 时 × 12 个 5 分钟', () => {
    const [hours, minutes] = buildMealTimeMultiRange();
    expect(hours).toHaveLength(24);
    expect(minutes).toHaveLength(12);
    expect(minutes[0]).toContain('00');
    expect(minutes[11]).toContain('55');
  });

  test('formatMealTimeDisplay', () => {
    expect(formatMealTimeDisplay(9, 1)).toBe('09:05');
    expect(formatMealTimeDisplay(14, 6)).toBe('14:30');
  });

  test('parseScheduledAtFromApi 仅日期', () => {
    const p = parseScheduledAtFromApi('2026-03-18 00:00:00', false);
    expect(p.ymd).toBe('2026-03-18');
    expect(p.timeSpecified).toBe(false);
  });

  test('parseScheduledAtFromApi 含时刻', () => {
    const p = parseScheduledAtFromApi('2026-03-18 14:35:00', true);
    expect(p.ymd).toBe('2026-03-18');
    expect(p.hourIndex).toBe(14);
    expect(p.minuteIndex).toBe(7);
    expect(p.timeSpecified).toBe(true);
  });

  test('formatScheduledMealDisplayForOrderFood 仅日期与含时刻（北京时间字面量，无后缀）', () => {
    const onlyDate = formatScheduledMealDisplayForOrderFood('2026-03-24 00:00:00', false);
    expect(onlyDate).toContain('2026年03月24日');
    expect(onlyDate).toMatch(/^周[一二三四五六日] 2026年03月24日$/);
    expect(onlyDate).not.toMatch(/\d{2}:\d{2}/);
    expect(onlyDate).not.toContain('北京时间');
    const withTime = formatScheduledMealDisplayForOrderFood('2026-03-24 12:30:00', true);
    expect(withTime).toMatch(/^周[一二三四五六日] 2026年03月24日 12:30$/);
    expect(withTime).not.toContain('北京时间');
  });

  test('formatScheduledMealDisplayForOrderFood ISO(Z) 按绝对时刻转北京时间', () => {
    // 2026-03-23 16:30 UTC → 2026-03-24 00:30 北京
    const withTime = formatScheduledMealDisplayForOrderFood('2026-03-23T16:30:00.000Z', true);
    expect(withTime).toMatch(/^周[一二三四五六日] 2026年03月24日 00:30$/);
    expect(withTime).not.toContain('北京时间');
  });

  test('parseScheduledAtFromApi ISO(Z) 得到北京日历与时刻', () => {
    const p = parseScheduledAtFromApi('2026-03-23T16:30:00.000Z', true);
    expect(p.ymd).toBe('2026-03-24');
    expect(p.hourIndex).toBe(0);
    expect(p.minuteIndex).toBe(6);
    expect(p.timeSpecified).toBe(true);
  });

  test('餐名关键字推断时间滚轮位置', () => {
    expect(getSuggestedTimePickerIndicesForMealName('工作日午餐')).toEqual({ hourIndex: 12, minuteIndex: 0 });
    expect(getSuggestedTimePickerIndicesForMealName('早餐自助')).toEqual({ hourIndex: 8, minuteIndex: 0 });
    expect(getSuggestedTimePickerIndicesForMealName('团队晚餐')).toEqual({ hourIndex: 18, minuteIndex: 0 });
    expect(getSuggestedTimePickerIndicesForMealName('周五下午茶')).toEqual({ hourIndex: 15, minuteIndex: 0 });
    expect(getSuggestedTimePickerIndicesForMealName('深夜夜宵')).toEqual({ hourIndex: 23, minuteIndex: 0 });
    expect(getSuggestedTimePickerIndicesForMealName('随便吃吃')).toBeNull();
  });
});
