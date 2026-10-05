#!/usr/bin/env python3
"""Quarter machine: unlimited plays inside the native shell.

Eleven games gate each run behind a QuarterMachine: one free play per game
per day, then credits that are only sold on gamegob.com. Inside the App
Store build there is no purchase path (linking out to one is an App Store
3.1.1 rejection), so a second run in a day would dead-end on INSERT QUARTER.
Every implementation is bespoke above the primitives, but all eleven share
getCredits(); in the native shell (gg-mobile sets GG.native) it reports a
standing balance, so canPlay() is always true and spending is harmless. Web
behaviour unchanged. Idempotent; run from the repo root."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUARD = "\n        if (window.GG && GG.native) return 99; // native shell: no credit sales, no dead end"

def main():
    n = 0
    for f in sorted(os.listdir(ROOT)):
        if not f.endswith('.html'):
            continue
        p = os.path.join(ROOT, f)
        s = open(p, encoding='utf-8', errors='surrogateescape').read()
        if 'const QuarterMachine' not in s or 'GG.native) return 99' in s:
            continue
        t, k = re.subn(r'(\n[ \t]*function getCredits\(\) \{)', r'\1' + GUARD.replace('\\', '\\\\'), s, count=1)
        if not k:
            print('  %s: no getCredits()' % f); continue
        open(p, 'w', encoding='utf-8', errors='surrogateescape').write(t)
        n += 1
    print('native credit floor in %d pages' % n)

if __name__ == '__main__':
    main()
