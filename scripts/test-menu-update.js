/**
 * 测试菜单更新云函数
 * 直接调用云函数查看错误信息
 */

const menuFunction = require('../server/functions/menu/index.js');

async function testUpdateMenu() {
  console.log('=== 测试更新菜单 ===\n');
  
  // 模拟更新请求
  const event = {
    action: 'update',
    data: {
      id: 1,
      name: '午餐',
      dishIds: [3, 4, 5, 6, 7]
    }
  };
  
  const context = {
    userId: 1
  };
  
  try {
    console.log('请求参数:', JSON.stringify(event, null, 2));
    console.log('上下文:', JSON.stringify(context, null, 2));
    console.log('');
    
    const result = await menuFunction.main(event, context);
    
    console.log('响应结果:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ 更新成功');
    } else {
      console.log('\n❌ 更新失败:', result.message);
    }
  } catch (err) {
    console.error('\n❌ 调用出错:', err.message);
    console.error('错误堆栈:', err.stack);
  }
}

testUpdateMenu();
