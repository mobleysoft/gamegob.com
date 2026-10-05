#!/usr/bin/env python3
"""Repair the 0.65-alpha corruption (2026-10-05).

Every page carried the same signature, in every on-disk copy and all git
history: 996 rgba() colours whose alpha is exactly ' 0.65' (with a space),
against ~170 for the next most common alpha. Grid lines, ghost pieces,
hint-card backgrounds, pad fills, borders and glows all sat at 0.65, which
is why light panels rendered as opaque grey slabs. Some earlier bulk
"contrast" pass clearly clamped every low alpha up to 0.65.

The originals are gone, so this restores sane values by what the colour is
used for. Dark colours (overlays like rgba(0,0,0, 0.65)) are plausible at
0.65 and are left alone. Light colours are mapped by the property they
style; unknown contexts are left unchanged. Idempotent (nothing is left at
the ' 0.65)' signature once applied, except the dark/unknown cases).
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAT = re.compile(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*, 0\.65\)')
FILL = 0.14     # backgrounds, canvas fills, gradient stops
LINE = 0.32     # borders, strokes, dividers
GLOW = 0.38     # box/text shadows, card glows
FAINT = 0.08    # grid lines
GHOST = 0.28    # ghost pieces, empty slots
MAP = [
    (re.compile(r'^(gridline|gridborder)$'), FAINT),
    (re.compile(r'^(ghost|slotempty|slotfill|hpbg|bgcolor)$'), GHOST),
    (re.compile(r'(shadow|glow)'), GLOW),
    (re.compile(r'(border|stroke|outline|panelborder|divider)'), LINE),
    (re.compile(r'(background|^bg$|fillstyle|fill$|gradient|cloud|ground|overlay|tint)'), FILL),
]
def prop_before(s, i):
    before = s[max(0, i - 80):i]
    m = re.findall(r'([A-Za-z_-]+)\s*[:=]\s*[^;:={}]*$', before)
    if m: return m[-1].lower()
    if 'gradient(' in before: return 'gradient'
    return '?'
def repair(name):
    p = os.path.join(ROOT, name)
    s = open(p, encoding='utf-8', errors='surrogateescape').read()
    counts = {}
    def sub(m):
        r, g, b = map(int, m.groups())
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        if lum < 60: counts['dark-kept'] = counts.get('dark-kept', 0) + 1; return m.group(0)
        prop = prop_before(s, m.start())
        for rx, a in MAP:
            if rx.search(prop):
                counts[prop] = counts.get(prop, 0) + 1
                return 'rgba(%d,%d,%d,%s)' % (r, g, b, a)
        counts['unknown-kept:' + prop] = counts.get('unknown-kept:' + prop, 0) + 1
        return m.group(0)
    s2 = PAT.sub(sub, s)
    if s2 != s: open(p, 'w', encoding='utf-8', errors='surrogateescape').write(s2)
    return counts
if __name__ == '__main__':
    total = {}
    names = sorted(f for f in os.listdir(ROOT) if f.endswith('.html') and f != 'og-image.html')
    for n in names:
        c = repair(n)
        for k, v in c.items(): total[k] = total.get(k, 0) + v
    changed = sum(v for k, v in total.items() if not k.endswith('kept') and not k.startswith('unknown'))
    print('repaired', changed, '| kept dark', total.get('dark-kept', 0), '| kept unknown', sum(v for k, v in total.items() if k.startswith('unknown')))
    for k, v in sorted(total.items(), key=lambda x: -x[1])[:20]: print('  %4d %s' % (v, k))
