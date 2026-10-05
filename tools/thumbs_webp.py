#!/usr/bin/env python3
"""Storefront card art as WebP.

assets/thumbs/<page>.jpg (55 real captures, ~1.3 MB) become .webp at q80
(Lighthouse: 212 KiB of the storefront's 387 KiB was these JPEGs); index.html
and portal.html card <img> tags are rewritten and the JPEGs removed (git
history keeps them). Idempotent; run from the repo root."""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TH = os.path.join(ROOT, 'assets', 'thumbs')

def main():
    before = after = 0
    for f in sorted(os.listdir(TH)):
        if not f.endswith('.jpg'):
            continue
        p = os.path.join(TH, f)
        im = Image.open(p).convert('RGB')
        out = p[:-4] + '.webp'
        im.save(out, 'WEBP', quality=80, method=6)
        before += os.path.getsize(p); after += os.path.getsize(out)
        os.remove(p)
    for page in ('index.html', 'portal.html'):
        pp = os.path.join(ROOT, page)
        s = open(pp, encoding='utf-8', errors='surrogateescape').read()
        t = s.replace('/assets/thumbs/', '/assets/thumbs/').replace('.jpg" alt="" loading="lazy"', '.webp" alt="" loading="lazy"')
        if t != s:
            open(pp, 'w', encoding='utf-8', errors='surrogateescape').write(t)
    print('thumbs %.0f KiB -> %.0f KiB' % (before / 1024, after / 1024))

if __name__ == '__main__':
    main()
