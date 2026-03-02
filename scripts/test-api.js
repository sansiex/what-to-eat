/**
 * API 测试脚本
 * 测试云函数接口是否正常工作
 */

const https = require('https');
const http = require('http');
const url = require('url');

// CloudBase HTTP API 基础地址
const BASE_URL = 'https://dev-0gtpuq9p785f5498.api.tcloudbasegateway.com/v1/functions';

// API Key
const API_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJhdWQiOiJkZXYtMGd0cHVxOXA3ODVmNTQ5OCIsImV4cCI6MjUzNDAyMzAwNzk5LCJpYXQiOjE3NzIyMTI2OTQsImF0X2hhc2giOiJuVDVqeHZIdlQ4QzZ3Z1VKU1A0ZFpBIiwicHJvamVjdF9pZCI6ImRldi0wZ3RwdXE5cDc4NWY1NDk4IiwibWV0YSI6eyJwbGF0Zm9ybSI6IkFwaUtleSJ9LCJhZG1pbmlzdHJhdG9yX2lkIjoiMjAyNTkxMDY3MTUwMzcyMDQ0OSIsInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3NlcnZlciIsImlzX3N5c3RlbV9hZG1pbiI6dHJ1ZX0.ki7m1_sdr3EcOOZxXf2WSqIdRBK0sKidLhsiRoqXtLMlW9QEKlvUlFMaISutl9reifOlrwVchjLMg5ufb_Pv4H-rd1ART_Fldq0rT6PEETtFBJycVdl0C1WZI3nlt9CbvW9EyGT6aNnnDtZzduSH8gpxS2sUB6to7n-mpsxplQ4eOy4QXGYynD4sAwOPDXOyI0cNXy3BwmAsMDPTcI4X-Kno4Y7XaOgOwiOSCW4odznuo671FZjU6MEybrEmhdDuCYZX5JiX4liWiM-nHg5_yu_WcsRgVd5coRgJvmwiyfwa9Xa9p1QSEFw6bgs1nvrJwZ2QNFRGBccqUEX1JrjCEA';

/**
 * 发送 HTTP 请求
 */
function request(path, data) {
  return new Promise((resolve, reject) => {
    const requestUrl = url.parse(BASE_URL + path);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: requestUrl.hostname,
      port: requestUrl.port || 443,
      path: requestUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
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
 * 调用云函数
 */
function callFunction(functionName, action, data = {}) {
  return request(`/${functionName}`, {
    action,
    data,
    userId: 1  // 测试用户
  });
}

/**
 * 运行测试
 */
async function runTests() {
  console.log('========== API 测试开始 ==========\n');
  
  let passed = 0;
  let failed = 0;
  
  // 测试 1: 获取厨房列表
  console.log('测试 1: 获取厨房列表');
  try {
    const result = await callFunction('kitchen', 'list');
    console.log('结果:', JSON.stringify(result, null, 2));
    if (result.success && result.data && result.data.list) {
      console.log('✅ 通过\n');
      passed++;
    } else {
      console.log('❌ 失败\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ 错误:', err.message, '\n');
    failed++;
  }
  
  // 测试 2: 获取菜品列表（不带 kitchenId）
  console.log('测试 2: 获取菜品列表（不带 kitchenId）');
  try {
    const result = await callFunction('dish', 'list', {});
    console.log('结果:', JSON.stringify(result, null, 2));
    if (result.success && result.data && result.data.list) {
      console.log('✅ 通过\n');
      passed++;
    } else {
      console.log('❌ 失败\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ 错误:', err.message, '\n');
    failed++;
  }
  
  // 测试 3: 获取菜品列表（带 kitchenId = 1）
  console.log('测试 3: 获取菜品列表（带 kitchenId = 1）');
  try {
    const result = await callFunction('dish', 'list', { kitchenId: 1 });
    console.log('结果:', JSON.stringify(result, null, 2));
    if (result.success && result.data && result.data.list) {
      console.log(`✅ 通过，获取到 ${result.data.list.length} 个菜品\n`);
      passed++;
    } else {
      console.log('❌ 失败\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ 错误:', err.message, '\n');
    failed++;
  }
  
  // 测试 4: 搜索菜品
  console.log('测试 4: 搜索菜品（关键词：红烧肉）');
  try {
    const result = await callFunction('dish', 'list', { kitchenId: 1, keyword: '红烧肉' });
    console.log('结果:', JSON.stringify(result, null, 2));
    if (result.success && result.data && result.data.list) {
      console.log(`✅ 通过，搜索到 ${result.data.list.length} 个菜品\n`);
      passed++;
    } else {
      console.log('❌ 失败\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ 错误:', err.message, '\n');
    failed++;
  }
  
  // 测试 5: 获取点餐列表
  console.log('测试 5: 获取点餐列表');
  try {
    const result = await callFunction('meal', 'list');
    console.log('结果:', JSON.stringify(result, null, 2));
    if (result.success && result.data && result.data.list) {
      console.log(`✅ 通过，获取到 ${result.data.list.length} 个点餐\n`);
      passed++;
    } else {
      console.log('❌ 失败\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ 错误:', err.message, '\n');
    failed++;
  }
  
  console.log('========== 测试结束 ==========');
  console.log(`总计: ${passed + failed} 个测试`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查云函数部署状态');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
