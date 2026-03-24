# 微信小程序 "今天吃什么" 系统提示词

## 项目概述

这是一个基于微信小程序的"今天吃什么"点餐应用，帮助用户管理菜品、发起和参与点餐活动。

### 技术栈
- **前端**: 微信小程序原生框架 (WXML + WXSS + JS)
- **后端**: 腾讯云云函数 (SCF)
- **数据库**: 腾讯云 MySQL (CynosDB)
- **开发工具**: 微信开发者工具
- **测试框架**: [minium](https://git.weixin.qq.com/minitest/minium-doc) - 微信官方小程序自动化测试框架
- **断言库**: 与 minium 配套使用

## 数据库表结构

### 设计原则
- 所有表名以 `wte_` 为前缀
- **无外键约束**（业务层维护数据一致性）
- 使用软删除（status 字段）
- 完整的索引设计

### 点餐菜品标签（`wte_orders.tags`）
- 与订单同行存储：`wte_orders.tags` 为 **JSON** 数组，元素形如 `{"categoryKey":"spiciness","tagCode":"mild"}`（辣度与 `taboo` 忌口等）
- 已有库请执行：`scripts/migrations/001_wte_orders_tags_json.sql`；新建库可参考 `server/ddl/wte_orders.sql`（已含 `tags`）
- 标签类型与可选值：`meal` / `order` 云函数内各有一份 **`utils/tag-registry.js`**（内容须一致；与小程序 `utils/dish-tag-registry.js` 保持同步）
- 云函数：`order` 提供 `addDishTags` / `removeDishTag` / `listMealDishTags`；`meal.get` 返回的每道菜含 `tagDisplay`（由订单行 `tags` 聚合）
- 点餐页：**勾选与「我的标签」草稿仅存在前端**，用户点「下单」时 `order.create` 传入 `dishIds` 与 `dishTagsByDishId`（每道已选菜的标签数组），一并写入 `wte_orders.tags`；`addDishTags` / `removeDishTag` 仍可在已有订单行上改标签（其他场景）

## 云函数规范

### 目录结构
每个云函数必须包含：
```
functions/{functionName}/
├── index.js          # 主入口
├── package.json      # 依赖配置
└── utils/
    ├── db.js         # 数据库连接工具
    └── response.js   # 响应工具
```
**部署说明**：SCF 上传的是单个函数目录（如 `meal/`），`require` 只能引用该目录内的文件；**不能**使用 `../其它目录` 引用兄弟函数或 `functions/utils` 公共文件，否则线上会报 `Cannot find module`。跨函数复用的逻辑（如 `tag-registry.js`）需在 **`meal/utils` 与 `order/utils` 各放一份并保持同步**。

### 数据库连接 (utils/db.js)
```javascript
// 关键配置
- 使用 mysql2/promise
- 使用 pool.query() 而非 pool.execute()（避免参数绑定问题）
- 公网地址访问 MySQL
- 连接池配置
```

### 响应格式 (utils/response.js)
```javascript
// 统一响应结构
{
  code: 0,        // 0=成功, 其他=错误
  message: '',
  data: {},
  success: true
}
```

### 云函数入口规范
```javascript
exports.main = async (event, context) => {
  const { action, data } = event;
  // action 路由到不同处理函数
  // 统一错误处理
};
```

## 前端开发规范

### 页面生命周期
- `onLoad`: 初始化数据
- `onShow`: 刷新数据（注意避免覆盖用户操作）
- 使用 `getApp().globalData` 在页面间传递数据

### 云函数调用
通过 `utils/cloud-api.js` 封装：
```javascript
const { API } = require('../../utils/cloud-api.js')

// 调用示例
const result = await API.dish.list()
const dishes = result.data.list
```

### 数据绑定注意事项
- 后端返回的状态字段通常是数字（1/0）
- 前端需要转换为字符串（'ordering'/'closed'）便于模板判断

### 日期与时间（北京时间）
- **本小程序中所有与用户相关的日期、时间的输入与展示，一律使用北京时间（UTC+8）。** 界面上默认**不要**在文案末尾追加「（北京时间）」等字样；以日期、时刻本身的换算与约定体现时区即可。
- **展示**：与云端约定的无时区字符串（如 `YYYY-MM-DD`、`YYYY-MM-DD HH:mm`）按**北京时间墙钟**理解；若接口返回带 `Z` 或 `±` 偏移的 ISO 8601，必须先换算为北京时间再格式化展示。
- **输入**：发起点餐的用餐日期/时刻、**点餐列表分区**（明天及以后用餐 / 今天用餐 / 历史点餐）均以**用餐日期的北京日历日**为界；无 `scheduledAt` 时回退为发起日的北京日历日（见 `utils/beijing-day.js` 的 `partitionMealsByScheduledBeijingDate`）；用餐时间展示见 `utils/beijing-meal-schedule.js`；发起时间见 `utils/format-meal-created-at-beijing.js`。
- **iOS 与 `picker`**：真机 iOS 上，**原生 `picker` 不要放在 `scroll-view` 内**，否则易出现选项空白、滚轮不渲染；发起点餐页将日期/时间选择区放在 `scroll-view` 外（见 `pages/initiate-meal/initiate-meal.wxml`），并在 `onReady` / `initMealSchedulePickers` 完成后用 `refreshPickerBindDataForIOS` 再刷一层绑定数据以规避首帧异常。
- **云函数**：`meal` 等与排期、今日日期相关的逻辑应与小程序一致，按北京时间处理。`scheduled_at` 经 mysql2 读入为 `Date` 时，**不可用 `getHours()` 等依赖进程时区的字段拼 API 字符串**（SCF 多为 `TZ=UTC`，会少 8 小时）；应使用与前端一致的「UTC 毫秒 +8h 再取 `getUTC*()`」方式，见 `server/functions/meal/utils/schedule-format.js` 的 `formatScheduledForApi`。

## 测试规范

### 云函数单元测试
- 云函数使用 Jest + better-sqlite3 进行测试
- 每个云函数必须有完整的单元测试
- 测试文件命名: `{functionName}.sqlite.test.js`
- 每次变更完云函数后，执行相关单元测试并确保全部通过。未通过的单元测试必须排查原因，并修改业务代码或单元测试代码，并重新测试。

### 微信小程序前端单元测试

**任何前端代码变更必须遵循严格的 TDD 流程：**
1. **编写minium单元测试** → 2. **运行测试（预期失败）** → 3. **编写/修改代码** → 4. **运行测试（预期通过）** → 5. **重构优化**
2. 所有前端单元测试代码都放在tests目录下

### 数据库检查 / 运维
- **不再直连 MySQL**。请先部署 `server/functions/debug` 云函数，配置与其它函数相同的 `DB_*` 以及 **`WTE_DEBUG_SECRET`**。
- 根目录 **`scripts/`**（除 **`scripts/migrations/`** 下的 SQL）已列入 **`.gitignore`**，不在仓库中维护；克隆后如需命令行调试请自建脚本，或在微信开发者工具里测试云函数 `debug`（`action` 如 `ping`、`listActions`、`checkDb` 等，并传入与云端一致的 `secret`）。
- 若自建 HTTP 调用：与小程序网关相同，需环境变量 **`WTE_CLOUD_HTTP_BASE`**、**`WTE_CLOUD_HTTP_API_KEY`**，请求体为 `{ "action": "<action>", "data": { "secret": "<WTE_DEBUG_SECRET>", ... } }`。

## 部署检查清单

### 云函数部署前
- [ ] utils/db.js 使用 pool.query()
- [ ] utils/response.js 存在且正确
- [ ] package.json 包含 mysql2 依赖
- [ ] 数据库连接通过云开发控制台 / SCF 环境变量配置 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`（勿写入仓库）
- [ ] **下单通知（订阅消息）**：`order` 云函数配置 `WTE_SUBSCRIBE_TMPL_ORDER`（公众平台订阅消息模板 ID，需含 `thing1`/`thing2`/`thing3`）；小程序 `utils/subscribe-config.js` 中 **`MEAL_ORDER_NOTIFY_TMPL_ID`** 与之一致；可选 `WTE_MINIPROGRAM_STATE=developer` 用于体验版。他人下单成功后向发起者 `openid` 推送，点击消息打开 `pages/meal-detail/meal-detail?mealId=…`。

### 部署后验证
- [ ] dish 云函数: 增删改查菜品
- [ ] meal 云函数: 发起、关闭、查询点餐
- [ ] order 云函数: 下单、取消、查询订单
- [ ] user 云函数: 用户登录、信息获取

## 开发环境配置

### 数据库连接（勿在仓库保存密码）
- 云函数：在微信云开发或 SCF 中为每个函数配置环境变量 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`。
- 本地自建调试脚本：仅在机器上配置上述变量，**不要**把真实连接信息提交到 Git。

### 小程序配置
```json
// project.config.json
{
  "cloudfunctionRoot": "server/functions/"
}
```

## 功能模块说明

底部 Tab：**菜单** → **点餐** → **厨房**（厨房管理、切换厨房）。**菜品库**从菜单页顶部与「创建新菜单」同行的 **「菜品」** 进入（`navigateTo` 原菜品列表页）。各业务页顶部不再展示厨房选择条，改在厨房管理页通过「切换厨房」操作。

### 下单通知（订阅消息）
- 成员在点餐页或分享页下单成功后，`order` 云函数向**该点餐发起者**发送一条订阅消息（发起者需曾在发起点餐成功时或管理态打开点餐详情时授权订阅；一次性模板每授权一次通常可发一条）。
- 消息跳转页：`pages/meal-detail/meal-detail?mealId=<id>`。

### 1. 菜品管理 (pages/index)
- 添加、编辑、删除菜品
- 搜索菜品
- 菜品列表展示

### 2. 点餐列表 (pages/meal-list)
- 展示所有点餐活动
- 显示菜品数和参与人数
- 编辑、收单、点餐操作

### 3. 点餐页面 (pages/order-food)
- 展示当前点餐的菜品
- 勾选/取消勾选菜品
- 显示每道菜的点选情况
- 下单功能

### 4. 发起点餐 (pages/initiate-meal)
- 输入点餐名称
- 选择参与菜品
- 创建点餐活动

### 5. 厨房管理 (pages/kitchen-manage)
- Tab 进入；非主人仅可查看名称与管理员列表
- 主人可改厨房名、邀请/移除管理员；「切换厨房」复用 `kitchen-switcher` 下拉面板的逻辑

## 最佳实践

1. **数据一致性**: 无外键时，业务逻辑需自行维护关联数据
2. **错误处理**: 所有云函数调用需有 try-catch 处理
3. **用户体验**: 操作后及时反馈（toast 提示）
4. **性能优化**: 列表使用分页，避免一次性加载过多数据
5. **代码复用**: 通用逻辑封装到 utils，避免重复代码

## 调试技巧

1. 使用 `console.log` 输出关键数据
2. 数据库检查脚本验证数据状态
3. 微信开发者工具 Network 面板查看请求响应
4. 云函数日志查看服务端错误

