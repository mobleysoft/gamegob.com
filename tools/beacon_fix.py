#!/usr/bin/env python3
"""Make the HelmCorp analytics beacon silent.

Every page POSTs {v,p,t} as application/json to https://helmcorp.cc/api/beacon.
That content type forces a CORS preflight, the endpoint answers 405 with no
CORS headers, and every page load logs two console errors (Lighthouse
best-practices hit on all 64 pages). navigator.sendBeacon with a text/plain
body is a simple request that needs no preflight and never logs; the fetch
fallback uses mode:'no-cors' for the same reason. Idempotent; run from the
repo root."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD = re.compile(r"fetch\('https://helmcorp\.cc/api/beacon',\{method:'POST',body:(JSON\.stringify\(\{[^}]*\}\)),headers:\{'Content-Type':'application/json'\},keepalive:true\}\)\.catch\(function\(\)\{\}\)")
NEW = (r"(function(u,b){try{if(navigator.sendBeacon){navigator.sendBeacon(u,b)}else{fetch(u,{method:'POST',mode:'no-cors',keepalive:true,body:b}).catch(function(){})}}catch(e){}})"
       r"('https://helmcorp.cc/api/beacon',\1)")

def main():
    n = 0
    for f in sorted(os.listdir(ROOT)):
        if not f.endswith('.html'):
            continue
        p = os.path.join(ROOT, f)
        s = open(p, encoding='utf-8', errors='surrogateescape').read()
        t, k = OLD.subn(NEW, s)
        if k:
            open(p, 'w', encoding='utf-8', errors='surrogateescape').write(t)
            n += 1
    print('beacon rewritten in %d pages' % n)

if __name__ == '__main__':
    main()
