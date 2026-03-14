/**
 * 测试菜单更新 HTTP API
 */

const https = require('https');

const BASE_URL = 'dev-0gtpuq9p785f5498.api.tcloudbasegateway.com';
const API_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJhdWQiOiJkZXYtMGd0cHVxOXA3ODVmNTQ5OCIsImV4cCI6MjUzNDAyMzAwNzk5LCJpYXQiOjE3NzIyMTI2OTQsImF0X2hhc2giOiJuVDVqeHZIdlQ4QzZ3Z1VKU1A0ZFpBIiwicHJvamVjdF9pZCI6ImRldi0wZ3RwdXE5cDc4NWY1NDk4IiwibWV0YSI6eyJwbGF0Zm9ybSI6IkFwaUtleSJ9LCJhZG1pbmlzdHJhdG9yX2lkIjoiMjAyNTkxMDY3MTUwMzcyMDQ0OSIsInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3NlcnZlciIsImlzX3N5c3RlbV9hZG1pbiI6dHJ1ZX0.ki7m1_sdr3EcOOZxXf2WSqIdRBK0sKidLhsiRoqXtLMlW9QEKlvUlFMaISutl9reifOlrwVchjLMg5ufb_Pv4H-rd1ART_Fldq0rT6PEETtFBJycVdl0C1WZI3nlt9CbvW9EyGT6aNnnDtZzduSH8gpxS2sUB6to7n-mpsxplQ4eOy4QXGYynD4sAwOPDXOyI0cNXy3BwmAsMDPTcI4X-Kno4Y7XaOgOwiOSCW4odznuo671FZjU6MEybrEmhdDuCYZX5JiX4liWiM-nHg5_yu_WcsRgVd5coRgJvmwiyfwa9Xa9p1QSEFw6bgs1nvrJwZ2QNFRGBccqUEX1JrjCEA';

function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: BASE_URL,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    console.log('请求 URL:', `https://${BASE_URL}${path}`);
    console.log('请求体:', postData);
    console.log('');
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('状态码:', res.statusCode);
        console.log('响应体:', responseData);
        
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('请求错误:', err.message);
      reject(err);
    });
    
    req.write(postData);
    req.end();
  });
}

async function testUpdateMenu() {
  console.log('=== 测试更新菜单 HTTP API ===\n');
  
  const requestData = {
    action: 'update',
    data: {
      id: 1,
      name: '午餐',
      dishIds: [3, 4, 5, 6, 7]
    }
  };
  
  try {
    const result = await makeRequest('/v1/functions/menu', requestData);
    
    console.log('\n=== 结果 ===');
    if (result.statusCode === 200 && result.data.success) {
      console.log('✅ 更新成功');
    } else {
      console.log('❌ 更新失败:', result.data.message || '未知错误');
    }
  } catch (err) {
    console.error('❌ 请求失败:', err.message);
  }
}

testUpdateMenu();
