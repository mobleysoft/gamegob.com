#!/usr/bin/env python3
"""mobilize.py — apply the GameGob mobile pass to every game page (2026-10-04).

Idempotent, mechanical, reviewable. For each *.html at the repo root (except
og-image.html, a social-card template):
  1. viewport meta gains viewport-fit=cover (keeps the page's own flags).
  2. <head> gets /assets/gg-mobile.css and /assets/gg-mobile.js (synchronous,
     before any game script, so the rAF/Audio patches are in place first).
  3. The static AdSense <script> becomes a loader that skips inside a native
     shell (Capacitor / standalone), where web display ads are not permitted.
  4. Keyboard-only games get <html data-gg-keypad="..."> so gg-mobile.js
     mounts an on-screen keypad on touch devices.
  5. Pages carrying more than 200 KB of base64 PNG get those images written
     to assets/inline/<page>/<sha1>.png and referenced by path instead.
Run from the repo root. Prints a per-file change summary; nothing else.
"""
import hashlib, os, re, sys, base64

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = '2026100524'
SKIP = {'og-image.html'}
KEYPAD = {
    'photonic_forge_breakout.html': 'arrows space',
    'forge_word_cascade.html': 'enter space',
    'genesis.html': 'enter',
}
# 6. Pages that are not games (portal, catalogues, tools) keep the estate nav
#    bar; every other page gets <html data-gg-game> so gg-mobile.css can hide
#    that bar on phones and lift modals above the shared touch pad.
NOT_GAMES = {'index.html', 'portal.html', 'games.html', 'shop.html', 'status.html', 'beings.html',
             'beings_api_index.html', 'spritevae_viz.html', 'atlas_parser.html'}
# 7. Fixed-size canvas games (no scaling code of their own) get
#    <html data-gg-fit="selector [WxH]">; gg-mobile.js scales that element to
#    the viewport. Measured 2026-10-04: these clipped 18-34% of the play
#    field on an iPhone 13 in one or both orientations.
FIT = {
    'auto_battler.html': '#gameCanvas',
    'battle_royale.html': '#c',
    'bullet_hell.html': '#wrapper 660x640',   # 480x640 canvas + 180px sidebar hung off its right
    'fps.html': '#wrapper 640x400',           # game + overlay canvases stacked in the wrapper
    'platformer.html': '#gameCanvas',
    'smash_arena.html': '#c',
}
# 11. Landscape-built games (logical canvas aspect >= 1.3, measured 2026-10-05
#     on a portrait iPhone 13 at 17-44% screen fill) get <html data-gg-landscape>
#     so gg-mobile.js can ask for a sideways phone before play.
LANDSCAPE = {
    'survivors.html', 'fps.html', 'platformer.html', 'smash_arena.html', 'battle_royale.html',
    'racer.html', 'forge_fighting.html', 'forge_rpg.html',
}
GG_ASSET_RE = re.compile(r'(/assets/gg-mobile\.(?:css|js)\?v=)\d+')
ADS_RE = re.compile(r'<script[^>]*src="(https://pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js[^"]*)"[^>]*>\s*</script>', re.I)
VIEWPORT_RE = re.compile(r'(<meta[^>]+name=["\']viewport["\'][^>]*content=["\'])([^"\']+)(["\'])', re.I)
DATA_PNG_RE = re.compile(r'data:image/png;base64,([A-Za-z0-9+/=]+)')
HEAD_TAG = '<link rel="stylesheet" href="/assets/gg-mobile.css?v=%s">\n<script src="/assets/gg-mobile.js?v=%s"></script>\n' % (VERSION, VERSION)
ADS_LOADER = ('<script>/* gg: web display ads only on the web, never inside a native shell */'
              'if(!(window.Capacitor||navigator.standalone||(window.matchMedia&&matchMedia("(display-mode: standalone)").matches))){'
              'var ggAd=document.createElement("script");ggAd.async=true;ggAd.crossOrigin="anonymous";ggAd.src="%s";document.head.appendChild(ggAd);}</script>')

def externalize(name, s):
    stem = name[:-5]
    outdir = os.path.join(ROOT, 'assets', 'inline', stem)
    count = 0
    def repl(m):
        nonlocal count
        b64 = m.group(1)
        try:
            raw = base64.b64decode(b64, validate=False)
        except Exception:
            return m.group(0)
        h = hashlib.sha1(raw).hexdigest()[:16]
        os.makedirs(outdir, exist_ok=True)
        path = os.path.join(outdir, h + '.png')
        if not os.path.exists(path):
            with open(path, 'wb') as fh: fh.write(raw)
        count += 1
        return '/assets/inline/%s/%s.png' % (stem, h)
    s2 = DATA_PNG_RE.sub(repl, s)
    return s2, count

def mobilize(name):
    path = os.path.join(ROOT, name)
    s = open(path, encoding='utf-8', errors='surrogateescape').read()
    orig = s
    notes = []
    # 1. viewport
    def vp(m):
        content = m.group(2)
        if 'viewport-fit' not in content:
            content = content.rstrip(', ') + ', viewport-fit=cover'
            notes.append('viewport-fit')
        return m.group(1) + content + m.group(3)
    s = VIEWPORT_RE.sub(vp, s, count=1)
    # 2. runtime (and keep its cache-busting version current)
    if 'gg-mobile.js' not in s and '</head>' in s:
        s = s.replace('</head>', HEAD_TAG + '</head>', 1)
        notes.append('runtime')
    s, nv = GG_ASSET_RE.subn(lambda m: m.group(1) + VERSION, s)
    if nv and s != orig and 'runtime' not in notes and GG_ASSET_RE.sub(lambda m: m.group(1) + VERSION, orig) != orig:
        notes.append('runtime v' + VERSION)
    # 6. game marker
    if name not in NOT_GAMES and 'data-gg-game' not in s:
        s = re.sub(r'<html(\s[^>]*)?>', lambda m: '<html' + (m.group(1) or '') + ' data-gg-game', s, count=1)
        notes.append('game')
    # 8. storefront pages: the runtime is not render-critical there (no canvas
    #    font hook to install before game scripts), so defer it (Lighthouse:
    #    550 ms render-blocking on index.html)
    if name in NOT_GAMES and '<script src="/assets/gg-mobile.js' in s:
        s = s.replace('<script src="/assets/gg-mobile.js', '<script defer src="/assets/gg-mobile.js', 1)
        notes.append('defer runtime')
    # 9. game pages: a meta description from the title (SEO audit on every game)
    if name not in NOT_GAMES and not re.search(r'<meta[^>]+name=["\']description["\']', s, re.I):
        tm = re.search(r'<title>([^<]{3,80})</title>', s)
        if tm:
            desc = 'Play %s free in your browser on GameGob. Works on phones, no install.' % re.sub(r'\s+', ' ', tm.group(1)).strip().replace('"', '')
            s = s.replace('</head>', '<meta name="description" content="%s">\n</head>' % desc, 1)
            notes.append('meta description')
    # 7. fit
    if name in FIT and 'data-gg-fit' not in s:
        s = re.sub(r'<html(\s[^>]*)?>', lambda m: '<html' + (m.group(1) or '') + ' data-gg-fit="%s"' % FIT[name], s, count=1)
        notes.append('fit:' + FIT[name])
    # 3. ads
    def ads(m):
        notes.append('ads-gated')
        return ADS_LOADER % m.group(1)
    s = ADS_RE.sub(ads, s)
    # 4. keypad
    if name in LANDSCAPE and 'data-gg-landscape' not in s:
        s = re.sub(r'<html(\s[^>]*)?>', lambda m: '<html' + (m.group(1) or '') + ' data-gg-landscape', s, count=1)
    if name in KEYPAD and 'data-gg-keypad' not in s:
        s = re.sub(r'<html(\s[^>]*)?>', lambda m: '<html' + (m.group(1) or '') + ' data-gg-keypad="%s">' % KEYPAD[name], s, count=1)
        notes.append('keypad:' + KEYPAD[name])
    # 5. inline assets
    inline_kb = sum(len(b) for b in DATA_PNG_RE.findall(s)) // 1024
    if inline_kb > 200:
        s, n = externalize(name, s)
        notes.append('externalized %d png (%d KB)' % (n, inline_kb))
    if s != orig:
        open(path, 'w', encoding='utf-8', errors='surrogateescape').write(s)
    return notes

def main():
    names = sorted(f for f in os.listdir(ROOT) if f.endswith('.html') and f not in SKIP)
    changed = 0
    for n in names:
        notes = mobilize(n)
        if notes:
            changed += 1
            print('%-36s %s' % (n, ', '.join(notes)))
    print('changed %d of %d pages' % (changed, len(names)))

if __name__ == '__main__':
    main()
