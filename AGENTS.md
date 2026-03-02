# 微信小程序 "今天吃什么" 系统提示词

## 项目概述

这是一个基于微信小程序的"今天吃什么"点餐应用，帮助用户管理菜品、发起和参与点餐活动。

### 技术栈
- **前端**: 微信小程序原生框架 (WXML + WXSS + JS)
- **后端**: 腾讯云云函数 (SCF)
- **数据库**: 腾讯云 MySQL (CynosDB)
- **开发工具**: 微信开发者工具

### 项目结构
```
what-to-eat/
├── pages/                    # 小程序页面
│   ├── index/               # 首页 - 菜品管理
│   ├── meal-list/           # 点餐列表页
│   ├── order-food/          # 点餐页面
│   └── initiate-meal/       # 发起点餐页
├── utils/                   # 工具类
│   └── cloud-api.js         # 云函数调用封装
├── server/                  # 后端服务
│   ├── ddl/                 # 数据库建表语句
│   ├── functions/           # 云函数代码
│   │   ├── dish/           # 菜品管理
│   │   ├── meal/           # 点餐管理
│   │   ├── order/          # 订单管理
│   │   └── user/           # 用户管理
│   └── tests/              # 单元测试
└── scripts/                # 辅助脚本
```

## 数据库表结构

### 核心表
1. **wte_users** - 用户表
2. **wte_kitchens** - 厨房表（支持多厨房）
3. **wte_dishes** - 菜品表
4. **wte_meals** - 点餐活动表
5. **wte_meal_dishes** - 点餐菜品关联表
6. **wte_orders** - 订单表

### 设计原则
- 所有表名以 `wte_` 为前缀
- **无外键约束**（业务层维护数据一致性）
- 使用软删除（status 字段）
- 完整的索引设计

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
- 时间字段需要格式化为北京时间

## 测试规范

### 单元测试
- 使用 Jest + better-sqlite3 进行测试
- 每个云函数必须有完整的单元测试
- 测试文件命名: `{functionName}.sqlite.test.js`
- 每次变更完云函数后，执行相关单元测试并确保全部通过。未通过的单元测试必须排查原因，并修改业务代码或单元测试代码，并重新测试。

### 数据库检查脚本
```bash
# 检查数据库数据
node scripts/check-db.js
node scripts/check-orders.js
node scripts/check-orders-detail.js
```

## 部署检查清单

### 云函数部署前
- [ ] utils/db.js 使用 pool.query()
- [ ] utils/response.js 存在且正确
- [ ] package.json 包含 mysql2 依赖
- [ ] 数据库配置使用公网地址

### 部署后验证
- [ ] dish 云函数: 增删改查菜品
- [ ] meal 云函数: 发起、关闭、查询点餐
- [ ] order 云函数: 下单、取消、查询订单
- [ ] user 云函数: 用户登录、信息获取

## 开发环境配置

### 数据库连接信息
```
Host: sh-cynosdbmysql-grp-ltto3044.sql.tencentcdb.com
Port: 29764
User: mpfunctions / readonly
Database: dev-0gtpuq9p785f5498
```

### 小程序配置
```json
// project.config.json
{
  "cloudfunctionRoot": "server/functions/"
}
```

## 功能模块说明

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

---

**注意**: 修改云函数代码后必须重新部署才能生效。
