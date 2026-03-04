# 云函数部署指南

## 问题
点击分享按钮时出现 "未知的操作类型" 错误，这是因为云函数代码已更新但未部署到云端。

## 解决方案

### 方法一：通过微信开发者工具部署（推荐）

1. 打开微信开发者工具
2. 确保已登录并连接到云开发环境
3. 在左侧文件树中找到 `server/functions/meal`
4. 右键点击 `meal` 文件夹
5. 选择 "创建并部署：云端安装依赖"
6. 等待部署完成

### 方法二：使用命令行部署

```bash
# 进入云函数目录
cd server/functions/meal

# 安装依赖
npm install

# 使用微信开发者工具 CLI 部署
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy --env [环境ID] --name meal
```

### 方法三：上传并部署

1. 在微信开发者工具中
2. 点击顶部菜单 "工具" -> "云开发"
3. 进入 "云函数" 标签
4. 点击 "新建云函数" 或选择已有函数
5. 上传并部署代码

## 验证部署

部署完成后，可以通过以下方式验证：

1. 在微信开发者工具中打开 "云开发" -> "云函数"
2. 查看 `meal` 函数的更新时间
3. 点击 "测试" 按钮，发送以下测试数据：

```json
{
  "action": "generateShareLink",
  "data": {
    "mealId": 1
  }
}
```

## 注意事项

1. 部署前确保已安装依赖 (`npm install`)
2. 数据库表 `wte_meal_shares` 必须已创建
3. 部署后需要重新测试分享功能

## 相关文件

- 云函数入口：`server/functions/meal/index.js`
- 数据库表结构：`server/database/wte_meal_shares.sql`
