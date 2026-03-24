const { truncateThing } = require('../functions/order/utils/subscribe-notify-truncate');

describe('subscribe-notify-truncate', () => {
  test('短文本原样返回', () => {
    expect(truncateThing('张三', 20)).toBe('张三');
  });

  test('超长截断并加省略号', () => {
    const s = '一二三四五六七八九十abcdefghij'
    const out = truncateThing(s, 10)
    expect(out.length).toBeLessThanOrEqual(10)
    expect(out.endsWith('…')).toBe(true)
  });
});
