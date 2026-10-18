# -*- coding: utf-8 -*-
"""把鲸鱼娘素材处理成应用资源。

输入：
  src-happy.jpg  站姿立绘（白底）
  src-sleep.png  抱膝睡着（白底）
  src-note.jpg   鲸元券
输出：
  mascot-happy.png / mascot-sleep.png  透明立绘
  mascot-head.png                     头像（方形，底部渐隐）
  logo.png                            侧边栏 Logo（浅底圆角）
  note.jpg                            鲸元券（按界面尺寸压过）
  icon-source.png                     应用图标源图
"""
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, "src", "assets")

SRC_HAPPY = os.path.join(ASSETS, "src-happy.jpg")
SRC_SLEEP = os.path.join(ASSETS, "src-sleep.png")
SRC_NOTE = os.path.join(ASSETS, "src-note.jpg")

MAGIC = (255, 0, 255)


def cutout(path, thresh=44):
    """白底转透明：从四角洪泛填充，再收缩 alpha 去掉描边残留。"""
    im = Image.open(path).convert("RGB")
    w, h = im.size

    work = im.copy()
    for seed in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]:
        ImageDraw.floodfill(work, seed, MAGIC, thresh=thresh)

    src = im.load()
    px = work.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] != MAGIC:
                dst[x, y] = src[x, y] + (255,)

    out.putalpha(out.getchannel("A").filter(ImageFilter.MinFilter(3)))
    return out.crop(out.getbbox())


def save_fit(img, name, max_h):
    w, h = img.size
    if h > max_h:
        img = img.resize((round(w * max_h / h), max_h), Image.LANCZOS)
    img.save(os.path.join(ASSETS, name), "PNG", optimize=True)
    print("saved", name, img.size)


def fade_bottom(img, ratio=0.10):
    w, h = img.size
    start = int(h * (1 - ratio))
    mask = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(mask)
    for y in range(start, h):
        t = (y - start) / max(1, h - 1 - start)
        d.line([(0, y), (w, y)], fill=int(255 * (1 - t) ** 1.3))
    out = img.copy()
    out.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
    return out


def rounded_mask(size, radius_ratio):
    s = size * 4
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=255
    )
    return m.resize((size, size), Image.LANCZOS)


def build_icon(head, size=1024):
    # 背景：白 → 淡蓝竖向渐变
    bg = Image.new("RGB", (size, size), "#ffffff")
    d = ImageDraw.Draw(bg)
    top, bottom = (255, 255, 255), (206, 232, 252)
    for y in range(size):
        t = y / (size - 1)
        c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)

    h = fade_bottom(head, 0.06)
    scale = min(int(size * 0.86) / h.width, (size * 0.98) / h.height)
    hs = h.resize((round(h.width * scale), round(h.height * scale)), Image.LANCZOS)

    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.paste(hs, ((size - hs.width) // 2, size - hs.height - int(size * 0.008)), hs)
    canvas = Image.alpha_composite(bg.convert("RGBA"), layer)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), rounded_mask(size, 0.225))
    ImageDraw.Draw(out).rounded_rectangle(
        [3, 3, size - 4, size - 4],
        radius=int(size * 0.225),
        outline=(150, 198, 236, 255),
        width=6,
    )
    return out


def main():
    happy = cutout(SRC_HAPPY)
    sleep = cutout(SRC_SLEEP)
    save_fit(happy, "mascot-happy.png", 720)
    save_fit(sleep, "mascot-sleep.png", 720)

    # 头像：以脸为中心的方形裁切（原图 1080×1080）
    raw = Image.open(SRC_HAPPY).convert("RGB")
    w = raw.size[0]
    side = 720
    left = int(w * 0.5 - side / 2)
    top = 95
    raw.crop((left, top, left + side, top + side)).save(
        os.path.join(ASSETS, "_head_raw.png")
    )
    head = cutout(os.path.join(ASSETS, "_head_raw.png"))
    os.remove(os.path.join(ASSETS, "_head_raw.png"))
    save_fit(head, "mascot-head.png", 512)

    icon = build_icon(head, 1024)
    icon.save(os.path.join(BASE, "icon-source.png"), "PNG")
    icon.resize((256, 256), Image.LANCZOS).save(
        os.path.join(ASSETS, "logo.png"), "PNG", optimize=True
    )
    print("icon-source + logo ready")

    # 鲸元券：界面最大显示约 620px 宽，留 2 倍冗余
    note = Image.open(SRC_NOTE).convert("RGB")
    note = note.resize((1240, round(note.height * 1240 / note.width)), Image.LANCZOS)
    note.save(os.path.join(ASSETS, "note.jpg"), "JPEG", quality=88, optimize=True)
    print("note ready", note.size)


if __name__ == "__main__":
    main()
