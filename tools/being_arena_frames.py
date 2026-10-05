#!/usr/bin/env python3
"""being_arena loads sprites/<being>_frame_00..15.png for every fighter, but no
such files were ever shipped (loadImage resolved null, so fights drew nothing
for the cast). Render them from the structured sprite atlases in
sprites/sprites/<being>.json (16x24, 16-colour palette), 4x nearest-neighbour.

Frame layout the game expects (see drawBeing): 0-3 idle, 4-7 walk,
8-11 attack, 12-15 special. Fighters face right by default; the game flips."""
import json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'sprites', 'sprites')
OUT = os.path.join(ROOT, 'sprites')
SCALE = 4
LAYOUT = ['south_idle', 'south_walk_0', 'south_idle', 'south_walk_2',
          'east_walk_0', 'east_walk_1', 'east_walk_2', 'east_walk_3',
          'east_walk_1', 'east_idle', 'east_walk_3', 'east_idle',
          'north_walk_0', 'north_walk_1', 'north_walk_2', 'north_walk_3']

def rgba(h):
    if not h or h in ('transparent', '#000000'): return (0, 0, 0, 0)
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)

def render(atlas, frame):
    pal = [rgba(c) for c in atlas['palette']]
    g = atlas['frames'].get(frame) or atlas['frames']['south_idle']
    im = Image.new('RGBA', (16, 24))
    for y in range(24):
        for x in range(16):
            v = g[y][x] if y < len(g) and x < len(g[y]) else 0
            im.putpixel((x, y), pal[v] if v < len(pal) else (0, 0, 0, 0))
    return im.resize((16 * SCALE, 24 * SCALE), Image.NEAREST)

def main():
    names = sorted(f[:-5] for f in os.listdir(SRC) if f.endswith('.json') and not f.endswith('_gan.json'))
    n = 0
    for name in names:
        atlas = json.load(open(os.path.join(SRC, name + '.json')))
        for i, frame in enumerate(LAYOUT):
            render(atlas, frame).save(os.path.join(OUT, '%s_frame_%02d.png' % (name, i)), optimize=True)
            n += 1
    print('wrote', n, 'frames for', len(names), 'beings')

if __name__ == '__main__':
    main()
