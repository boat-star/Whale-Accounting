# -*- coding: utf-8 -*-
"""把鲸鱼娘立绘处理成应用素材：透明立绘、头像、应用图标源图。"""
import os
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, "src-tauri", "..", "src", "assets")
ASSETS = os.path.normpath(ASSETS)

HAPPY = os.path.join(ASSETS, "Original_cute_anime_style_chib_2026-10-18T04-10-16.png")
SLEEP = os.path.join(ASSETS, "Original_cute_anime_chibi_illu_2026-10-18T06-03-59.png")

MAGIC = (255, 0, 255)


def cutout(path, out_path, clear_corner=True):
    im = Image.open(path).convert("RGB")
    w, h = im.size

    # 1) 用奶油底色盖掉右下角的水印，避免抠图后残留
    if clear_corner:
        bg = im.getpixel((3, 3))
        d0 = ImageDraw.Draw(im)
        d0.rectangle([int(w * 0.74), int(h * 0.90), w, h], fill=bg)

    # 2) 从四角洪泛填充背景为品红，再转成透明
    work = im.copy()
    d = ImageDraw.Draw(work)
    for seed in [(1, 1), (w - 2, 1), (1, h - 2)]:
        ImageDraw.floodfill(work, seed, MAGIC, thresh=46)

    px = work.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()
    src = im.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p == MAGIC:
                continue
            dst[x, y] = src[x, y] + (255,)

    # 3) 收缩 alpha 一像素，去掉边缘残留的浅色描边
    alpha = out.getchannel("A").filter(ImageFilter.MinFilter(3))
    out.putalpha(alpha)

    bbox = out.getbbox()
    out = out.crop(bbox)
    return out


def save_fit(img, path, max_h):
    w, h = img.size
    if h > max_h:
        img = img.resize((round(w * max_h / h), max_h), Image.LANCZOS)
    img.save(path, "PNG", optimize=True)
    print("saved", os.path.basename(path), img.size)


def rounded_mask(size, radius_ratio=0.225):
    s = size * 4
    m = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def fade_bottom(img, ratio=0.14):
    """让底部边缘柔和淡出，避免方框裁切留下生硬横线。"""
    from PIL import ImageChops

    w, h = img.size
    start = int(h * (1 - ratio))
    mask = Image.new("L", (w, h), 255)
    md = ImageDraw.Draw(mask)
    for y in range(start, h):
        t = (y - start) / max(1, h - 1 - start)
        md.line([(0, y), (w, y)], fill=int(255 * (1 - t) ** 1.3))
    out = img.copy()
    out.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
    return out


def build_icon(head, size=1024):
    # 背景：淡水蓝渐变 + 细边框
    bg = Image.new("RGB", (size, size), "#ffffff")
    top = (255, 255, 255)
    bot = (206, 232, 252)
    d = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / (size - 1)
        c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)

    # 头像居中，留一点呼吸空间，避免呆毛被圆角切掉
    target = int(size * 0.86)
    hw, hh = head.size
    scale = min(target / hw, target / hh)
    head = fade_bottom(head)
    hw, hh = head.size
    hs = head.resize((round(hw * scale), round(hh * scale)), Image.LANCZOS)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.paste(hs, ((size - hs.width) // 2, int(size * 0.03)), hs)

    canvas = bg.convert("RGBA")
    canvas = Image.alpha_composite(canvas, layer)

    # 圆角裁切 + 淡蓝描边
    mask = rounded_mask(size)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), mask)
    ring = ImageDraw.Draw(out)
    ring.rounded_rectangle(
        [3, 3, size - 4, size - 4], radius=int(size * 0.225), outline=(150, 198, 236, 255), width=6
    )
    return out


def main():
    happy = cutout(HAPPY, os.path.join(ASSETS, "mascot-happy.png"))
    sleep = cutout(SLEEP, os.path.join(ASSETS, "mascot-sleep.png"))
    print("happy bbox ok", happy.size, "sleep", sleep.size)

    save_fit(happy, os.path.join(ASSETS, "mascot-happy.png"), 720)
    save_fit(sleep, os.path.join(ASSETS, "mascot-sleep.png"), 720)

    # 头像：以脸部为中心的方形裁切（相对原始立绘坐标，含下巴与肩部）
    head = Image.open(HAPPY).convert("RGBA")
    w, h = head.size
    side = 800
    left = int(w * 0.5 - side / 2)
    top = 55
    head = head.crop((left, top, left + side, top + side))
    # 头像是从原图裁的，需要单独抠底（该区域没有水印，不做角落清理）
    head.save(os.path.join(ASSETS, "_head_raw.png"))
    head = cutout(os.path.join(ASSETS, "_head_raw.png"), None, clear_corner=False)
    save_fit(head, os.path.join(ASSETS, "mascot-head.png"), 512)
    os.remove(os.path.join(ASSETS, "_head_raw.png"))

    icon = build_icon(head, 1024)
    icon.save(os.path.join(BASE, "icon-source.png"), "PNG")
    print("icon-source ready", icon.size)


if __name__ == "__main__":
    main()
