/**
 * 测试已部署的 dish 云函数
 * 通过 HTTP 请求调用腾讯云函数
 */

const https = require('https');
const http = require('http');

// 云函数配置
const CONFIG = {
  // 腾讯云函数 URL，需要替换为实际的云函数访问地址
  // 格式：https://service-xxx-xxx.gz.apigw.tencentcs.com/release/dish
  // 或者使用云函数的内网地址
  baseUrl: process.env.CLOUD_FUNCTION_URL || '',
  
  // 如果配置了 API 密钥
  secretId: process.env.TENCENT_SECRET_ID || '',
  secretKey: process.env.TENCENT_SECRET_KEY || '',
};

/**
 * 发送 HTTP 请求
 * @param {string} url - 请求地址
 * @param {Object} data - 请求数据
 * @returns {Promise<Object>} 响应结果
 */
function request(url, data) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (url.startsWith('https') ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: responseData });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 测试创建菜品
 */
async function testCreateDish() {
  console.log('\n=== 测试创建菜品 ===');
  
  const testData = {
    action: 'create',
    data: {
      name: '测试菜品-' + Date.now(),
      description: '这是一个测试菜品'
    }
  };
  
  try {
    // 注意：这里需要实际的云函数 URL 和认证信息
    // 如果没有配置 URL，使用模拟测试
    if (!CONFIG.baseUrl) {
      console.log('⚠️  未配置云函数 URL，使用模拟测试');
      console.log('请求数据:', JSON.stringify(testData, null, 2));
      
      // 模拟成功响应
      return {
        success: true,
        code: 0,
        data: {
          id: Math.floor(Math.random() * 10000),
          name: testData.data.name,
          description: testData.data.description,
          created_at: new Date().toISOString()
        },
        message: '菜品创建成功（模拟）'
      };
    }
    
    const result = await request(CONFIG.baseUrl, testData);
    console.log('响应结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    throw err;
  }
}

/**
 * 测试获取菜品列表
 */
async function testListDishes() {
  console.log('\n=== 测试获取菜品列表 ===');
  
  const testData = {
    action: 'list',
    data: {
      page: 1,
      pageSize: 10
    }
  };
  
  try {
    if (!CONFIG.baseUrl) {
      console.log('⚠️  未配置云函数 URL，使用模拟测试');
      console.log('请求数据:', JSON.stringify(testData, null, 2));
      
      return {
        success: true,
        code: 0,
        data: {
          list: [
            { id: 1, name: '宫保鸡丁', description: '经典川菜', created_at: '2024-01-01T00:00:00Z' },
            { id: 2, name: '糖醋排骨', description: '江浙菜', created_at: '2024-01-02T00:00:00Z' }
          ],
          total: 2,
          page: 1,
          pageSize: 10
        }
      };
    }
    
    const result = await request(CONFIG.baseUrl, testData);
    console.log('响应结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    throw err;
  }
}

/**
 * 测试获取单个菜品
 */
async function testGetDish(dishId) {
  console.log('\n=== 测试获取单个菜品 ===');
  
  const testData = {
    action: 'get',
    data: {
      id: dishId || 1
    }
  };
  
  try {
    if (!CONFIG.baseUrl) {
      console.log('⚠️  未配置云函数 URL，使用模拟测试');
      console.log('请求数据:', JSON.stringify(testData, null, 2));
      
      return {
        success: true,
        code: 0,
        data: {
          id: dishId || 1,
          name: '宫保鸡丁',
          description: '经典川菜',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      };
    }
    
    const result = await request(CONFIG.baseUrl, testData);
    console.log('响应结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    throw err;
  }
}

/**
 * 测试更新菜品
 */
async function testUpdateDish(dishId) {
  console.log('\n=== 测试更新菜品 ===');
  
  const testData = {
    action: 'update',
    data: {
      id: dishId || 1,
      name: '更新后的菜品-' + Date.now(),
      description: '更新后的描述'
    }
  };
  
  try {
    if (!CONFIG.baseUrl) {
      console.log('⚠️  未配置云函数 URL，使用模拟测试');
      console.log('请求数据:', JSON.stringify(testData, null, 2));
      
      return {
        success: true,
        code: 0,
        data: {
          id: dishId || 1,
          name: testData.data.name,
          description: testData.data.description,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: new Date().toISOString()
        },
        message: '菜品更新成功'
      };
    }
    
    const result = await request(CONFIG.baseUrl, testData);
    console.log('响应结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    throw err;
  }
}

/**
 * 测试删除菜品
 */
async function testDeleteDish(dishId) {
  console.log('\n=== 测试删除菜品 ===');
  
  const testData = {
    action: 'delete',
    data: {
      id: dishId || 1
    }
  };
  
  try {
    if (!CONFIG.baseUrl) {
      console.log('⚠️  未配置云函数 URL，使用模拟测试');
      console.log('请求数据:', JSON.stringify(testData, null, 2));
      
      return {
        success: true,
        code: 0,
        data: null,
        message: '菜品删除成功'
      };
    }
    
    const result = await request(CONFIG.baseUrl, testData);
    console.log('响应结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    throw err;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 开始测试 dish 云函数');
  console.log('========================');
  
  try {
    // 测试创建
    const createResult = await testCreateDish();
    if (createResult.success && createResult.data) {
      const dishId = createResult.data.id;
      
      // 测试获取列表
      await testListDishes();
      
      // 测试获取单个
      await testGetDish(dishId);
      
      // 测试更新
      await testUpdateDish(dishId);
      
      // 测试删除
      await testDeleteDish(dishId);
    }
    
    console.log('\n✅ 所有测试完成！');
  } catch (err) {
    console.error('\n❌ 测试过程中出现错误:', err.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testCreateDish,
  testListDishes,
  testGetDish,
  testUpdateDish,
  testDeleteDish,
  runAllTests
};
