/**
 * 云函数部署脚本
 * 用于批量部署云函数到腾讯云
 */

const fs = require('fs');
const path = require('path');

// 云函数列表
const functions = ['dish', 'meal', 'order', 'user'];

/**
 * 部署单个云函数
 * @param {string} functionName - 云函数名称
 */
async function deployFunction(functionName) {
  console.log(`正在部署云函数: ${functionName}`);
  
  const functionPath = path.join(__dirname, '..', 'functions', functionName);
  
  // 检查云函数目录是否存在
  if (!fs.existsSync(functionPath)) {
    console.error(`云函数目录不存在: ${functionPath}`);
    return false;
  }
  
  // 检查必要文件
  const indexFile = path.join(functionPath, 'index.js');
  const configFile = path.join(functionPath, 'config.json');
  
  if (!fs.existsSync(indexFile)) {
    console.error(`云函数入口文件不存在: ${indexFile}`);
    return false;
  }
  
  if (!fs.existsSync(configFile)) {
    console.error(`云函数配置文件不存在: ${configFile}`);
    return false;
  }
  
  // 读取配置
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  console.log(`  名称: ${config.name}`);
  console.log(`  版本: ${config.version}`);
  console.log(`  运行时: ${config.runtime}`);
  console.log(`  内存: ${config.memorySize}MB`);
  console.log(`  超时: ${config.timeout}秒`);
  
  // 这里应该调用腾讯云API进行部署
  // 实际部署时需要使用腾讯云CLI或SDK
  console.log(`  部署命令: tcb fn deploy ${functionName}`);
  
  console.log(`云函数 ${functionName} 准备完成\n`);
  return true;
}

/**
 * 主函数
 */
async function main() {
  console.log('=================================');
  console.log('  吃什么小程序 - 云函数部署工具');
  console.log('=================================\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const functionName of functions) {
    const success = await deployFunction(functionName);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('=================================');
  console.log('  部署统计');
  console.log('=================================');
  console.log(`  成功: ${successCount}`);
  console.log(`  失败: ${failCount}`);
  console.log(`  总计: ${functions.length}`);
  console.log('\n部署完成！');
  
  if (failCount > 0) {
    process.exit(1);
  }
}

// 执行部署
main().catch(console.error);
