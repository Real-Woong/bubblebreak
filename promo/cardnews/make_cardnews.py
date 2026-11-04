"""BubbleBreak 카드뉴스 생성 스크립트 (1080x1350, 인스타 4:5 캐러셀 기준).

실행: python3 -I promo/cardnews/make_cardnews.py <screenshot_dir>
 - screenshot_dir: 앱 캡처(jpg)가 있는 폴더. 파일명 끝이 -17, -11, -16 인 캡처를 사용한다.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 2  # supersample
W, H = 1080, 1350
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
WEIGHT = {"reg": 0, "med": 2, "semi": 4, "bold": 6, "light": 8}
SHOT_DIR = sys.argv[1] if len(sys.argv) > 1 else ""
TOTAL = 8

# brand palette
PURPLE = (168, 85, 247)
VIOLET = (124, 58, 237)
PINK = (244, 114, 182)
HOT = (236, 72, 153)
INK = (31, 17, 64)
DARK1 = (22, 9, 48)
DARK2 = (48, 18, 92)


def F(size, w="bold"):
    return ImageFont.truetype(FONT, int(size * S), index=WEIGHT[w])


def lerp(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def gradient(w, h, c1, c2, diag=True):
    ys, xs = np.mgrid[0:h, 0:w]
    t = (xs / max(w - 1, 1) * 0.5 + ys / max(h - 1, 1) * 0.5) if diag else ys / max(h - 1, 1)
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for i in range(3):
        arr[..., i] = (c1[i] * (1 - t) + c2[i] * t).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def new_canvas(theme):
    if theme == "grad":
        bg = gradient(W * S, H * S, VIOLET, HOT)
    elif theme == "dark":
        bg = gradient(W * S, H * S, DARK1, DARK2)
    else:
        bg = gradient(W * S, H * S, (251, 246, 255), (255, 237, 247))
    return bg.convert("RGBA")


def tw(d, text, font):
    return d.textlength(text, font=font) / S


def has_alpha(fill):
    return isinstance(fill, tuple) and len(fill) == 4 and fill[3] < 255


def blend(img, fn):
    """알파가 있는 색은 ImageDraw가 합성하지 않으므로 별도 레이어에 그린 뒤 합성한다."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fn(ImageDraw.Draw(layer))
    img.alpha_composite(layer)


def draw_text(d, x, y, text, font, fill, anchor="l"):
    w = tw(d, text, font)
    if anchor == "m":
        x -= w / 2
    elif anchor == "r":
        x -= w
    if has_alpha(fill):
        blend(d._image, lambda dd: dd.text((x * S, y * S), text, font=font, fill=fill))
    else:
        d.text((x * S, y * S), text, font=font, fill=fill)
    return w


def wrap(d, text, font, maxw):
    lines = []
    for para in text.split("\n"):
        cur = ""
        for tok in para.split(" "):
            trial = (cur + " " + tok).strip()
            if tw(d, trial, font) <= maxw:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = tok
        lines.append(cur)
    return lines


def paragraph(d, x, y, text, font, fill, maxw, lh, anchor="l"):
    for line in wrap(d, text, font, maxw):
        draw_text(d, x, y, line, font, fill, anchor)
        y += lh
    return y


def gradient_text(img, x, y, text, size, c1, c2, anchor="l"):
    font = F(size, "bold")
    d = ImageDraw.Draw(img)
    w = tw(d, text, font)
    if anchor == "m":
        x -= w / 2
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).text((x * S, y * S), text, font=font, fill=255)
    g = gradient(img.width, img.height, c1, c2).convert("RGBA")
    img.paste(g, (0, 0), mask)
    return w


def rrect(img, box, r, fill, outline=None, width=0, shadow=None):
    x0, y0, x1, y1 = [int(v * S) for v in box]
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        dy, blur, col = shadow
        ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + dy * S, x1, y1 + dy * S), radius=r * S, fill=col)
        sh = sh.filter(ImageFilter.GaussianBlur(blur * S))
        img.alpha_composite(sh)
    blend(img, lambda dd: dd.rounded_rectangle((x0, y0, x1, y1), radius=r * S, fill=fill, outline=outline,
                                               width=int(width * S)))


def pill(img, x, y, text, size, fill, color, padx=34, pady=16, weight="semi", outline=None):
    d = ImageDraw.Draw(img)
    font = F(size, weight)
    w = tw(d, text, font)
    h = size * 1.0 + pady * 2
    rrect(img, (x, y, x + w + padx * 2, y + h), h / 2, fill, outline=outline, width=2 if outline else 0)
    d = ImageDraw.Draw(img)
    draw_text(d, x + padx, y + pady - size * 0.02, text, font, color)
    return w + padx * 2, h


def bubble(img, cx, cy, r, c1, c2, label=None, label_size=None, alpha=255, glass=False, lock=False):
    """glossy bubble. glass=True 면 반투명 유리 느낌(그라디언트 배경 위용)."""
    size = int(2 * r * S)
    pad = int(r * S * 0.6)
    layer = Image.new("RGBA", (size + pad * 2, size + pad * 2), (0, 0, 0, 0))
    # soft shadow / glow
    glow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((pad, pad + int(r * S * 0.12), pad + size, pad + size + int(r * S * 0.12)),
                                 fill=(40, 0, 80, 70 if not glass else 40))
    glow = glow.filter(ImageFilter.GaussianBlur(r * S * 0.18))
    layer.alpha_composite(glow)
    body = gradient(size, size, c1, c2).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=alpha if not glass else 70)
    body.putalpha(mask)
    layer.alpha_composite(body, (pad, pad))
    d = ImageDraw.Draw(layer)
    if glass:
        d.ellipse((pad, pad, pad + size - 1, pad + size - 1), outline=(255, 255, 255, 170), width=max(2, int(r * S * 0.03)))
    # inner light + highlight
    hl = Image.new("RGBA", layer.size, (255, 255, 255, 0))
    hd = ImageDraw.Draw(hl)
    hd.ellipse((pad + size * 0.17, pad + size * 0.10, pad + size * 0.55, pad + size * 0.30), fill=(255, 255, 255, 120))
    hl = hl.filter(ImageFilter.GaussianBlur(r * S * 0.05))
    layer.alpha_composite(hl)
    rim = Image.new("RGBA", layer.size, (255, 255, 255, 0))
    ImageDraw.Draw(rim).ellipse((pad + size * 0.08, pad + size * 0.08, pad + size * 0.92, pad + size * 0.92),
                                outline=(255, 255, 255, 38), width=max(2, int(r * S * 0.06)))
    rim = rim.filter(ImageFilter.GaussianBlur(r * S * 0.04))
    layer.alpha_composite(rim)
    img.alpha_composite(layer, (int(cx * S - layer.width / 2), int(cy * S - layer.height / 2)))
    d = ImageDraw.Draw(img)
    if label:
        fs = label_size or r * 0.42
        font = F(fs, "bold")
        w = tw(d, label, font)
        draw_text(d, cx - w / 2, cy - fs * 0.62, label, font, (255, 255, 255))
    if lock:
        draw_lock(img, cx, cy, r * 0.5)


def draw_lock(img, cx, cy, s, color=(255, 255, 255)):
    d = ImageDraw.Draw(img)
    bw, bh = s * 1.1, s * 0.85
    d.rounded_rectangle(((cx - bw / 2) * S, (cy - bh * 0.1) * S, (cx + bw / 2) * S, (cy + bh * 0.9) * S),
                        radius=s * 0.18 * S, fill=color)
    d.arc(((cx - bw * 0.32) * S, (cy - bh * 0.9) * S, (cx + bw * 0.32) * S, (cy + bh * 0.3) * S), 180, 360,
          fill=color, width=int(s * 0.16 * S))
    d.ellipse(((cx - s * 0.08) * S, (cy + s * 0.18) * S, (cx + s * 0.08) * S, (cy + s * 0.34) * S), fill=(120, 60, 200))


def check_icon(img, cx, cy, r, fill, color):
    d = ImageDraw.Draw(img)
    d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=fill)
    pts = [(cx - r * 0.42, cy + r * 0.02), (cx - r * 0.1, cy + r * 0.34), (cx + r * 0.46, cy - r * 0.32)]
    d.line([(x * S, y * S) for x, y in pts], fill=color, width=int(r * 0.2 * S), joint="curve")


LOGO = Image.open(os.path.join(ROOT, "apps/web/public/bubblebreak-logo.png")).convert("RGBA")


def logo_img(h):
    im = LOGO.copy()
    im.thumbnail((int(h * S), int(h * S)))
    return im


def chrome(img, idx, theme):
    d = ImageDraw.Draw(img)
    fg = INK if theme == "light" else (255, 255, 255)
    sub = (120, 100, 160) if theme == "light" else (255, 255, 255, 170)
    lg = logo_img(46)
    if theme == "grad" or theme == "dark":
        # 로고를 흰색 실루엣으로
        alpha = lg.split()[3]
        white = Image.new("RGBA", lg.size, (255, 255, 255, 255))
        white.putalpha(alpha)
        lg = white
    img.alpha_composite(lg, (88 * S, 70 * S))
    draw_text(d, 88 + 46 + 14, 76, "BubbleBreak", F(30, "bold"), fg)
    draw_text(d, W - 88, 80, f"{idx:02d} / {TOTAL:02d}", F(26, "semi"), sub, "r")
    # progress dots
    n = TOTAL
    gap, dot, cur_w = 16, 10, 34
    total_w = (n - 1) * (dot + gap) + cur_w
    x = (W - total_w) / 2
    for i in range(1, n + 1):
        on = i == idx
        w_ = cur_w if on else dot
        col = fg if on else ((190, 170, 220) if theme == "light" else (255, 255, 255, 90))
        blend(img, lambda dd, x=x, w_=w_, col=col: dd.rounded_rectangle(
            (x * S, 1272 * S, (x + w_) * S, (1272 + dot) * S), radius=dot / 2 * S, fill=col))
        x += w_ + gap
    if idx < n:
        draw_text(d, W - 88, 1262, "넘겨서 보기  →", F(26, "semi"), sub, "r")


def finish(img, name):
    out = img.convert("RGB").resize((W, H), Image.LANCZOS)
    path = os.path.join(HERE, name)
    out.save(path, optimize=True)
    return out


def eyebrow(img, x, y, text, theme):
    if theme == "light":
        return pill(img, x, y, text, 28, (243, 232, 255), (126, 34, 206), padx=26, pady=12)
    return pill(img, x, y, text, 28, (255, 255, 255, 40), (255, 255, 255), padx=26, pady=12,
                outline=(255, 255, 255, 120))


def shot(code, crop):
    path = glob.glob(os.path.join(SHOT_DIR, f"screenshot-*-{code}.jpg"))[0]
    return Image.open(path).convert("RGB").crop(crop)


def phone(img, x, y, w, im):
    h = int(w * im.height / im.width)
    bezel = 7
    rrect(img, (x, y, x + w, y + h), 38, (28, 16, 56), shadow=(18, 22, (70, 20, 140, 90)))
    inner = im.resize((int((w - bezel * 2) * S), int((h - bezel * 2) * S)), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", inner.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner.width - 1, inner.height - 1), radius=32 * S, fill=255)
    img.paste(inner, (int((x + bezel) * S), int((y + bezel) * S)), mask)
    return h


# ---------------------------------------------------------------- cards
def card1():
    img = new_canvas("grad")
    d = ImageDraw.Draw(img)
    # ambient bubbles (behind text)
    for cx, cy, r, lab in [(880, 585, 112, "야구"), (170, 1010, 125, "LCK"), (560, 1100, 105, "러닝"),
                           (905, 1065, 150, "게임"), (395, 905, 68, "맛집"), (1000, 300, 60, None)]:
        bubble(img, cx, cy, r, (255, 255, 255), (255, 255, 255), label=lab, glass=True)
    d = ImageDraw.Draw(img)
    eyebrow(img, 88, 190, "낯가림 많은 사람을 위한", "grad")
    d = ImageDraw.Draw(img)
    y = 290
    for line in ["아이스브레이킹,", "왜 이렇게", "어려울까?"]:
        draw_text(d, 88, y, line, F(124, "bold"), (255, 255, 255))
        y += 150
    draw_text(d, 88, 770, "겹치는 관심사 하나면 끝나는데", F(44, "med"), (255, 240, 250))
    chrome(img, 1, "grad")
    return finish(img, "card_01_cover.png")


def card2():
    img = new_canvas("dark")
    bubble(img, 960, 1010, 210, VIOLET, HOT, alpha=70)
    bubble(img, 880, 220, 90, PURPLE, PINK, alpha=60)
    d = ImageDraw.Draw(img)
    eyebrow(img, 88, 190, "만든 이유", "dark")
    d = ImageDraw.Draw(img)
    y = 300
    for line in ["동아리 · 학회", "10번 넘게 다니며"]:
        draw_text(d, 88, y, line, F(92, "bold"), (255, 255, 255))
        y += 118
    gradient_text(img, 88, y, "알게 된 것", 92, (196, 148, 255), (255, 150, 200))
    d = ImageDraw.Draw(img)
    draw_text(d, 88, 700, "“", F(160, "bold"), (255, 255, 255, 60))
    paragraph(d, 88, 790, "처음 보는 사람들 앞에서 하는 아이스브레이킹은 늘 어려웠어요.",
              F(42, "med"), (236, 226, 255), 760, 66)
    paragraph(d, 88, 960, "무슨 말을 할지가 아니라,\n뭐가 겹치는지를 모르는 게 문제였죠.",
              F(42, "bold"), (255, 255, 255), 760, 66)
    chrome(img, 2, "dark")
    return finish(img, "card_02_story.png")


def card3():
    img = new_canvas("light")
    bubble(img, 950, 230, 60, (192, 132, 252), (168, 85, 247))
    bubble(img, 900, 1030, 120, (244, 114, 182), (236, 72, 153))
    bubble(img, 1000, 790, 52, (192, 132, 252), (168, 85, 247))
    d = ImageDraw.Draw(img)
    eyebrow(img, 88, 190, "발견", "light")
    d = ImageDraw.Draw(img)
    draw_text(d, 88, 290, "겹치는 관심사 하나면", F(80, "bold"), INK)
    gradient_text(img, 88, 392, "말이 술술 풀려요", 80, VIOLET, HOT)
    chips = [("같은 야구팀", PURPLE, VIOLET), ("같은 LCK 팀", PINK, HOT),
             ("같은 운동 취미", PINK, HOT), ("같은 게임", PURPLE, VIOLET)]
    positions = [(88, 560), (430, 560), (88, 720), (500, 720)]
    # 두 줄 배치: 폭을 측정해서 이어 붙인다
    d = ImageDraw.Draw(img)
    f = F(46, "bold")
    rows = [[0, 1], [2, 3]]
    y = 570
    for row in rows:
        x = 88
        for i in row:
            label, c1, c2 = chips[i]
            w = tw(d, label, f) + 80
            h = 108
            g = gradient(int(w * S), int(h * S), c1, c2).convert("RGBA")
            m = Image.new("L", g.size, 0)
            ImageDraw.Draw(m).rounded_rectangle((0, 0, g.width - 1, g.height - 1), radius=h / 2 * S, fill=255)
            sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
            ImageDraw.Draw(sh).rounded_rectangle((x * S, (y + 12) * S, (x + w) * S, (y + 12 + h) * S), radius=h / 2 * S,
                                                 fill=(124, 58, 237, 60))
            img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14 * S)))
            img.paste(g, (int(x * S), int(y * S)), m)
            d = ImageDraw.Draw(img)
            draw_text(d, x + 40, y + 26, label, f, (255, 255, 255))
            x += w + 24
        y += 148
    d.line((88 * S, 900 * S, (W - 88) * S, 900 * S), fill=(220, 200, 245), width=2 * S)
    draw_text(d, 88, 950, "문제는,", F(40, "med"), (110, 90, 150))
    draw_text(d, 88, 1010, "그 접점을 찾는 데", F(52, "bold"), INK)
    w = draw_text(d, 88, 1076, "한 시간", F(52, "bold"), HOT)
    draw_text(d, 88 + w + 8, 1076, "이 걸린다는 것.", F(52, "bold"), INK)
    chrome(img, 3, "light")
    return finish(img, "card_03_insight.png")


def card4():
    img = new_canvas("grad")
    for cx, cy, r, lab in [(95, 640, 70, None), (975, 330, 105, None), (950, 1100, 90, None), (130, 1090, 105, None)]:
        bubble(img, cx, cy, r, (255, 255, 255), (255, 255, 255), glass=True)
    d = ImageDraw.Draw(img)
    eyebrow(img, 88, 190, "그래서 만들었어요", "grad")
    # big logo in a white circle
    r = 150
    bubble(img, W / 2, 470, r + 40, (255, 255, 255), (250, 235, 255), alpha=255)
    lg = logo_img(2 * r * 0.95)
    img.alpha_composite(lg, (int(W / 2 * S - lg.width / 2), int(470 * S - lg.height / 2)))
    d = ImageDraw.Draw(img)
    draw_text(d, W / 2, 700, "BubbleBreak", F(132, "bold"), (255, 255, 255), "m")
    draw_text(d, W / 2, 870, "관심사를 버블로 띄우고,", F(48, "med"), (255, 240, 250), "m")
    draw_text(d, W / 2, 940, "같은 걸 찾는 아이스브레이킹 게임", F(48, "bold"), (255, 255, 255), "m")
    pw = tw(d, "웹에서 바로 · 가입 없이", F(34, "semi")) + 80
    pill(img, W / 2 - pw / 2, 1070, "웹에서 바로 · 가입 없이", 34, (255, 255, 255), (126, 34, 206), padx=40, pady=20)
    chrome(img, 4, "grad")
    return finish(img, "card_04_intro.png")


def card5():
    img = new_canvas("light")
    d = ImageDraw.Draw(img)
    eyebrow(img, 88, 190, "3단계 관심사", "light")
    d = ImageDraw.Draw(img)
    draw_text(d, 88, 285, "공개 수위는", F(80, "bold"), INK)
    gradient_text(img, 88, 385, "내가 정해요", 80, VIOLET, HOT)
    rows = [
        ("가볍게", "처음 만나도 편한 주제", "게임 · 운동 · 맛집", (192, 132, 252), (168, 85, 247), False),
        ("조금 더", "취향이 드러나는 주제", "러닝 · 보드게임 · 여행", (244, 114, 182), (236, 72, 153), False),
        ("비밀 취향", "허락받고 열어볼 주제", "덕질 · 혼술 · 흑역사", (168, 85, 247), (219, 39, 119), True),
    ]
    y = 560
    for title, desc, ex, c1, c2, lock in rows:
        rrect(img, (88, y, W - 88, y + 192), 40, (255, 255, 255), shadow=(10, 18, (124, 58, 237, 36)))
        bubble(img, 88 + 24 + 66, y + 96, 66, c1, c2, lock=lock)
        d = ImageDraw.Draw(img)
        draw_text(d, 88 + 24 + 132 + 28, y + 28, title, F(46, "bold"), INK)
        draw_text(d, 88 + 24 + 132 + 28, y + 90, desc, F(32, "med"), (90, 70, 130))
        draw_text(d, 88 + 24 + 132 + 28, y + 136, ex, F(28, "semi"), (150, 120, 200))
        y += 192 + 26
    chrome(img, 5, "light")
    return finish(img, "card_05_depth.png")


def card6():
    img = new_canvas("dark")
    bubble(img, 930, 1040, 190, PURPLE, HOT, alpha=80)
    bubble(img, 900, 250, 110, (168, 85, 247), (219, 39, 119), lock=True)
    d = ImageDraw.Draw(img)
    eyebrow(img, 88, 190, "진짜 이야기", "dark")
    d = ImageDraw.Draw(img)
    y = 290
    for line in ["남들이 보면 좀", "덕후 같은 취미,"]:
        draw_text(d, 88, y, line, F(84, "bold"), (255, 255, 255))
        y += 108
    gradient_text(img, 88, y, "있잖아요", 84, (196, 148, 255), (255, 150, 200))
    d = ImageDraw.Draw(img)
    d.line((88 * S, 650 * S, 188 * S, 650 * S), fill=(255, 255, 255, 90), width=3 * S)
    paragraph(d, 88, 700, "저는 ‘픽셀 네트워크’ 유튜브를\n보는 걸 좋아해요.", F(42, "med"), (236, 226, 255), 800, 64)
    draw_text(d, 88, 880, "그런데 같이 보는 사람을", F(52, "bold"), (255, 255, 255))
    draw_text(d, 88, 950, "찾는 순간,", F(52, "bold"), (255, 255, 255))
    gradient_text(img, 88, 1020, "그 사람은 베프예요.", 76, (255, 190, 230), (196, 148, 255))
    chrome(img, 6, "dark")
    return finish(img, "card_06_secret.png")


def card7():
    img = new_canvas("light")
    d = ImageDraw.Draw(img)
    eyebrow(img, 88, 190, "사용법", "light")
    d = ImageDraw.Draw(img)
    draw_text(d, 88, 285, "초대 링크 하나로", F(80, "bold"), INK)
    gradient_text(img, 88, 385, "바로 시작해요", 80, VIOLET, HOT)
    shots = [shot("17", (525, 0, 916, 696)), shot("11", (540, 0, 931, 696)), shot("16", (525, 0, 916, 696))]
    labels = ["초대 링크로 입장", "버블을 눌러 확인", "나와 같은 관심사만"]
    pw, gap = 270, 47
    y = 560
    for i, (im, lab) in enumerate(zip(shots, labels)):
        x = 88 + i * (pw + gap)
        h = phone(img, x, y, pw, im)
        d = ImageDraw.Draw(img)
        cx = x + pw / 2
        d.ellipse(((cx - 24) * S, (y + h + 28) * S, (cx + 24) * S, (y + h + 76) * S), fill=VIOLET)
        draw_text(d, cx, y + h + 36, str(i + 1), F(28, "bold"), (255, 255, 255), "m")
        draw_text(d, cx, y + h + 92, lab, F(29, "bold"), INK, "m")
    chrome(img, 7, "light")
    return finish(img, "card_07_how.png")


def card8():
    img = new_canvas("grad")
    for cx, cy, r in [(960, 250, 120), (975, 1130, 85), (70, 1235, 62)]:
        bubble(img, cx, cy, r, (255, 255, 255), (255, 255, 255), glass=True)
    d = ImageDraw.Draw(img)
    eyebrow(img, 88, 190, "지금 바로", "grad")
    d = ImageDraw.Draw(img)
    draw_text(d, 88, 290, "다음 모임엔,", F(100, "bold"), (255, 255, 255))
    draw_text(d, 88, 410, "버블부터 띄워요", F(100, "bold"), (255, 255, 255))
    y = 600
    for t in ["가입 없이, 웹에서 바로", "초대 링크 하나로 최대 6명", "마지막엔 나와 같은 관심사만 확인"]:
        check_icon(img, 88 + 28, y + 32, 28, (255, 255, 255), HOT)
        d = ImageDraw.Draw(img)
        draw_text(d, 88 + 76, y + 6, t, F(42, "semi"), (255, 255, 255))
        y += 96
    url = "bubblebreak-demo.jinung344.workers.dev"
    uw = tw(d, url, F(34, "bold")) + 100
    pill(img, 88, 960, url, 34, (255, 255, 255), (126, 34, 206), padx=50, pady=26, weight="bold")
    d = ImageDraw.Draw(img)
    draw_text(d, 88, 1100, "저장해두고, 다음 MT · 동아리에서 써보세요", F(32, "med"), (255, 240, 250))
    chrome(img, 8, "grad")
    return finish(img, "card_08_cta.png")


if __name__ == "__main__":
    outs = [f() for f in (card1, card2, card3, card4, card5, card6, card7, card8)]
    outs[0].save(os.path.join(HERE, "cardnews.pdf"), save_all=True, append_images=outs[1:], resolution=150)
    print("done", len(outs))
