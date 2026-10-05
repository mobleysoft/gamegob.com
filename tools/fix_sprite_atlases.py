#!/usr/bin/env python3
"""Replace embedded `_gan` noise sprite atlases with the structured cast.

Eleven games embed a JSON object of 16 being atlases (haven: `const
spriteAtlases = {...}`, the other flagships: `const SPRITE_ATLASES = {...}`).
Every one of them carried the GAN output: 94% opaque noise, so in-game
characters rendered as coloured static. sprites/sprites/<being>.json is the
structured set (about 60% opaque, real figures). This rewrites each atlas's
palette + frames from those files and keeps any other per-atlas keys
(e.g. "character"). Idempotent; run from the repo root."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'sprites', 'sprites')
DECL = re.compile(r'(const|let|var)\s+(spriteAtlases|SPRITE_ATLASES)\s*=\s*')

def opaque(atlases):
    tot = op = 0
    for a in atlases.values():
        for g in a['frames'].values():
            for row in g:
                for v in row:
                    tot += 1; op += 1 if v else 0
    return op / max(1, tot)

def fix(name):
    p = os.path.join(ROOT, name)
    s = open(p, encoding='utf-8', errors='surrogateescape').read()
    m = DECL.search(s)
    if not m:
        return None
    j = m.end(); depth = 0; k = j
    while True:
        c = s[k]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: break
        k += 1
    old = json.loads(s[j:k + 1])
    before = opaque(old)
    if before < 0.75:
        return (before, before, 0)
    new = {}
    for cid, a in old.items():
        f = os.path.join(SRC, cid + '.json')
        if not os.path.exists(f):
            new[cid] = a; continue
        d = json.load(open(f))
        na = dict(a); na['palette'] = d['palette']; na['frames'] = d['frames']
        new[cid] = na
    blob = json.dumps(new, separators=(',', ':'))
    s = s[:j] + blob + s[k + 1:]
    open(p, 'w', encoding='utf-8', errors='surrogateescape').write(s)
    return (before, opaque(new), (k + 1 - j) - len(blob))

if __name__ == '__main__':
    names = sys.argv[1:] or sorted(f for f in os.listdir(ROOT) if f.endswith('.html'))
    for n in names:
        r = fix(n)
        if r: print('%-24s opaque %.2f -> %.2f, saved %d bytes' % (n, r[0], r[1], r[2]))
