#!/usr/bin/env python3
"""Curate the GameGob storefront (John, 2026-10-05, decision 1A).

index.html becomes six flagship games. Every other game moves to workshop.html, labelled a
prototype. The estate footer bar and the self-promo ad blocks come off both pages.
portal.html, a stale duplicate of the old storefront, becomes a redirect to the front page.

Reads the pre-curation storefront from the working copy while it still has the full grid,
otherwise from git history, so the script can be re-run. Run from anywhere:

    python3 tools/curate_storefront.py
"""
import html
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = '20261005c'

# page, title, pitch, genre class, genre label, card colour, glow
FLAGSHIPS = [
    ('haven.html', 'Haven',
     'Explore Haven village and meet its beings. A full SNES-style world under a CRT glow.',
     'rpg', 'RPG', '#88CC88', 'rgba(136,204,136,0.38)'),
    ('forge_end_bird.html', 'EndBird',
     'Eat, grow, explode. One bird in a chaotic world, from quarks to cosmos.',
     'arcade', 'Arcade', '#CC88FF', 'rgba(204,136,255,0.38)'),
    ('survivors.html', 'Dreadtide',
     'Horde survival. 18 weapons, endless waves, auto-attack everything. Survive the dread.',
     'survival', 'Survival', '#DD5599', 'rgba(221,85,153,0.38)'),
    ('forge_fighting.html', 'Forge Fighting',
     '1v1 combat. Combos, specials, knockouts. Pick a fighter and brawl.',
     'fighting', 'Fighting', '#FFCC00', 'rgba(255,204,0,0.38)'),
    ('racer.html', 'Burnline',
     'High-speed pseudo-3D racing against a field of rivals, each with its own handling. Drift, boost, burn the line.',
     'racing', 'Racing', '#FFAA22', 'rgba(255,170,34,0.38)'),
    ('bullet_hell.html', 'Dreamweaver',
     'Dance through thousands of projectiles. Boss after boss, each with its own psychedelic pattern.',
     'shooter', 'Bullet Hell', '#8888FF', 'rgba(136,136,255,0.38)'),
]
FLAGSHIP_HREFS = [f[0] for f in FLAGSHIPS]

CARD_RE = re.compile(r'<a href="([a-z0-9_]+\.html)" class="game-card"[^>]*>.*?</a>', re.S)


def read(path):
    return open(path, encoding='utf-8', errors='surrogateescape').read()


def write(path, s):
    open(path, 'w', encoding='utf-8', errors='surrogateescape').write(s)


def load_source():
    s = read(os.path.join(ROOT, 'index.html'))
    if 'id="grid-original"' in s:
        return s
    for ref in ('HEAD', 'HEAD~1', 'HEAD~2', 'HEAD~3', 'HEAD~4'):
        try:
            out = subprocess.run(['git', '-C', ROOT, 'show', ref + ':index.html'], capture_output=True,
                                 text=True, errors='surrogateescape', check=True).stdout
        except subprocess.CalledProcessError:
            continue
        if 'id="grid-original"' in out:
            return out
    raise SystemExit('no pre-curation storefront found in the working copy or recent history')


def all_cards(src):
    cards = []
    for m in CARD_RE.finditer(src):
        block = m.group(0)
        open_tag = block[:block.index('>') + 1]
        h3 = re.search(r'<h3>(.*?)</h3>', block, re.S)
        title = html.unescape(re.sub('<[^>]+>', '', h3.group(1))).strip() if h3 else m.group(1)
        genres = re.search(r'data-genres="([^"]*)"', open_tag)
        gid = re.search(r'data-game="([^"]+)"', open_tag)
        cards.append({'href': m.group(1), 'id': gid.group(1) if gid else m.group(1)[:-5].replace('_', '-'),
                      'title': title, 'genres': genres.group(1) if genres else '', 'block': block})
    return cards


def cut_block(s, needle, start_anchor, end_anchor):
    """Remove every block containing `needle`, from the nearest preceding `start_anchor`
    through the first following `end_anchor`."""
    while True:
        idx = s.find(needle)
        if idx < 0:
            return s
        i = s.rfind(start_anchor, 0, idx)
        j = s.find(end_anchor, idx)
        if i < 0 or j < 0:
            raise SystemExit('could not bound block around ' + needle)
        s = s[:i] + s[j + len(end_anchor):]


def strip_promos_and_bar(s):
    # top and bottom banner ads
    s = cut_block(s, '<div class="promo-banner">', '<div class="page-wrapper">', '</div>\n</div>\n')
    # in-feed promo cards
    s = re.sub(r'\n[ \t]*<!--[^\n]*-->\n[ \t]*<div class="promo-card">.*?</a>\n[ \t]*</div>\n', '\n', s, flags=re.S)
    # sidebar promos
    s = re.sub(r'\n[ \t]*<!-- Sidebar Promos -->\n[ \t]*<aside class="sidebar-col">.*?</aside>\n', '\n', s, flags=re.S)
    # estate bar pinned to the bottom of the viewport
    s = re.sub(r'\n<!-- MASCOM Conglomerate Nav -->\n<div id="mascom-nav".*?</div>\n', '\n', s, flags=re.S)
    assert 'promo-banner">' not in s and 'promo-card">' not in s and 'mascom-nav' not in s and 'sidebar-col">' not in s
    return s


WORKSHOP_CSS = """
/* workshop page, 2026-10-05: single column (no sidebar), prototype notice */
.content-area { display: block; }
/* the header glow pseudo-element is 150% wide; clip it so the page never scrolls sideways */
.site-header { overflow: hidden; }
html, body { overflow-x: clip; }
.workshop-note { margin: 0 0 18px; padding: 12px 16px; border: 1px solid var(--forge-accent); border-radius: 8px; background: rgba(204,136,255,0.07); color: var(--text); font-size: 11px; line-height: 1.6; }
.workshop-note a { color: var(--accent-bright); }
.workshop-note strong { color: var(--forge-accent); }
"""


# Workshop cards whose title did not match the game's own <title>; the page's name wins.
RENAMES = {
    'forge_snake.html': 'Serpent',
    'forge_idle.html': 'Forge Idle',
    'forge_match_three.html': 'GemForge',
    'forge_racing.html': 'Neon Drift',
    'forge_survival.html': 'Forge Survivors',
    'forge_card_game.html': 'Spire of Shadows',
    'forge_fps.html': 'Forge: Descent',
    'forge_moba.html': 'Battle Lanes',
}


def make_workshop(src, cards):
    s = src
    for href, new_title in RENAMES.items():
        s = re.sub(r'(<a href="%s" class="game-card"[^>]*>.*?<h3>)(.*?)(</h3>)' % re.escape(href),
                   lambda m: m.group(1) + html.escape(new_title) + m.group(3), s, count=1, flags=re.S)
    for c in cards:
        if c['href'] in RENAMES:
            c['title'] = RENAMES[c['href']]
    for h in FLAGSHIP_HREFS:
        s = re.sub(r'\n[ \t]*<!--[^\n]*-->\n(?=[ \t]*<a href="%s" class="game-card")' % re.escape(h), '\n', s)
        s = re.sub(r'[ \t]*<a href="%s" class="game-card".*?</a>\n' % re.escape(h), '', s, flags=re.S)
    s = strip_promos_and_bar(s)
    rest = [c for c in cards if c['href'] not in FLAGSHIP_HREFS]
    n = len(rest)
    genres = sorted({g.strip() for c in rest for g in c['genres'].split(',') if g.strip()})

    # head
    s = s.replace('<title>GameGob - Free Browser Games | 60+ Instant Play Games</title>',
                  '<title>GameGob Workshop &mdash; %d Playable Prototypes</title>' % n)
    s = re.sub(r'<meta name="description" content="[^"]*">',
               '<meta name="description" content="The GameGob Workshop: %d playable prototypes, remixes and experiments. Unfinished and labelled that way. Free in your browser, no downloads.">' % n, s, 1)
    s = s.replace('<link rel="canonical" href="https://gamegob.com/">', '<link rel="canonical" href="https://gamegob.com/workshop.html">')
    s = s.replace('<meta property="og:title" content="GameGob: The AGI Gaming Company">', '<meta property="og:title" content="GameGob Workshop &mdash; Playable Prototypes">')
    s = s.replace('<meta property="og:description" content="GameGob: The AGI Gaming Company. Free browser games, instant play.">',
                  '<meta property="og:description" content="%d playable prototypes, remixes and experiments. Unfinished and labelled that way.">' % n)
    s = s.replace('<meta property="og:url" content="https://gamegob.com/">', '<meta property="og:url" content="https://gamegob.com/workshop.html">')
    s = s.replace('<meta name="twitter:title" content="GameGob - 55+ Free Browser Games">', '<meta name="twitter:title" content="GameGob Workshop &mdash; Playable Prototypes">')
    s = s.replace('<meta name="twitter:description" content="Play 60+ free browser games instantly. No downloads, no installs.">',
                  '<meta name="twitter:description" content="%d playable prototypes, remixes and experiments. Free in your browser.">' % n)
    s = re.sub(r'<script type="application/ld\+json">.*?</script>',
               '<script type="application/ld+json">\n' + json.dumps({
                   "@context": "https://schema.org", "@type": "CollectionPage", "name": "GameGob Workshop",
                   "url": "https://gamegob.com/workshop.html", "isPartOf": {"@type": "WebSite", "name": "GameGob", "url": "https://gamegob.com"},
                   "description": "%d playable prototypes, remixes and experiments from GameGob. Unfinished and labelled that way." % n
               }, indent=2) + '\n</script>', s, 1, flags=re.S)
    s = s.replace('</style>', WORKSHOP_CSS + '</style>', 1)

    # header copy and honest counts
    s = s.replace('<p class="site-tagline">Free Browser Games &mdash; No Downloads, No Installs</p>',
                  '<p class="site-tagline">The Workshop &mdash; prototypes, remixes and experiments. Playable, unfinished, labelled that way.</p>')
    s = re.sub(r'(<span class="header-stat-num">)60\+(</span>\s*<span class="header-stat-label">)Games(</span>)', r'\g<1>%d\g<2>Prototypes\g<3>' % n, s, 1)
    s = re.sub(r'(<span class="header-stat-num">)15\+(</span>\s*<span class="header-stat-label">)Genres(</span>)', r'\g<1>%d\g<2>Genres\g<3>' % len(genres), s, 1)
    s = s.replace('<p class="section-subtitle">The core Haven universe &mdash; 16 sentient beings across 13 game modes</p>',
                  '<p class="section-subtitle">Prototypes set in the Haven universe</p>')

    # notice + way back to the flagships
    nav_idx = s.find('<nav class="portal-nav" id="filter-nav">')
    wrap_idx = s.rfind('<div class="page-wrapper">', 0, nav_idx)
    note = ('<div class="page-wrapper">\n    <p class="workshop-note"><strong>Everything on this page is a prototype.</strong> '
            'It plays, but it is not finished, and some of it never will be. The six finished games are on the '
            '<a href="index.html">front page</a>.</p>\n</div>\n\n')
    s = s[:wrap_idx] + note + s[wrap_idx:]
    s = s.replace('<button class="nav-btn active" data-filter="all">All Games</button>',
                  '<a class="nav-btn" href="index.html">&#9733; Flagships</a>\n        <button class="nav-btn active" data-filter="all">All Games</button>', 1)
    s = s.replace('<a href="index.html" class="logo-link">', '<a href="index.html" class="logo-link" title="GameGob front page">', 1)
    s = s.replace('<p>gamegob.com &mdash; Free browser games, forged by AI</p>', '<p>gamegob.com &mdash; the Workshop. Free browser games.</p>')
    s = s.replace('<a href="games.html">Haven Sub-hub</a>', '<a href="index.html">Flagships</a>\n        <a href="games.html">Haven Sub-hub</a>', 1)
    return s, n, genres


STORE_CSS = """
/* flagship storefront, 2026-10-05 */
/* the header glow pseudo-element is 150% wide; clip it so the page never scrolls sideways */
.site-header { overflow: hidden; }
html, body { overflow-x: clip; }
.flagship-grid { grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; }
.flagship-grid .game-card h3 { font-size: 16px; }
.flagship-grid .game-card .card-desc { font-size: 11px; line-height: 1.6; }
.flagship-grid .game-card .play-btn { font-size: 12px; }
.flagship-grid .game-card .card-shot { margin-bottom: 14px; }
.workshop-band { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 18px 20px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); margin-bottom: 40px; }
.workshop-band p { margin: 0; font-size: 11px; color: var(--text-dim); line-height: 1.6; max-width: 62ch; }
.workshop-band p strong { color: var(--text); }
.workshop-link { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border: 1px solid var(--forge-accent); border-radius: 8px; color: var(--forge-accent); text-decoration: none; font-size: 11px; font-weight: 600; white-space: nowrap; }
.workshop-link:hover, .workshop-link:focus-visible { background: var(--forge-glow); outline: none; }
.continue-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 22px; font-size: 11px; }
.continue-label { color: var(--text-dim); text-transform: uppercase; letter-spacing: .08em; font-size: 9px; }
.continue-link { color: var(--accent-bright); text-decoration: none; border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; }
.continue-link:hover, .continue-link:focus-visible { border-color: var(--accent); outline: none; }
@media (max-width: 480px) { .flagship-grid { grid-template-columns: 1fr; } }
"""

STORE_BODY = """<body>

<header class="site-header">
    <div class="page-wrapper">
        <a href="index.html" class="logo-link">
            <div class="site-logo">GAMEGOB</div>
        </a>
        <p class="site-tagline">Six games, finished one at a time. Free in your browser &mdash; no downloads, no installs.</p>
        <div class="header-stats">
            <div class="header-stat">
                <span class="header-stat-num">6</span>
                <span class="header-stat-label">Flagship games</span>
            </div>
            <div class="header-stat">
                <span class="header-stat-num">__N__</span>
                <span class="header-stat-label">Workshop prototypes</span>
            </div>
            <div class="header-stat">
                <span class="header-stat-num">0</span>
                <span class="header-stat-label">Installs needed</span>
            </div>
        </div>
    </div>
</header>

<div class="page-wrapper">
    <main class="games-main" id="games-main">

        <div class="continue-strip" id="continue-strip" hidden></div>

        <section class="original-section" id="section-flagships">
            <h2 class="section-title original">Flagships</h2>
            <p class="section-subtitle">The games we stand behind today. Phone or desktop &mdash; tap to play.</p>
            <div class="section-divider original"></div>

            <div class="games-grid flagship-grid" id="grid-flagships">
__CARDS__
            </div>
        </section>

        <section class="forge-section" id="section-workshop">
            <h2 class="section-title forge">The Workshop</h2>
            <div class="section-divider forge"></div>
            <div class="workshop-band">
                <p><strong>__N__ more games live in the Workshop:</strong> prototypes, remixes and experiments from the Forge. They play, they are not finished, and they say so.</p>
                <a class="workshop-link" href="workshop.html">Browse the Workshop <span class="arrow">&rarr;</span></a>
            </div>
        </section>

    </main>
</div>

<footer class="site-footer">
    <p>gamegob.com &mdash; Free browser games</p>
    <div class="footer-links">
        <a href="workshop.html">Workshop</a>
        <a href="shop.html">Q Shop</a>
        <a href="https://mobleyhelms.com">Mobley Helms</a>
    </div>
    <p style="margin-top:12px;font-size:9px;color:#7a7a98;">&copy; 2025&ndash;2026 GameGob. All games are free to play.</p>
</footer>

<script>
(function () {
    'use strict';
    // Continue playing: the same localStorage key the Workshop writes (most recent last).
    var MAP = __MAP__;
    var KEY = 'gamegob_recent';
    function ids() { try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
    var strip = document.getElementById('continue-strip');
    var recent = ids().slice().reverse().filter(function (id) { return MAP[id]; }).slice(0, 3);
    if (strip && recent.length) {
        var label = document.createElement('span'); label.className = 'continue-label'; label.textContent = 'Continue playing';
        strip.appendChild(label);
        recent.forEach(function (id) {
            var a = document.createElement('a'); a.className = 'continue-link'; a.href = MAP[id].h; a.textContent = MAP[id].t + ' \\u2192';
            strip.appendChild(a);
        });
        strip.hidden = false;
    }
    document.querySelectorAll('.game-card[data-game]').forEach(function (card) {
        card.addEventListener('click', function () {
            var id = card.getAttribute('data-game');
            var r = ids().filter(function (x) { return x !== id; }); r.push(id);
            try { localStorage.setItem(KEY, JSON.stringify(r.slice(-30))); } catch (e) {}
        });
    });
})();
</script>
__BEACON__
<!-- VentureForge:collated -->
</body>
</html>
"""

CARD_TPL = """                <a href="__HREF__" class="game-card" data-game="__ID__" data-genres="__GENRE__" data-collection="flagship"
                   style="--card-color:__COLOR__;--card-glow:__GLOW__;">
                    <img class="card-shot" src="/assets/thumbs/__SHOT__.webp?v=__VER__" alt="__TITLE__ title screen" width="800" height="450" __LOADING__>
                    <div class="card-header">
                        <h3>__TITLE__</h3>
                        <span class="genre-tag genre-__GENRE__">__LABEL__</span>
                    </div>
                    <p class="card-desc">__PITCH__</p>
                    <div class="play-btn">PLAY <span class="arrow">&rarr;</span></div>
                </a>"""


def make_storefront(src, cards, n_workshop):
    by_href = {c['href']: c for c in cards}
    head = src[:src.index('</head>')]
    head = head[:head.rindex('</style>')] + STORE_CSS + head[head.rindex('</style>'):]
    head = head.replace('<title>GameGob - Free Browser Games | 60+ Instant Play Games</title>',
                        '<title>GameGob &mdash; Free Browser Games: Haven, EndBird, Dreadtide, Burnline</title>')
    head = re.sub(r'<meta name="description" content="[^"]*">',
                  '<meta name="description" content="Six free browser games from GameGob: Haven, EndBird, Dreadtide, Forge Fighting, Burnline and Dreamweaver. Play instantly on your phone, no downloads. Plus a Workshop of %d playable prototypes.">' % n_workshop, head, 1)
    head = head.replace('<meta property="og:title" content="GameGob: The AGI Gaming Company">', '<meta property="og:title" content="GameGob &mdash; Free Browser Games">')
    head = head.replace('<meta property="og:description" content="GameGob: The AGI Gaming Company. Free browser games, instant play.">',
                        '<meta property="og:description" content="Six free browser games, finished one at a time. Play instantly on your phone, no downloads.">')
    head = head.replace('<meta name="twitter:title" content="GameGob - 55+ Free Browser Games">', '<meta name="twitter:title" content="GameGob &mdash; Free Browser Games">')
    head = head.replace('<meta name="twitter:description" content="Play 60+ free browser games instantly. No downloads, no installs.">',
                        '<meta name="twitter:description" content="Six free browser games, finished one at a time. No downloads, no installs.">')
    head = re.sub(r'<script type="application/ld\+json">.*?</script>',
                  '<script type="application/ld+json">\n' + json.dumps({
                      "@context": "https://schema.org", "@type": "WebSite", "name": "GameGob", "url": "https://gamegob.com",
                      "description": "Six free browser games, finished one at a time, plus a workshop of playable prototypes. No downloads."
                  }, indent=2) + '\n</script>', head, 1, flags=re.S)

    card_html = []
    for i, (href, title, pitch, genre, label, color, glow) in enumerate(FLAGSHIPS):
        c = by_href.get(href)
        card_html.append(CARD_TPL.replace('__HREF__', href).replace('__ID__', c['id'] if c else href[:-5].replace('_', '-'))
                         .replace('__GENRE__', genre).replace('__COLOR__', color).replace('__GLOW__', glow)
                         .replace('__SHOT__', href[:-5]).replace('__VER__', VER).replace('__TITLE__', html.escape(title))
                         .replace('__LABEL__', label).replace('__PITCH__', pitch)
                         .replace('__LOADING__', 'loading="eager" fetchpriority="high"' if i < 2 else 'loading="lazy"'))
    recent_map = {c['id']: {'h': c['href'], 't': c['title']} for c in cards}
    for href, title, *_ in FLAGSHIPS:
        c = by_href.get(href)
        if c:
            recent_map[c['id']] = {'h': href, 't': title}
    beacon = re.search(r'<!-- HelmCorp Analytics -->\n<script>.*?</script>\n', src, re.S)
    body = (STORE_BODY.replace('__N__', str(n_workshop)).replace('__CARDS__', '\n\n'.join(card_html))
            .replace('__MAP__', json.dumps(recent_map, separators=(',', ':')))
            .replace('__BEACON__', beacon.group(0).rstrip('\n') if beacon else ''))
    return head + '</head>\n' + body


PORTAL_REDIRECT = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GameGob</title>
<meta http-equiv="refresh" content="0; url=/">
<link rel="canonical" href="https://gamegob.com/">
<meta name="robots" content="noindex">
</head>
<body style="background:#050510;color:#c8c8d8;font-family:monospace;padding:24px">
<p>GameGob's games moved to the <a href="/" style="color:#aaffaa">front page</a> (six flagships) and the <a href="/workshop.html" style="color:#aaffaa">Workshop</a> (prototypes).</p>
</body>
</html>
"""


def name_mismatch_report(cards):
    """Card titles that differ from the page's own <title>; printed for review, not auto-fixed."""
    out = []
    for c in cards:
        p = os.path.join(ROOT, c['href'])
        if not os.path.exists(p):
            out.append((c['href'], c['title'], 'PAGE MISSING'))
            continue
        m = re.search(r'<title>([^<]*)</title>', read(p))
        page_title = html.unescape(m.group(1)).strip() if m else ''
        base = re.split(r'\s+[—\-|:]\s+', page_title)[0].strip()
        if base and base.lower() != c['title'].lower() and c['title'].lower() not in page_title.lower():
            out.append((c['href'], c['title'], page_title))
    return out


BAR_RE = re.compile(r'\n?[ \t]*(?:<!-- MASCOM Conglomerate Nav -->\n)?[ \t]*<div id="mascom-nav".*?</div>[ \t]*\n', re.S)


def strip_bar_from_all_pages():
    """The estate bar is pinned to the bottom of every game page too; take it off everywhere."""
    changed = 0
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith('.html') or name in ('index.html', 'workshop.html'):
            continue
        p = os.path.join(ROOT, name)
        s = read(p)
        if 'id="mascom-nav"' not in s:
            continue
        t = BAR_RE.sub('\n', s)
        assert 'mascom-nav' not in t, name
        write(p, t)
        changed += 1
    return changed


def main():
    src = load_source()
    cards = all_cards(src)
    assert len(cards) >= 50, 'expected the full grid, found %d cards' % len(cards)
    workshop, n, genres = make_workshop(src, cards)
    store = make_storefront(src, cards, n)
    write(os.path.join(ROOT, 'workshop.html'), workshop)
    write(os.path.join(ROOT, 'index.html'), store)
    write(os.path.join(ROOT, 'portal.html'), PORTAL_REDIRECT)
    print('estate bar removed from %d other pages' % strip_bar_from_all_pages())
    print('cards in source: %d | flagships: %d | workshop: %d | genres: %d' % (len(cards), len(FLAGSHIPS), n, len(genres)))
    print('workshop cards:', len(CARD_RE.findall(workshop)), '| storefront cards:', len(CARD_RE.findall(store)))
    mm = name_mismatch_report(cards)
    print('card/page title mismatches (%d):' % len(mm))
    for row in mm:
        print('  %-28s card=%-26s page=%s' % row)


if __name__ == '__main__':
    main()
