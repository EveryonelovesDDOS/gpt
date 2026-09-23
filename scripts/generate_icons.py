"""Generate simple geometric app icons; requires Pillow."""
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
        px[x, y] = tuple(round(a * (1 - t) + b * t) for a, b in zip((125, 103, 248), (73, 61, 193)))
d = ImageDraw.Draw(im)
d.rounded_rectangle((145, 145, 879, 879), radius=215, fill=(255, 255, 255, 30), width=0)
# An opening spiral / moment of breathing space.
d.arc((275, 275, 749, 749), start=38, end=318, fill="white", width=62)
d.arc((365, 365, 659, 659), start=210, end=510, fill=(222, 215, 255), width=46)
d.ellipse((472, 472, 552, 552), fill="white")
d.ellipse((689, 269, 755, 335), fill=(255, 204, 172))
im.save(OUT / "icon.png")
im.save(OUT / "android-icon-foreground.png")
Image.new("RGB", (N, N), "#6555E8").save(OUT / "android-icon-background.png")
mono = Image.new("RGBA", (N, N), (0, 0, 0, 0))
m = ImageDraw.Draw(mono)
m.arc((275, 275, 749, 749), start=38, end=318, fill="white", width=62)
m.arc((365, 365, 659, 659), start=210, end=510, fill="white", width=46)
m.ellipse((472, 472, 552, 552), fill="white")
mono.save(OUT / "android-icon-monochrome.png")
im.resize((64, 64), Image.Resampling.LANCZOS).save(OUT / "favicon.png")
