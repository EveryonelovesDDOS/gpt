"""Render a design preview of the desktop/mobile NOVA UI; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "nova-preview.png"
OUT.parent.mkdir(exist_ok=True)
W, H = 1800, 1000
im = Image.new("RGB", (W, H), "#070B12")
d = ImageDraw.Draw(im)
regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def font(size, weight=False):
    return ImageFont.truetype(bold if weight else regular, size)
def box(xy, fill, radius=18, outline=None, width=1):
    d.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)
def txt(pos, value, size, color, weight=False):
    d.text(pos, value, font=font(size, weight), fill=color)
def line(xy, color="#24344A", width=1):
    d.line(xy, fill=color, width=width)
def glow(cx, cy, r, color):
    layer = Image.new("RGBA", (W, H))
    ld = ImageDraw.Draw(layer)
    ld.ellipse((cx-r, cy-r, cx+r, cy+r), fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(r // 3))
    im.paste(layer, (0, 0), layer)
def orb(cx, cy, r):
    glow(cx, cy, int(r*.8), (25, 97, 190, 135))
    d.ellipse((cx-r, cy-r, cx+r, cy+r), outline="#426DA4", width=2)
    d.ellipse((cx-r*.78, cy-r*.78, cx+r*.78, cy+r*.78), outline="#263F70", width=2)
    d.ellipse((cx-r*.56, cy-r*.56, cx+r*.56, cy+r*.56), fill="#2879D8", outline="#71C9FF", width=3)
    txt((cx-r*.17, cy-r*.40), "N", int(r*.72), "#F6FBFF", True)
    d.ellipse((cx+r*.63, cy-r*.85, cx+r*.70, cy-r*.78), fill="#8BD3FF")
    d.ellipse((cx-r*.8, cy+r*.42, cx-r*.74, cy+r*.48), fill="#AA94FF")

txt((76, 18), "NOVA   /   LOCAL AGENT STUDIO", 16, "#8FBFFF", True)
txt((1424, 18), "DESIGN PREVIEW  01 / 01", 13, "#7088A6")
# Desktop frame
box((48, 56, 1270, 907), "#0A101A", 28, "#29415C", 2)
box((49, 57, 265, 906), "#0D1420", 27)
line((265, 57, 265, 907))
box((72, 88, 112, 128), "#67B9FF", 11)
txt((82, 92), "N", 27, "#061423", True)
txt((126, 88), "NOVA", 22, "#F2F7FD", True)
txt((126, 117), "LOCAL AGENT STUDIO", 8, "#6F89A7", True)
txt((78, 186), "WORKSPACE", 11, "#647D9D", True)
for i, (label, icon) in enumerate([("Overview", "O"), ("Agent", "A"), ("Workspace", "W"), ("Settings", "S")]):
    y = 219 + i*57
    if i == 0: box((68, y, 245, y+45), "#172D45", 12)
    txt((86, y+9), icon, 17, "#76BCFF" if i == 0 else "#667E9B", True)
    txt((122, y+12), label, 14, "#F2F7FD" if i == 0 else "#8295AC")
line((72, 778, 243, 778))
box((75, 803, 231, 835), "#142B34", 15, "#2A6668")
txt((91, 814), "INTERACTIVE PREVIEW", 9, "#79E5D0", True)
txt((76, 850), "Local files stay under your control.", 9, "#7189A4")
# Desktop header and main
line((265, 130, 1270, 130))
txt((300, 88), "Overview", 18, "#F5F8FF", True)
box((1034, 87, 1235, 116), "#1C213B", 14, "#505185")
txt((1054, 96), "INTERACTIVE PREVIEW", 11, "#C3ACFF", True)
box((300, 165, 412, 189), "#18332F", 12)
txt((314, 172), "AUTONOMOUS", 10, "#79E5D0", True)
box((300, 212, 947, 552), "#111F33", 25, "#385373", 2)
txt((334, 252), "YOUR LOCAL INTELLIGENCE", 13, "#83C3FF", True)
txt((334, 302), "Your idea.", 39, "#F6FAFF", True)
txt((334, 357), "NOVA executes.", 39, "#7BC2FF", True)
txt((334, 424), "A visible agent that plans, reads local files,", 15, "#A7BACD")
txt((334, 449), "uses tools, and asks before writing.", 15, "#A7BACD")
box((334, 487, 514, 527), "#7FC6FF", 10)
txt((354, 499), "Start a mission  /", 13, "#0B2032", True)
orb(792, 379, 112)
# Desktop right rail
line((970, 131, 970, 907))
txt((997, 168), "SYSTEM STATUS", 11, "#7D96B5", True)
box((992, 205, 1243, 507), "#101D30", 19, "#2F465F")
orb(1116, 326, 82)
box((1026, 428, 1212, 455), "#1C2440", 13)
txt((1040, 436), "PREVIEW MODE ACTIVE", 10, "#BAA9FF", True)
txt((1043, 469), "Ready for your next move.", 11, "#A8B9CD")
txt((997, 548), "CAPABILITIES", 11, "#7D96B5", True)
for i, label in enumerate(["Local documents", "Search & reading", "Precise calculation", "Write approval"]):
    y = 586 + i*55
    txt((1001, y), "+", 18, "#76BCFF", True)
    txt((1033, y+3), label, 13, "#A5B7CD")
    line((998, y+38, 1234, y+38))
# Desktop cards
txt((300, 579), "ONE PROMPT. MULTIPLE ACTIONS.", 11, "#82BDF4", True)
txt((300, 612), "What should NOVA do next?", 23, "#F2F6FE", True)
for i, (title, subtitle, color) in enumerate([
    ("Create a brief", "Turn notes into a sharp summary.", "#7DC4FF"),
    ("Plan a project", "Break an idea into clear actions.", "#BC9BFF"),
    ("Find a signal", "Search the workspace for answers.", "#75E4CE"),
]):
    x = 300 + i*214
    box((x, 665, x+200, 822), "#131D2B", 17, "#2B3C53")
    box((x+17, 685, x+53, 721), "#1A344E", 10)
    txt((x+29, 692), "+", 19, color, True)
    txt((x+17, 739), title, 15, "#F3F6FC", True)
    txt((x+17, 771), subtitle, 10, "#8D9FB6")
# Mobile frame
box((1320, 55, 1736, 945), "#010307", 53, "#324660", 4)
box((1335, 73, 1721, 930), "#0B111B", 43)
box((1457, 82, 1599, 108), "#010307", 15)
txt((1362, 96), "9:41", 13, "#F3F6FC", True)
txt((1657, 96), "100%", 10, "#F3F6FC")
box((1357, 146, 1393, 182), "#6EBCFF", 10)
txt((1366, 151), "N", 24, "#051522", True)
txt((1406, 151), "NOVA", 18, "#F4F8FE", True)
box((1588, 148, 1699, 177), "#1F213B", 15, "#414472")
txt((1600, 158), "PREVIEW", 9, "#CAB5FF", True)
box((1357, 209, 1521, 230), "#16302C", 11)
txt((1368, 215), "AUTONOMOUS / PRIVATE", 9, "#78DBC7", True)
box((1354, 252, 1702, 654), "#122037", 22, "#385577", 2)
txt((1380, 281), "YOUR LOCAL INTELLIGENCE", 10, "#8CC9FF", True)
txt((1380, 318), "Your idea.", 28, "#F5F9FF", True)
txt((1380, 353), "NOVA executes.", 28, "#85C6FF", True)
orb(1527, 478, 88)
txt((1380, 569), "Plan. Inspect. Act. Ask first.", 12, "#AAC1D8")
box((1380, 596, 1544, 635), "#82C6FF", 10)
txt((1395, 607), "Start a mission  /", 11, "#071827", True)
txt((1358, 687), "WHAT SHOULD NOVA DO?", 12, "#B2C5DA", True)
for i, (title, accent) in enumerate([("Create a brief", "#7DC4FF"), ("Plan a project", "#B79CFF")]):
    x = 1357 + i*177
    box((x, 717, x+169, 822), "#141E2D", 14, "#2F4057")
    txt((x+13, 737), "+", 21, accent, True)
    txt((x+13, 780), title, 11, "#F5F8FD", True)
line((1337, 862, 1718, 862))
for i, (label, icon) in enumerate([("Overview", "O"), ("Agent", "A"), ("Files", "F"), ("Settings", "S")]):
    x = 1361 + i*90
    txt((x+21, 872), icon, 17, "#79BEFF" if i == 0 else "#647A99", True)
    txt((x+5, 899), label, 9, "#79BEFF" if i == 0 else "#647A99")
im.save(OUT, quality=95)
print(OUT)
