#!/usr/bin/env python3
"""Shrink the externalized backgrounds (assets/inline/<page>/*.png) for phones.

The 2026-10-04 mobile pass moved base64 PNGs out of the pages into files; the
large ones are 1024x1024 painted backgrounds at ~1.6 MB each (survivors alone
ships 17 MB of them). Painted art with >100k colours compresses to about a
fifth as WebP q92 with no visible loss, so: every PNG over 150 KB becomes a
.webp next to it, the owning page's references are rewritten, and the PNG is
removed (git history keeps it). Idempotent; run from the repo root."""
import os, re
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INLINE = os.path.join(ROOT, 'assets', 'inline')
MIN = 150 * 1024

def main():
    total_before = total_after = 0
    for page in sorted(os.listdir(INLINE)):
        d = os.path.join(INLINE, page)
        html = os.path.join(ROOT, page + '.html')
        if not os.path.isdir(d) or not os.path.exists(html):
            continue
        s = open(html, encoding='utf-8', errors='surrogateescape').read()
        changed = False
        for f in sorted(os.listdir(d)):
            if not f.endswith('.png'):
                continue
            p = os.path.join(d, f)
            size = os.path.getsize(p)
            if size < MIN:
                continue
            im = Image.open(p)
            if im.mode not in ('RGB', 'RGBA'):
                im = im.convert('RGBA')
            out = p[:-4] + '.webp'
            im.save(out, 'WEBP', quality=92, method=6)
            ref = '/assets/inline/%s/%s' % (page, f)
            if ref in s:
                s = s.replace(ref, ref[:-4] + '.webp')
                changed = True
                os.remove(p)
                total_before += size; total_after += os.path.getsize(out)
                print('  %s/%s %.2f MB -> %.2f MB' % (page, f, size / 1e6, os.path.getsize(out) / 1e6))
            else:
                os.remove(out)
                print('  %s/%s not referenced by %s, left alone' % (page, f, page + '.html'))
        if changed:
            open(html, 'w', encoding='utf-8', errors='surrogateescape').write(s)
    print('total %.1f MB -> %.1f MB' % (total_before / 1e6, total_after / 1e6))

if __name__ == '__main__':
    main()
