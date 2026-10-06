#!/usr/bin/env python3
"""Card previews for the six flagships from real captured frames (2026-10-05).

Each entry names a capture (a full-viewport PNG from the headless harness), the canvas box
inside it, and how to fit it to the 16:9 card: "crop" takes a centred 16:9 window of the
canvas (good when the canvas is wider than tall), "pillar" sets a portrait canvas on a
blurred, darkened copy of itself (good for vertical shooters). Output: assets/thumbs/<page>.webp
at 800x450, quality 82. Usage: flagship_thumbs.py spec.json
"""
import json
import os
import sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_W, OUT_H = 800, 450


def fit_crop(canvas):
    w, h = canvas.size
    target = OUT_W / OUT_H
    if w / h > target:
        nw = int(h * target)
        x = (w - nw) // 2
        box = (x, 0, x + nw, h)
    else:
        nh = int(w / target)
        y = (h - nh) // 2
        box = (0, y, w, y + nh)
    return canvas.crop(box).resize((OUT_W, OUT_H), Image.LANCZOS)


def fit_pillar(canvas):
    bg = canvas.copy().resize((OUT_W, OUT_H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(18))
    bg = Image.eval(bg, lambda v: int(v * 0.45))
    w, h = canvas.size
    scale = OUT_H / h
    nw = max(1, int(w * scale))
    fg = canvas.resize((nw, OUT_H), Image.LANCZOS)
    bg.paste(fg, ((OUT_W - nw) // 2, 0))
    return bg


def main(spec_path):
    spec = json.load(open(spec_path))
    for page, e in spec.items():
        im = Image.open(e['file']).convert('RGB')
        b = e.get('box')
        if b:
            im = im.crop((int(b['x']), int(b['y']), int(b['x'] + b['w']), int(b['y'] + b['h'])))
        if e.get('zoom'):
            # take the central fraction of the frame first (title screens with lots of empty black)
            z = float(e['zoom'])
            w, h = im.size
            im = im.crop((int(w * (1 - z) / 2), int(h * (1 - z) / 2), int(w * (1 + z) / 2), int(h * (1 + z) / 2)))
        out = fit_pillar(im) if e.get('fit') == 'pillar' else fit_crop(im)
        dest = os.path.join(ROOT, 'assets', 'thumbs', page + '.webp')
        out.save(dest, 'WEBP', quality=82, method=6)
        print('%-18s <- %s  %dx%d -> %s (%d KiB)' % (page, os.path.basename(e['file']), im.size[0], im.size[1], e.get('fit', 'crop'), os.path.getsize(dest) // 1024))


if __name__ == '__main__':
    main(sys.argv[1])
