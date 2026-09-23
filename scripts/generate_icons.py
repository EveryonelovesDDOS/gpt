"""Generate NOVA's geometric icon; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "assets"
OUT.mkdir(exist_ok=True)
N = 1024
im = Image.new("RGB", (N, N))
px = im.load()
for y in range(N):
    for x in range(N):
        t = (x + y) / (2 * N)
        px[x, y] = tuple(round(a * (1 - t) + b * t) for a, b in zip((8, 14, 25), (19, 37, 62)))
d = ImageDraw.Draw(im)
d.ellipse((183, 183, 841, 841), outline=(37, 82, 124), width=4)
d.ellipse((248, 248, 776, 776), outline=(29, 63, 102), width=3)
# The white angular N has a cyan cut through its diagonal.
d.rounded_rectangle((305, 320, 390, 700), radius=19, fill=(239, 247, 255))
d.polygon([(375, 320), (455, 320), (647, 625), (647, 700), (577, 700), (375, 394)], fill=(239, 247, 255))
d.rounded_rectangle((625, 320, 710, 700), radius=19, fill=(239, 247, 255))
d.polygon([(459, 452), (549, 452), (610, 550), (523, 550)], fill=(73, 166, 255))
d.ellipse((718, 229, 752, 263), fill=(105, 200, 255))
im.save(OUT / "icon.png")
im.save(OUT / "android-icon-foreground.png")
Image.new("RGB", (N, N), "#090D15").save(OUT / "android-icon-background.png")
mono = Image.new("RGBA", (N, N), (0, 0, 0, 0))
m = ImageDraw.Draw(mono)
m.rounded_rectangle((305, 320, 390, 700), radius=19, fill="white")
m.polygon([(375, 320), (455, 320), (647, 625), (647, 700), (577, 700), (375, 394)], fill="white")
m.rounded_rectangle((625, 320, 710, 700), radius=19, fill="white")
mono.save(OUT / "android-icon-monochrome.png")
im.resize((64, 64), Image.Resampling.LANCZOS).save(OUT / "favicon.png")
im.save(OUT / "splash-icon.png")
