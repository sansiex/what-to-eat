# 吃什么小程序后端服务

基于腾讯云云函数和MySQL数据库的后端服务。

## 目录结构

```
server/
├── ddl/                    # 数据库DDL文件
│   ├── wte_users.sql      # 用户表
│   ├── wte_dishes.sql     # 菜品表
│   ├── wte_meals.sql      # 点餐表
│   ├── wte_meal_dishes.sql # 点餐菜品关联表
│   └── wte_orders.sql     # 订单表
├── functions/             # 云函数代码
│   ├── utils/            # 工具函数
│   │   ├── db.js        # 数据库连接
│   │   └── response.js  # 响应工具
│   ├── dish/           # 菜品管理云函数
│   ├── meal/           # 点餐管理云函数
│   ├── order/          # 订单管理云函数
│   └── user/           # 用户管理云函数
├── tests/               # 单元测试
│   ├── setup.js       # 测试环境配置
│   ├── dish.test.js   # 菜品管理测试
│   ├── meal.test.js   # 点餐管理测试
│   ├── order.test.js  # 订单管理测试
│   └── user.test.js   # 用户管理测试
├── scripts/            # 部署脚本
│   └── deploy.js      # 云函数部署脚本
└── package.json       # 项目配置
```

## 数据库设计

### 表结构

1. **wte_users** - 用户表
   - 存储小程序用户信息
   - 支持openid和unionid

2. **wte_dishes** - 菜品表
   - 存储用户菜品库
   - 支持按用户隔离

3. **wte_meals** - 点餐表
   - 存储点餐活动信息
   - 支持点餐中和已收单两种状态

4. **wte_meal_dishes** - 点餐菜品关联表
   - 多对多关系表
   - 记录点餐活动包含的菜品

5. **wte_orders** - 订单表
   - 存储用户下单信息
   - 支持取消订单

## 云函数API

### 菜品管理 (dish)

- `create` - 创建菜品
- `update` - 更新菜品
- `delete` - 删除菜品（软删除）
- `list` - 获取菜品列表（支持搜索）
- `get` - 获取单个菜品详情

### 点餐管理 (meal)

- `create` - 创建点餐活动
- `update` - 更新点餐活动
- `delete` - 删除点餐活动
- `list` - 获取点餐列表（支持状态筛选）
- `get` - 获取点餐详情
- `close` - 收单（关闭点餐活动）

### 订单管理 (order)

- `create` - 下单
- `cancel` - 取消订单
- `listByMeal` - 获取点餐活动的订单统计
- `listByUser` - 获取用户的订单历史
- `getMyOrder` - 获取用户在某个点餐活动中的订单

### 用户管理 (user)

- `login` - 用户登录/注册
- `update` - 更新用户信息
- `get` - 获取用户信息

## 安装依赖

```bash
cd server
npm install
```

## 运行测试

```bash
# 运行所有测试
npm test

# 运行指定测试
npm run test:dish
npm run test:meal
npm run test:order
npm run test:user

# 监听模式
npm run test:watch
```

## 数据库配置

在部署前，需要配置数据库连接信息：

1. 创建MySQL数据库
2. 执行DDL文件创建表结构
3. 配置云函数环境变量

### 环境变量

```bash
DB_HOST=localhost      # 数据库主机
DB_PORT=3306          # 数据库端口
DB_USER=root          # 数据库用户
DB_PASSWORD=          # 数据库密码
DB_NAME=what_to_eat   # 数据库名称
```

## 部署

### 1. 创建数据库

```bash
mysql -u root -p < ddl/wte_users.sql
mysql -u root -p < ddl/wte_dishes.sql
mysql -u root -p < ddl/wte_meals.sql
mysql -u root -p < ddl/wte_meal_dishes.sql
mysql -u root -p < ddl/wte_orders.sql
```

### 2. 部署云函数

使用腾讯云CLI：

```bash
# 部署所有云函数
node scripts/deploy.js

# 或使用腾讯云CLI直接部署
tcb fn deploy dish
tcb fn deploy meal
tcb fn deploy order
tcb fn deploy user
```

## 开发规范

### 代码规范

- 使用ES6+语法
- 使用async/await处理异步
- 所有函数必须有JSDoc注释
- 错误处理必须完善

### 测试规范

- 每个云函数必须有完整的单元测试
- 测试覆盖率要求>80%
- 每次提交前必须确保测试通过
- 测试数据必须独立，不能相互影响

### 数据库规范

- 表名使用wte_前缀
- 字段名使用下划线命名法
- 所有表必须有created_at和updated_at字段
- 外键必须建立索引
- 删除操作使用软删除

## 注意事项

1. 生产环境需要配置正确的数据库连接信息
2. 微信登录需要配置正确的AppID和AppSecret
3. 云函数需要配置适当的内存和超时时间
4. 建议启用数据库连接池
5. 定期备份数据库

## 更新日志

### v1.0.0
- 初始版本
- 实现菜品、点餐、订单、用户管理功能
- 完整的单元测试覆盖
