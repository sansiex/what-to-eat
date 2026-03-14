#!/bin/bash

# 安装所有云函数的依赖
cd "$(dirname "$0")/.."

echo "=== 开始安装所有云函数依赖 ==="

for dir in server/functions/*; do
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    echo ""
    echo "正在安装 $dir 的依赖..."
    cd "$dir" && npm install && cd - > /dev/null
    if [ $? -eq 0 ]; then
      echo "✓ $dir 依赖安装成功"
    else
      echo "✗ $dir 依赖安装失败"
    fi
  fi
done

echo ""
echo "=== 所有云函数依赖安装完成 ==="
