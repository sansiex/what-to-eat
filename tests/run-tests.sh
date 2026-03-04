#!/bin/bash
# 运行前端测试脚本

# 激活虚拟环境
source /Users/sansi/dev/trae_projects/what-to-eat/venv/bin/activate

# 切换到测试目录
cd /Users/sansi/dev/trae_projects/what-to-eat/tests

# 检查参数
if [ $# -eq 0 ]; then
    echo "用法: ./run-tests.sh [test-file-name]"
    echo ""
    echo "可用的测试文件:"
    echo "  test-share-meal       - 分享页面单元测试"
    echo "  test-share-integration - 分享功能集成测试"
    echo "  all                   - 运行所有测试"
    echo ""
    echo "示例:"
    echo "  ./run-tests.sh test-share-meal"
    echo "  ./run-tests.sh all"
    exit 1
fi

TEST_NAME=$1

if [ "$TEST_NAME" = "all" ]; then
    echo "运行所有测试..."
    minitest -m test-share-meal test-share-integration -c minium-config.json
else
    echo "运行测试: $TEST_NAME"
    minitest -m "$TEST_NAME" -c minium-config.json
fi
