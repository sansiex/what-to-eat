#!/usr/bin/env python3
"""
生成点餐详情页按钮图标 (SVG -> PNG)
使用 Pillow 绘制简单图标，输出到 images/ 目录
"""
import os

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("请安装 Pillow: pip install Pillow")
    exit(1)

SIZE = 64
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'images')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def draw_edit_icon():
    """修改 - 铅笔图标"""
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # 铅笔：斜矩形 + 笔尖
    draw.polygon([
        (14, 50), (38, 14), (50, 26), (26, 62)
    ], outline=(255, 255, 255), width=3)
    draw.line([(26, 62), (50, 26)], fill=(255, 255, 255), width=3)
    return img


def draw_order_icon():
    """点餐 - 餐盘+筷子"""
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE // 2, SIZE // 2
    r = 20
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255), width=3)
    draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], outline=(255, 255, 255), width=2)
    return img


def draw_close_icon():
    """收单 - 对勾"""
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.line([(12, 32), (24, 48)], fill=(255, 255, 255), width=4)
    draw.line([(24, 48), (52, 16)], fill=(255, 255, 255), width=4)
    return img


def draw_reopen_icon():
    """恢复点餐 - 循环箭头"""
    import math
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE // 2, SIZE // 2
    r = 18
    pts = []
    for i in range(25):
        a = 220 + i * 5  # 从左上开始
        x = cx + r * math.cos(math.radians(a))
        y = cy - r * math.sin(math.radians(a))
        pts.append((x, y))
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i+1]], fill=(255, 255, 255), width=3)
    # 箭头
    draw.polygon([(cx - 10, cy - 18), (cx + 2, cy - 18), (cx - 4, cy - 8)], fill=(255, 255, 255))
    return img


def draw_share_icon():
    """分享 - 分享节点"""
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([10, 10, 26, 26], fill=(255, 255, 255))
    draw.ellipse([38, 10, 54, 26], fill=(255, 255, 255))
    draw.ellipse([22, 38, 42, 54], fill=(255, 255, 255))
    draw.line([(18, 18), (32, 46)], fill=(255, 255, 255), width=2)
    draw.line([(46, 18), (32, 46)], fill=(255, 255, 255), width=2)
    return img


def main():
    icons = [
        ('icon-edit.png', draw_edit_icon),
        ('icon-order.png', draw_order_icon),
        ('icon-close.png', draw_close_icon),
        ('icon-reopen.png', draw_reopen_icon),
        ('icon-share.png', draw_share_icon),
    ]
    for name, draw_fn in icons:
        path = os.path.join(OUTPUT_DIR, name)
        img = draw_fn()
        img.save(path)
        print(f'Generated {path}')


if __name__ == '__main__':
    main()
