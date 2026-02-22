# SVG 图标代码

## 首页图标

### 默认状态
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 9L12 2L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 22V12H15V22" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### 选中状态
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 9L12 2L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 22V12H15V22" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

## 点餐图标

### 默认状态
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 11H21" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 16H21" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M8 2L12 6L16 2" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 6V22" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### 选中状态
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 11H21" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 16H21" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M8 2L12 6L16 2" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 6V22" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

## 使用方法

1. 将上述SVG代码复制到一个SVG文件中，例如 `home.svg` 和 `order.svg`
2. 使用在线工具将SVG转换为PNG文件，推荐使用：
   - https://convertio.co/zh/svg-png/
   - https://www.online-convert.com/
3. 将转换后的PNG文件重命名为：
   - `tab-home.png` (首页默认)
   - `tab-home-active.png` (首页选中)
   - `tab-order.png` (点餐默认)
   - `tab-order-active.png` (点餐选中)
4. 将这些文件保存到 `images` 目录中
5. 在 `app.json` 文件中恢复图标路径配置

## 替代方案：使用自定义TabBar

如果不想使用图片文件，可以考虑使用自定义TabBar组件，这样可以直接使用SVG图标。具体实现可以参考微信小程序官方文档：
https://developers.weixin.qq.com/miniprogram/dev/framework/ability/custom-tabbar.html
