#!/usr/bin/env python3
"""Give every storefront card a real gameplay capture (assets/thumbs/<page>.jpg,
made by a headless run of the game itself) and move the favourite star and
featured badge off the title row. Idempotent; run from the repo root."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = """
/* card art: real captures of each game (assets/thumbs), 2026-10-05 */
.game-card { padding-top: 0 !important; }
.game-card .card-shot { display: block; width: calc(100% + 32px); height: auto; margin: 0 -16px 12px; aspect-ratio: 16 / 9; object-fit: cover; background: #0b0c12; border-bottom: 1px solid var(--border); }
.game-card .badge-featured { top: 10px; right: auto; left: 10px; }
.game-card .fav-star { top: 10px; right: 10px; background: rgba(0,0,0,.6); }
@media (hover: hover) { .game-card:hover .card-shot { filter: saturate(1.15) brightness(1.06); } }
"""
def process(name):
    p = os.path.join(ROOT, name)
    s = open(p, encoding='utf-8', errors='surrogateescape').read()
    orig = s
    def card(m):
        href = m.group(1)
        thumb = href.replace('.html', '.jpg')
        if not os.path.exists(os.path.join(ROOT, 'assets', 'thumbs', thumb)):
            return m.group(0)
        return m.group(0) + '\n                        <img class="card-shot" src="/assets/thumbs/%s" alt="" loading="lazy" width="800" height="450">' % thumb
    # only cards that do not already carry a shot
    s = re.sub(r'<a href="([a-z0-9_]+\.html)" class="game-card"[^>]*>(?!\s*<img class="card-shot")', card, s)
    if '/* card art:' not in s:
        s = s.replace('</style>', CSS + '</style>', 1)
    if s != orig:
        open(p, 'w', encoding='utf-8', errors='surrogateescape').write(s)
    return s.count('class="card-shot"')

if __name__ == '__main__':
    for n in ('index.html', 'portal.html'):
        print(n, 'cards with shots:', process(n))
