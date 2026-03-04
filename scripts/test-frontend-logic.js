/**
 * 测试前端逻辑
 * 模拟前端加载流程
 */

const https = require('https');
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
    userId: 1
  });
}

/**
 * 模拟前端加载流程
 */
async function simulateFrontend() {
  console.log('========== 模拟前端加载流程 ==========\n');
  
  // 模拟数据状态
  let data = {
    dishes: [],
    kitchens: [],
    currentKitchen: {}
  };
  
  // 步骤 1: 加载厨房列表 (onLoad)
  console.log('步骤 1: 加载厨房列表');
  try {
    const result = await callFunction('kitchen', 'list');
    console.log('厨房列表结果:', JSON.stringify(result, null, 2));
    
    const kitchens = result.data.list || [];
    data.kitchens = kitchens;
    
    // 找到默认厨房或第一个厨房，如果没有则使用默认值
    const defaultKitchen = kitchens.find(k => k.isDefault) || kitchens[0] || { id: 1, name: '我的厨房' };
    data.currentKitchen = defaultKitchen;
    
    console.log('当前厨房:', data.currentKitchen);
  } catch (err) {
    console.error('加载厨房失败:', err.message);
  }
  
  // 步骤 2: 加载菜品 (loadDishes)
  console.log('\n步骤 2: 加载菜品');
  try {
    const kitchenId = data.currentKitchen.id || 1;
    console.log('使用 kitchenId:', kitchenId);
    
    const result = await callFunction('dish', 'list', { kitchenId });
    console.log('菜品列表结果:', JSON.stringify(result, null, 2));
    
    const dishes = result.data.list || [];
    data.dishes = dishes;
    
    console.log(`\n✅ 成功加载 ${dishes.length} 个菜品`);
    if (dishes.length > 0) {
      console.log('菜品列表:');
      dishes.forEach(d => console.log(`  - ${d.name}`));
    }
  } catch (err) {
    console.error('加载菜品失败:', err.message);
  }
  
  console.log('\n========== 模拟结束 ==========');
  console.log('最终数据状态:');
  console.log(`- 厨房: ${data.currentKitchen.name || '无'} (ID: ${data.currentKitchen.id || '无'})`);
  console.log(`- 菜品数量: ${data.dishes.length}`);
}

simulateFrontend().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
