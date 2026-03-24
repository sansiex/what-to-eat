/**
 * 下单通知订阅工具
 */

describe('subscribe-meal-order-notify', () => {
  test('工具文件存在且导出 request', () => {
    const fs = require('fs');
    expect(fs.existsSync('utils/subscribe-meal-order-notify.js')).toBe(true);
    expect(fs.existsSync('utils/subscribe-config.js')).toBe(true);
    const mod = require('../utils/subscribe-meal-order-notify.js');
    expect(typeof mod.requestMealOrderNotifySubscribe).toBe('function');
  });
});
