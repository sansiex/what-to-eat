/**
 * 测试获取或创建默认厨房
 */

const kitchenFunction = require('../server/functions/kitchen/index.js');

async function testGetOrCreateDefaultKitchen() {
  console.log('=== 测试获取或创建默认厨房 ===\n');

  // 模拟请求
  const event = {
    action: 'getOrCreateDefault',
    data: {}
  };

  const context = {
    data: {
      _openid: 'test_openid_' + Date.now(),
      _userInfo: { nickName: '测试用户' + Date.now() }
    }
  };

  try {
    console.log('请求参数:', JSON.stringify(event, null, 2));
    console.log('');

    const result = await kitchenFunction.main(event, context);

    console.log('响应结果:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ 获取/创建成功，厨房名称:', result.data.name);
    } else {
      console.log('\n❌ 获取/创建失败:', result.message);
    }
  } catch (err) {
    console.error('\n❌ 调用出错:', err.message);
    console.error('错误堆栈:', err.stack);
  }
}

testGetOrCreateDefaultKitchen();
