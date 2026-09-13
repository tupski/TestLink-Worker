"""Generate ikon PWA TestLink dari sumber yang sama dengan icons/icon.svg.

Menghasilkan:
  icons/icon-192.png            (any)
  icons/icon-512.png            (any)
  icons/icon-maskable-512.png   (maskable, safe zone 40%)
  apple-touch-icon.png          (180x180, root agar /apple-touch-icon.png valid)

Jalankan: python scripts/make_icons.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')
os.makedirs(OUT, exist_ok=True)

TOP = (99, 102, 241)      # #6366f1
BOTTOM = (49, 46, 129)    # #312e81
SUPERSAMPLE = 4


def load_font(size):
    for path in (
        'C:/Windows/Fonts/segoeuib.ttf',   # Segoe UI Bold
        'C:/Windows/Fonts/arialbd.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def render(size, maskable=False):
    """Render 'TL' di atas gradien indigo. maskable=True menyisakan safe zone."""
    px = size * SUPERSAMPLE
    img = Image.new('RGB', (px, px), TOP)
    d = ImageDraw.Draw(img)

    # Gradien diagonal
    for y in range(px):
        for_t = y / max(1, px - 1)
        r = int(TOP[0] + (BOTTOM[0] - TOP[0]) * for_t)
        g = int(TOP[1] + (BOTTOM[1] - TOP[1]) * for_t)
        b = int(TOP[2] + (BOTTOM[2] - TOP[2]) * for_t)
        d.line([(0, y), (px, y)], fill=(r, g, b))

    # Teks: maskable pakai ukuran lebih kecil (safe zone), else penuh
    ratio = 0.42 if maskable else 0.56
    font = load_font(int(px * ratio))
    bbox = d.textbbox((0, 0), 'TL', font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((px - tw) / 2 - bbox[0], (px - th) / 2 - bbox[1]), 'TL', font=font, fill=(255, 255, 255))

    img = img.resize((size, size), Image.LANCZOS)

    if not maskable:
        # Sudut membulat pada versi "any" (maskable wajib penuh)
        radius = int(size * 0.22)
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img


def main():
    jobs = [
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('icon-maskable-512.png', 512, True),
    ]
    for name, size, maskable in jobs:
        path = os.path.join(OUT, name)
        render(size, maskable).save(path, 'PNG', optimize=True)
        print('wrote', path, os.path.getsize(path), 'bytes')

    apple = os.path.join(ROOT, 'apple-touch-icon.png')
    render(180, False).save(apple, 'PNG', optimize=True)
    print('wrote', apple, os.path.getsize(apple), 'bytes')


if __name__ == '__main__':
    main()
