# GameGob input base

New games inherit SightX input through the shared kit, `assets/gg-mobile.js`.
`assets/weyland-input.js` is an unmodified vendor copy from
[weylandai.com main at 100073ef1640](https://github.com/mobleysoft/weylandai.com/blob/100073ef1640ada127097ec0aba109697ef4c116/assets/weyland-input.js).
The full commit, SHA-256 and API contract are in
`assets/weyland-input.provenance.json`.

Load gg-mobile normally, then await its factory before enabling play:

```js
const input = await GG.createInput({
  active: () => state === PLAYING,
  stickSide: 'right'
});

// Once per game frame. SightX +y is forward; canvas +y is down.
const { move } = input.state();
player.x += move.x * speed * dt;
player.y -= move.y * speed * dt;
```

Stick, WASD and arrows share one normalized vector. Stick displacement starts
immediately; release/cancel stops it. Add no long-press or double-tap actions.
Menu actions use single taps/presses and ignore key repeat. Use `active` to gate
gameplay; call `clear()` when starting a new run, and `destroy()` when replacing
the controller. Handle a rejected factory Promise with a visible load error.
Ship the vendor beside the kit, including offline/native bundles. New games
should not add their own movement listeners or `data-gg-keypad`. Existing
unmigrated games retain their controls.

`forge_survival.html` (Forge Survivors) is the first consumer. Its old movement
key map and touch joystick were removed. Attacks remain automatic.

## G023 evidence and reproduction

`evidence/g023/node-input.json` contains 39 passing integration checks, actual
input vectors/player displacements, source hashes and the measurement method.
The test executes the production vendor, kit, game and game loop in Node with
DOM/audio doubles and synthetic events. It does not establish browser rendering,
physical touch latency or FPS.

```sh
node tools/g023_input_check.cjs > /tmp/g023-node-evidence.json
python3 tools/g023_input_check.py --port 8773 --out /tmp/g023-browser-evidence
```

For the Mac session's browser measurement, open
`http://127.0.0.1:8773/tools/g023_input_check.html`. The browser harness runs the
production source in an iframe with explicit 1/60-second frames, synthetic DOM
events and coarse-pointer media emulation, then writes its observations and
source hashes to `/tmp/g023-browser-evidence/report.json`. Ads/analytics are
omitted from this test fixture. Its checks have not yet been run in a browser
by this session: headless Chromium was sandbox-blocked, and computer control
was not approved for Safari or Lumen.

For natural gameplay, use `http://127.0.0.1:8773/forge_survival.html`: Enter or tap
opens character selection; one Start tap or Enter starts the run. WASD/arrows
move immediately. On a touch device the bottom-right stick moves the player;
release stops movement. Switch away and back to check that movement stays
neutral. The Mac session owns browser/device measurement and board updates.
