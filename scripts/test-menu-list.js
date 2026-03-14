/**
 * 测试菜单列表云函数
 */

const menuFunction = require('../server/functions/menu/index.js');

async function testListMenus() {
  console.log('=== 测试获取菜单列表 ===\n');

  // 模拟列表请求
  const event = {
    action: 'list',
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
    console.log('上下文:', JSON.stringify(context, null, 2));
    console.log('');

    const result = await menuFunction.main(event, context);

    console.log('响应结果:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ 获取成功，菜单数量:', result.data.list.length);
    } else {
      console.log('\n❌ 获取失败:', result.message);
    }
  } catch (err) {
    console.error('\n❌ 调用出错:', err.message);
    console.error('错误堆栈:', err.stack);
  }
}

testListMenus();
