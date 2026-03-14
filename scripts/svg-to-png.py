#!/usr/bin/env python3
"""
SVG 转 PNG 转换脚本
用于将 SVG 图标转换为微信小程序所需的 PNG 格式
"""

import os
import sys
from pathlib import Path

# 检查是否安装了 cairosvg
try:
    import cairosvg
except ImportError:
    print("错误: 需要安装 cairosvg 库")
    print("请运行: pip install cairosvg")
    sys.exit(1)

# 配置
SVG_DIR = Path("images/svg")
OUTPUT_DIR = Path("images")
ICON_SIZE = 48  # 微信小程序 tabBar 图标推荐尺寸

# SVG 文件列表
SVG_FILES = [
    ("tab-menu.svg", "tab-menu.png"),
    ("tab-menu-active.svg", "tab-menu-active.png"),
    ("tab-dish.svg", "tab-dish.png"),
    ("tab-dish-active.svg", "tab-dish-active.png"),
    ("tab-meal.svg", "tab-meal.png"),
    ("tab-meal-active.svg", "tab-meal-active.png"),
]


def convert_svg_to_png(svg_path, png_path, size=ICON_SIZE):
    """将单个 SVG 文件转换为 PNG"""
    try:
        # 读取 SVG 内容
        with open(svg_path, 'rb') as f:
            svg_content = f.read()
        
        # 转换为 PNG
        cairosvg.svg2png(
            bytestring=svg_content,
            write_to=str(png_path),
            output_width=size,
            output_height=size
        )
        
        print(f"✓ 转换成功: {svg_path.name} -> {png_path.name}")
        return True
        
    except Exception as e:
        print(f"✗ 转换失败: {svg_path.name} - {str(e)}")
        return False


def main():
    """主函数"""
    # 确保输出目录存在
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("=" * 50)
    print("SVG 转 PNG 转换工具")
    print("=" * 50)
    print(f"输入目录: {SVG_DIR}")
    print(f"输出目录: {OUTPUT_DIR}")
    print(f"图标尺寸: {ICON_SIZE}x{ICON_SIZE}")
    print("=" * 50)
    
    success_count = 0
    fail_count = 0
    
    for svg_name, png_name in SVG_FILES:
        svg_path = SVG_DIR / svg_name
        png_path = OUTPUT_DIR / png_name
        
        if not svg_path.exists():
            print(f"✗ 文件不存在: {svg_path}")
            fail_count += 1
            continue
        
        if convert_svg_to_png(svg_path, png_path):
            success_count += 1
        else:
            fail_count += 1
    
    print("=" * 50)
    print(f"转换完成: 成功 {success_count} 个, 失败 {fail_count} 个")
    print("=" * 50)
    
    return fail_count == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
