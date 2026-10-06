#!/usr/bin/env python3
"""Build the static Beings API from the roster embedded in beings.html.

beings_api_index.html documented an API at beings.mobleysoft.com that answers 522 and a
relative /v1/beings.json that did not exist. The roster data is real and lives in beings.html
(RAW_BEINGS). This writes it out as v1/beings.json and v1/categories.json so the documented
GET endpoints are real on gamegob.com. Neurochemistry is emitted only where the roster has
numbers; beings without them get null rather than invented values. Idempotent; run from anywhere.
"""
import json
import os
import re
from collections import Counter, OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AXES = OrderedDict([('da', 'dopamine'), ('se', 'serotonin'), ('ne', 'norepinephrine'), ('ox', 'oxytocin'),
                    ('ga', 'gaba'), ('co', 'cortisol'), ('en', 'endorphin')])


def load_raw():
    s = open(os.path.join(ROOT, 'beings.html'), encoding='utf-8', errors='surrogateescape').read()
    m = re.search(r'const RAW_BEINGS = (\[.*?\]);\n', s, re.S)
    if not m:
        raise SystemExit('RAW_BEINGS not found in beings.html')
    return json.loads(m.group(1))


def main():
    raw = load_raw()
    beings = []
    for i, b in enumerate(raw, 1):
        has_chem = any((b.get(k) or 0) != 0 for k in AXES)
        beings.append(OrderedDict([
            ('id', i),
            ('name', b.get('n')),
            ('category', b.get('c')),
            ('title', b.get('t')),
            ('group', b.get('g')),
            ('venture', b.get('v') or None),
            ('lore', b.get('l') or None),
            ('leet_of', b.get('lk') or None),
            ('neurochemistry', OrderedDict((AXES[k], b.get(k)) for k in AXES) if has_chem else None),
            ('portrait', '/sprites/%s_portrait.png' % b['n'].split()[0].lower()
             if os.path.exists(os.path.join(ROOT, 'sprites', '%s_portrait.png' % b['n'].split()[0].lower())) else None),
        ]))
    cats = Counter(b['category'] for b in beings)
    out_dir = os.path.join(ROOT, 'v1')
    os.makedirs(out_dir, exist_ok=True)
    meta = OrderedDict([('api', 'gamegob.com/v1'), ('version', '1.0'), ('organism', 'MASCOM'),
                        ('source', 'the roster in beings.html; static files rebuilt by tools/build_beings_api.py'),
                        ('total', len(beings))])
    with open(os.path.join(out_dir, 'beings.json'), 'w') as f:
        json.dump(OrderedDict(list(meta.items()) + [('beings', beings)]), f, indent=1, ensure_ascii=False)
    with open(os.path.join(out_dir, 'categories.json'), 'w') as f:
        json.dump(OrderedDict(list(meta.items()) + [('categories', [OrderedDict([('name', c), ('count', n)]) for c, n in cats.most_common()])]), f, indent=1, ensure_ascii=False)
    with_chem = sum(1 for b in beings if b['neurochemistry'])
    print('beings: %d (%d with real neurochemistry, %d with portraits) | categories: %d' % (
        len(beings), with_chem, sum(1 for b in beings if b['portrait']), len(cats)))


if __name__ == '__main__':
    main()
