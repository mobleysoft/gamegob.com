#!/usr/bin/env python3
"""Haven embedded the `_gan` sprite atlases (GAN output: 94% opaque noise) for
all 16 beings, so the village showed coloured static where the cast should be.
sprites/sprites/<being>.json holds the structured set (the same cast the other
games use). This rebuilds the inline `const spriteAtlases = {...}` from those
files. Idempotent; run from the repo root."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def coverage(atlases):
    tot = opaque = 0
    for a in atlases.values():
        for g in a['frames'].values():
            for row in g:
                for v in row:
                    tot += 1
                    if v: opaque += 1
    return opaque / max(1, tot)

def main():
    p = os.path.join(ROOT, 'haven.html')
    s = open(p, encoding='utf-8', errors='surrogateescape').read()
    m = re.search(r'const spriteAtlases = ', s)
    j = m.end(); depth = 0; k = j
    while True:
        c = s[k]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: break
        k += 1
    old = json.loads(s[j:k + 1])
    new = {}
    for cid in old:
        d = json.load(open(os.path.join(ROOT, 'sprites', 'sprites', cid + '.json')))
        new[cid] = {'palette': d['palette'], 'frames': d['frames']}
    blob = json.dumps(new, separators=(',', ':'))
    s = s[:j] + blob + s[k + 1:]
    open(p, 'w', encoding='utf-8', errors='surrogateescape').write(s)
    print('replaced %d atlases; opaque fraction %.2f -> %.2f; blob %d -> %d bytes' % (len(new), coverage(old), coverage(new), k + 1 - j, len(blob)))

if __name__ == '__main__':
    main()
