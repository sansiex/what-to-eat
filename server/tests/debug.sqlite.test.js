/**
 * debug 云函数：鉴权与路由（mock db，不连真实 MySQL）
 */
process.env.WTE_DEBUG_SECRET = 'unit-test-secret';

jest.mock('../functions/debug/utils/db', () => ({
  query: jest.fn(async () => []),
  transaction: jest.fn(async (cb) => {
    const conn = {
      query: jest.fn().mockResolvedValue([{ affectedRows: 0 }])
    };
    return cb(conn);
  })
}));

const { main } = require('../functions/debug/index.js');

describe('debug 云函数', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('错误密钥返回 401', async () => {
    const r = await main({ action: 'checkDb', data: { secret: 'wrong' } });
    expect(r.success).toBe(false);
    expect(r.code).toBe(401);
  });

  test('ping 成功且不触发 query', async () => {
    const db = require('../functions/debug/utils/db');
    const r = await main({ action: 'ping', secret: 'unit-test-secret' });
    expect(r.success).toBe(true);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('checkDb 在密钥正确时调用 query', async () => {
    const db = require('../functions/debug/utils/db');
    const r = await main({ action: 'checkDb', data: { secret: 'unit-test-secret' } });
    expect(r.success).toBe(true);
    expect(db.query).toHaveBeenCalled();
  });

  test('HTTP 形态 event：action 在顶层、secret 在 data', async () => {
    const db = require('../functions/debug/utils/db');
    const r = await main({
      action: 'listActions',
      data: { secret: 'unit-test-secret' }
    });
    expect(r.success).toBe(true);
    expect(r.data.actions).toContain('checkDb');
    expect(db.query).not.toHaveBeenCalled();
  });
});
