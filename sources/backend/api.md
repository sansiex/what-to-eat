# 后端接口文档

## 基础信息
- 服务域名：www.whattoeat.com
- 请求方法：GET/POST
- 响应格式：JSON
- 认证方式：微信小程序登录态

## 接口列表

### 1. 菜品管理

#### 1.1 获取菜品列表
- **路径**：/api/dishes
- **方法**：GET
- **参数**：无
- **响应**：
```json
{
  "code": 0,
  "data": [
    {
      "id": "1",
      "name": "番茄炒蛋",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "2",
      "name": "宫保鸡丁",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "message": "success"
}
```

#### 1.2 添加菜品
- **路径**：/api/dishes
- **方法**：POST
- **参数**：
  - name: 菜品名称
- **响应**：
```json
{
  "code": 0,
  "data": {
    "id": "3",
    "name": "红烧肉",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "success"
}
```

#### 1.3 更新菜品
- **路径**：/api/dishes/:id
- **方法**：PUT
- **参数**：
  - name: 菜品名称
- **响应**：
```json
{
  "code": 0,
  "data": {
    "id": "3",
    "name": "红烧肉（改良版）",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "success"
}
```

#### 1.4 删除菜品
- **路径**：/api/dishes/:id
- **方法**：DELETE
- **参数**：无
- **响应**：
```json
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### 2. 餐食管理

#### 2.1 发起餐食
- **路径**：/api/meals
- **方法**：POST
- **参数**：
  - name: 餐食名称
  - dishIds: 菜品ID数组
- **响应**：
```json
{
  "code": 0,
  "data": {
    "id": "1",
    "name": "午餐",
    "dishIds": ["1", "2", "3"],
    "createdAt": "2024-01-01T12:00:00Z",
    "creator": "user1"
  },
  "message": "success"
}
```

#### 2.2 获取当前餐食
- **路径**：/api/meals/current
- **方法**：GET
- **参数**：无
- **响应**：
```json
{
  "code": 0,
  "data": {
    "id": "1",
    "name": "午餐",
    "dishes": [
      {
        "id": "1",
        "name": "番茄炒蛋"
      },
      {
        "id": "2",
        "name": "宫保鸡丁"
      },
      {
        "id": "3",
        "name": "红烧肉"
      }
    ],
    "createdAt": "2024-01-01T12:00:00Z",
    "creator": "user1"
  },
  "message": "success"
}
```

### 3. 订单管理

#### 3.1 提交订单
- **路径**：/api/orders
- **方法**：POST
- **参数**：
  - mealId: 餐食ID
  - dishIds: 选中的菜品ID数组
- **响应**：
```json
{
  "code": 0,
  "data": {
    "id": "1",
    "userId": "user2",
    "userName": "张三",
    "mealId": "1",
    "selectedDishes": ["1", "3"],
    "createdAt": "2024-01-01T12:30:00Z"
  },
  "message": "success"
}
```

#### 3.2 获取餐食的所有订单
- **路径**：/api/orders/meal/:mealId
- **方法**：GET
- **参数**：无
- **响应**：
```json
{
  "code": 0,
  "data": [
    {
      "id": "1",
      "userId": "user2",
      "userName": "张三",
      "mealId": "1",
      "selectedDishes": ["1", "3"],
      "createdAt": "2024-01-01T12:30:00Z"
    },
    {
      "id": "2",
      "userId": "user3",
      "userName": "李四",
      "mealId": "1",
      "selectedDishes": ["2", "3"],
      "createdAt": "2024-01-01T12:40:00Z"
    }
  ],
  "message": "success"
}
```

### 4. 用户管理

#### 4.1 获取当前用户信息
- **路径**：/api/users/current
- **方法**：GET
- **参数**：无
- **响应**：
```json
{
  "code": 0,
  "data": {
    "id": "user1",
    "name": "王五",
    "avatar": "https://example.com/avatar.jpg"
  },
  "message": "success"
}
```

## 错误码说明
- 0: 成功
- 400: 参数错误
- 401: 未授权
- 404: 资源不存在
- 500: 服务器内部错误
