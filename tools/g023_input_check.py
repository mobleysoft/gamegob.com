#!/usr/bin/env python3
"""Serve a deterministic, real-browser input check and save its raw evidence.

Run: python3 tools/g023_input_check.py --port 8766 --out /tmp/g023-evidence
Open http://127.0.0.1:8766/tools/g023_input_check.html in a browser.
The fixture uses production game/kit/vendor code, queues rAF for explicit frame
steps, emulates coarse-pointer media, and omits unrelated ads/analytics. Events
are synthetic DOM events, not a physical-device latency or FPS measurement.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8766)
parser.add_argument('--out', type=Path, default=Path('/tmp/g023-evidence'))
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/__g023/missing/gg-mobile.js':
            data = (ROOT / 'assets/gg-mobile.js').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript')
            self.end_headers()
            self.wfile.write(data)
            return
        if url.path == '/__g023/game':
            query = parse_qs(url.query)
            legacy = 'legacy' in query
            name = 'forge_rocket_apprentice.html' if legacy else 'forge_survival.html'
            html = (ROOT / name).read_text()
            # Only omit the two third-party scripts, never the gameplay script.
            html = re.sub(r'<script>.*?</script>', lambda m: '' if
                          'adsbygoogle' in m[0] or 'helmcorp.cc/api/beacon' in m[0]
                          else m[0], html, flags=re.S)
            setup = """<base href="/"><script>
            window.__errors=[];
            addEventListener('error',e=>__errors.push(e.message));
            window.__frames=new Map();window.__nextFrame=0;window.__time=performance.now();
            window.requestAnimationFrame=cb=>{__frames.set(++__nextFrame,cb);return __nextFrame};
            window.cancelAnimationFrame=id=>__frames.delete(id);
            window.__step=()=>{__time+=1000/60;const q=[...__frames.values()];__frames.clear();q.forEach(cb=>cb(__time))};
            const realMatchMedia=window.matchMedia.bind(window);
            window.matchMedia=q=>q==='(hover: none) and (pointer: coarse)'?
              {matches:COARSE,media:q}:realMatchMedia(q);
            </script>""".replace('COARSE', 'true' if 'coarse' in query else 'false')
            html = html.replace('<head>', '<head>' + setup, 1)
            if 'missing' in query:
                html = html.replace('assets/gg-mobile.js?v=20261009', '/__g023/missing/gg-mobile.js')
            if 'inline' in query:
                html = re.sub(r'<script src="/?assets/gg-mobile.js[^\"]*"></script>',
                              lambda _: '<script>' + (ROOT / 'assets/gg-mobile.js').read_text() + '</script>', html)
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(html.encode())
            return
        super().do_GET()

    def do_POST(self):
        if self.path != '/__g023/evidence':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length < 1_000_000:
            self.send_error(400)
            return
        report = json.loads(self.rfile.read(length))
        report['recorded_at'] = datetime.now(timezone.utc).isoformat()
        report['source_sha256'] = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                                   for name in ['assets/weyland-input.js', 'assets/gg-mobile.js',
                                                'forge_survival.html', 'tools/g023_input_check.html',
                                                'tools/g023_input_check.py']}
        output = args.out / 'report.json'
        output.write_text(json.dumps(report, indent=2) + '\n')
        print(f'Evidence: {output}; {report.get("passed")}/{len(report.get("checks", []))} passed', flush=True)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')


print(f'Open http://127.0.0.1:{args.port}/tools/g023_input_check.html', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
