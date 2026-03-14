#!/usr/bin/env node
/**
 * SVG 转 PNG 转换脚本 (Node.js 版本)
 * 用于将 SVG 图标转换为微信小程序所需的 PNG 格式
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 sharp
try {
  var sharp = require('sharp');
} catch (e) {
  console.error('错误: 需要安装 sharp 库');
  console.error('请运行: npm install sharp --save-dev');
  process.exit(1);
}

// 配置
const SVG_DIR = path.join(__dirname, '..', 'images', 'svg');
const OUTPUT_DIR = path.join(__dirname, '..', 'images');
const ICON_SIZE = 48; // 微信小程序 tabBar 图标推荐尺寸

// SVG 文件列表
const SVG_FILES = [
  ['tab-menu.svg', 'tab-menu.png'],
  ['tab-menu-active.svg', 'tab-menu-active.png'],
  ['tab-dish.svg', 'tab-dish.png'],
  ['tab-dish-active.svg', 'tab-dish-active.png'],
  ['tab-meal.svg', 'tab-meal.png'],
  ['tab-meal-active.svg', 'tab-meal-active.png'],
];

async function convertSvgToPng(svgPath, pngPath, size = ICON_SIZE) {
  try {
    // 读取 SVG 内容
    const svgContent = fs.readFileSync(svgPath);
    
    // 使用 sharp 转换
    await sharp(svgContent)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    
    console.log(`✓ 转换成功: ${path.basename(svgPath)} -> ${path.basename(pngPath)}`);
    return true;
    
  } catch (error) {
    console.error(`✗ 转换失败: ${path.basename(svgPath)} - ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('SVG 转 PNG 转换工具 (Node.js 版本)');
  console.log('='.repeat(50));
  console.log(`输入目录: ${SVG_DIR}`);
  console.log(`输出目录: ${OUTPUT_DIR}`);
  console.log(`图标尺寸: ${ICON_SIZE}x${ICON_SIZE}`);
  console.log('='.repeat(50));
  
  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [svgName, pngName] of SVG_FILES) {
    const svgPath = path.join(SVG_DIR, svgName);
    const pngPath = path.join(OUTPUT_DIR, pngName);
    
    if (!fs.existsSync(svgPath)) {
      console.error(`✗ 文件不存在: ${svgPath}`);
      failCount++;
      continue;
    }
    
    if (await convertSvgToPng(svgPath, pngPath)) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('='.repeat(50));
  console.log(`转换完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
  console.log('='.repeat(50));
  
  return failCount === 0;
}

main().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('运行时错误:', error);
  process.exit(1);
});
