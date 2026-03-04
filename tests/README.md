# 前端单元测试

本目录包含微信小程序的前端单元测试，使用 [minium](https://git.weixin.qq.com/minitest/minium-doc) 测试框架。

## 测试文件说明

- `test-share-meal.py` - 分享点餐页面单元测试
- `test-share-integration.py` - 分享功能集成测试
- `minium-config.json` - minium 测试配置文件
- `run-tests.sh` - 测试运行脚本

## 环境要求

minium 已安装在项目虚拟环境中：
```
/Users/sansi/dev/trae_projects/what-to-eat/venv
```

### 激活虚拟环境
```bash
source /Users/sansi/dev/trae_projects/what-to-eat/venv/bin/activate
```

### 验证安装
```bash
minitest --version
```

## 运行测试

### 使用便捷脚本（推荐）
```bash
# 运行单个测试
cd tests
./run-tests.sh test-share-meal

# 运行所有测试
./run-tests.sh all
```

### 手动运行
```bash
# 激活虚拟环境
source /Users/sansi/dev/trae_projects/what-to-eat/venv/bin/activate

# 运行单个测试文件
cd tests
minitest -m test-share-meal -c minium-config.json

# 运行所有测试
minitest -m test-share-meal test-share-integration -c minium-config.json

# 生成测试报告
minitest -m test-share-meal -c minium-config.json --generate-report
```

## 测试覆盖范围

### 分享点餐页面测试 (test-share-meal.py)

1. **页面加载测试**
   - 使用有效参数加载页面
   - 使用无效令牌加载页面
   - 缺少参数时的处理

2. **交互功能测试**
   - 菜品选择功能
   - 下单按钮点击
   - 姓名输入弹窗
   - 进入厨房按钮

3. **UI 验证**
   - 分享页面没有底部 tab 栏

### 集成测试 (test-share-integration.py)

1. **完整流程测试**
   - 创建点餐
   - 生成分享链接
   - 匿名用户打开分享
   - 匿名用户下单
   - 进入厨房

2. **异常场景测试**
   - 分享链接失效
   - 已收单点餐分享

## 编写新测试

参考现有测试文件，遵循以下规范：

1. 继承 `minium.MiniTest` 类
2. 使用 `setUp` 和 `tearDown` 进行初始化和清理
3. 测试方法名以 `test_` 开头
4. 使用断言验证结果：`self.assertEqual`, `self.assertIsNotNone` 等
5. 添加适当的等待时间确保页面加载完成

## 注意事项

1. 测试前确保微信开发者工具已登录
2. 测试过程中不要操作鼠标和键盘
3. 测试完成后检查测试数据是否清理
4. 网络不稳定时可能需要增加等待时间
