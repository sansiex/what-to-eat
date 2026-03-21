/**
 * 生成点餐详情页按钮图标 (SVG -> PNG)
 * 使用 sharp 将 SVG 转为 PNG
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZE = 64;
const OUTPUT_DIR = path.join(__dirname, '..', 'images');

const svgIcons = {
  'icon-edit': `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <path d="M14 50 L38 14 L50 26 L26 62 Z" fill="none" stroke="white" stroke-width="3"/>
    <path d="M26 62 L50 26" fill="none" stroke="white" stroke-width="3"/>
  </svg>`,
  'icon-order': `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <circle cx="32" cy="32" r="20" fill="none" stroke="white" stroke-width="3"/>
    <circle cx="32" cy="32" r="8" fill="none" stroke="white" stroke-width="2"/>
  </svg>`,
  'icon-close': `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <path d="M12 32 L24 48 L52 16" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  'icon-reopen': `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <path d="M32 14 A18 18 0 1 1 14 32" fill="none" stroke="white" stroke-width="3"/>
    <polygon points="32,10 38,18 26,18" fill="white"/>
  </svg>`,
  'icon-share': `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="46" cy="18" r="8" fill="white"/>
    <circle cx="32" cy="46" r="10" fill="white"/>
    <line x1="18" y1="18" x2="32" y2="46" stroke="white" stroke-width="2"/>
    <line x1="46" y1="18" x2="32" y2="46" stroke="white" stroke-width="2"/>
  </svg>`
};

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  for (const [name, svg] of Object.entries(svgIcons)) {
    const filepath = path.join(OUTPUT_DIR, `${name}.png`);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(filepath);
    console.log('Generated', filepath);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
