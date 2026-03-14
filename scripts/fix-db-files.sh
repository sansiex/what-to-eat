#!/bin/bash

# 统一所有云函数的 db.js 文件
# 使用 menu/utils/db.js 作为标准

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_DB="$PROJECT_ROOT/server/functions/menu/utils/db.js"

echo "=== 开始统一所有云函数的 db.js 文件 ==="

# 需要更新的云函数列表
FUNCTIONS=("dish" "kitchen" "meal" "order" "user")

for func in "${FUNCTIONS[@]}"; do
  TARGET_DIR="$PROJECT_ROOT/server/functions/$func/utils"
  TARGET_DB="$TARGET_DIR/db.js"
  
  if [ -f "$SOURCE_DB" ] && [ -d "$TARGET_DIR" ]; then
    echo ""
    echo "正在更新 $func/utils/db.js..."
    cp "$SOURCE_DB" "$TARGET_DB"
    if [ $? -eq 0 ]; then
      echo "✓ $func/utils/db.js 更新成功"
    else
      echo "✗ $func/utils/db.js 更新失败"
    fi
  else
    echo "✗ 跳过 $func，文件或目录不存在"
  fi
done

echo ""
echo "=== 所有 db.js 文件已统一 ==="
