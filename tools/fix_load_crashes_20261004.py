#!/usr/bin/env python3
"""Fix the load-time crashes the 2026-10-04 headless smoke run found in eight
games (stack traces in the commit message). Each fix is the smallest change
that lets the game reach its title screen; nothing else in the game moves."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def edit(name, pairs):
    p = os.path.join(ROOT, name)
    s = open(p, encoding='utf-8', errors='surrogateescape').read()
    for old, new in pairs:
        n = s.count(old)
        assert n >= 1, '%s: anchor missing: %r' % (name, old[:70])
        s = s.replace(old, new)
    open(p, 'w', encoding='utf-8', errors='surrogateescape').write(s)
    print('fixed', name)

# fps.html: AchTracker's IIFE runs at parse time, ~1900 lines before
# `const TOTAL_WEAPONS` is initialised (temporal dead zone). Size the array
# lazily; reset() rebuilds it at game start, after the constants exist.
edit('fps.html', [
    ("    let weaponUsed = new Array(TOTAL_WEAPONS).fill(false);\n    let damageTakenOnFloor = false;",
     "    let weaponUsed = []; // sized in reset(): TOTAL_WEAPONS is declared later in the file\n    let damageTakenOnFloor = false;"),
])

# platformer.html: buildCharGrid() ran at parse time and read `Progression`,
# a const declared ~1900 lines later. Run it once the document has parsed.
edit('platformer.html', [
    ("\nbuildCharGrid();\n",
     "\nif (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildCharGrid); else buildCharGrid();\n"),
])

# racer.html: a saved/selected track index outside TRACKS left `track`
# undefined and render() read track.sky1. Fall back to the first track.
edit('racer.html', [
    ("    const track = TRACKS[selectedTrack];", "    const track = TRACKS[selectedTrack] || TRACKS[0];"),
    ("    const track = TRACKS[trackIdx];", "    const track = TRACKS[trackIdx] || TRACKS[0];"),
    ("    const trackName = TRACKS[selectedTrack].name;", "    const trackName = (TRACKS[selectedTrack] || TRACKS[0]).name;"),
])

# photonic_forge_breakout.html: gameLoop called update(), which does not
# exist; paddle and ball movement already live inside draw().
edit('photonic_forge_breakout.html', [
    ("  const deltaTime = timestamp - lastTime;\n  update(deltaTime / 1000);\n  draw();",
     "  draw(); // movement is integrated inside draw(); there is no separate update()"),
])

# forge_break_shaper.html: the title screen's decorative pieces computed a
# rotation index from titlePulse, which is NaN on the first frame (dt from
# an undefined previous timestamp), so getPieceBlocks returned undefined.
edit('forge_break_shaper.html', [
    ("      const blocks = this.getPieceBlocks(type, Math.floor(rot)%PIECE_SHAPES[type].length);",
     "      const n = PIECE_SHAPES[type].length;\n      const blocks = this.getPieceBlocks(type, (((Math.floor(rot) || 0) % n) + n) % n);"),
])

# forge_star_shield.html: `notifications` was only assigned when a run
# started, but update() iterates it on the title screen too.
edit('forge_star_shield.html', [
    ("let notifications;\n", "let notifications = [];\n"),
])

# genesis.html / realm.html: pointer lock is a mouse feature; requesting it
# from a touch tap throws on iOS and desktop-emulated touch alike.
edit('genesis.html', [
    ("C.addEventListener('click',()=>{if(!locked)C.requestPointerLock()});",
     "C.addEventListener('click',()=>{if(!locked&&matchMedia('(pointer: fine)').matches)C.requestPointerLock()});"),
])
edit('realm.html', [
    ("  if (!pointerLocked) {\n    renderer.domElement.requestPointerLock();\n    return;\n  }",
     "  if (!pointerLocked) {\n    if (matchMedia('(pointer: fine)').matches) renderer.domElement.requestPointerLock();\n    return;\n  }"),
    ("  prevEl.classList.remove('show');\n  renderer.domElement.requestPointerLock();",
     "  prevEl.classList.remove('show');\n  if (matchMedia('(pointer: fine)').matches) renderer.domElement.requestPointerLock();"),
])
print('done')
