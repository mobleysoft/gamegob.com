#!/usr/bin/env python3
"""Inline event handlers in static markup that cannot compile.

A generator wrote JavaScript string escapes into HTML attributes, e.g.
    onclick="AccessSettings.setColorblind(\\u0027off\\u0027)"
    onerror="this.style.display=\\x27none\\x27"
Inside an attribute those are not escapes; the browser compiles the handler on first use and
throws "Invalid or unexpected token", so the button does nothing (or an <img onerror> throws
on load). The same text inside a <script> block is legitimate JavaScript and is left alone.

Fix: in markup only, turn \\u0027 / \\x27 / \\' into the HTML entity &#39;, then recompile every
handler with node --check and report what is still broken. Idempotent. Run from anywhere:

    python3 tools/fix_inline_handlers.py            # fix + report
    python3 tools/fix_inline_handlers.py --check    # report only
"""
import glob
import html
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT_RE = re.compile(r'<script\b[^>]*>.*?</script>', re.S | re.I)
ATTR_RE = re.compile(r'(\son[a-z]+=")([^"]*)(")', re.I)
TMP = '/tmp/gg_handler_check.js'


def markup_spans(s):
    """Yield (start, end) of the text outside <script> blocks."""
    pos = 0
    for m in SCRIPT_RE.finditer(s):
        yield pos, m.start()
        pos = m.end()
    yield pos, len(s)


def compiles(body):
    open(TMP, 'w').write('(function(event){' + html.unescape(body) + '\n})')
    return subprocess.run(['node', '--check', TMP], capture_output=True, text=True).returncode == 0


def fix_attr(body):
    return body.replace('\\u0027', '&#39;').replace('\\x27', '&#39;').replace("\\'", '&#39;')


def process(path, apply):
    s = open(path, encoding='utf-8', errors='surrogateescape').read()
    out = []
    fixed = 0
    still_bad = []
    last = 0
    for a, b in markup_spans(s):
        seg = s[a:b]

        def repl(m):
            nonlocal fixed
            body = m.group(2)
            if compiles(body):
                return m.group(0)
            nb = fix_attr(body)
            if nb != body and compiles(nb):
                fixed += 1
                return m.group(1) + nb + m.group(3)
            still_bad.append(body[:90])
            return m.group(0)

        out.append(s[last:a])
        out.append(ATTR_RE.sub(repl, seg))
        last = b
    out.append(s[last:])
    t = ''.join(out)
    if apply and t != s:
        open(path, 'w', encoding='utf-8', errors='surrogateescape').write(t)
    return fixed, still_bad


def main():
    apply = '--check' not in sys.argv
    total = 0
    for p in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        fixed, bad = process(p, apply)
        if fixed or bad:
            total += fixed
            print('%-32s fixed %2d%s' % (os.path.basename(p), fixed, ('  STILL BROKEN: ' + ' | '.join(bad)) if bad else ''))
    print('handlers fixed:', total, '(applied)' if apply else '(check only)')


if __name__ == '__main__':
    main()
