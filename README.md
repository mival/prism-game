# Prism

A light puzzle for the browser. Route lasers into their receivers with mirrors, prisms, beam splitters and color filters, through glass doors and portals and past dark sensors.

Play it at https://mival.github.io/prism-game/

## How to play

- Tap a piece in the tray, then tap an empty tile to place it. You can also drag it straight onto the board.
- Tap a placed piece to rotate it. Mirrors and splitters turn in 22.5° steps; a prism flips which side red and blue go.
- Drag a placed piece to move it, or drag it onto the tray to take it back.
- Arrows on each beam show which way the light travels. Light reflected straight back is drawn as two lanes with arrows pointing opposite ways.
- A prism splits white light into red, green and blue. Each receiver lights only when the color it shows arrives, and colors that arrive together add up (red + blue = magenta, all three = white).
- Colored glass walls let only their own color through. Filters work the same way but are pieces you place.
- Dark sensors must receive no light at all. Light entering a portal leaves its twin. Fixed pieces (bolts in the corners) can be turned but not moved.
- The bulb button gives a hint: it places one piece in its correct spot and locks it. After 30 seconds without a move, the bulb glows.

There are 50 levels. From level 3 on, the tray also holds decoy pieces that no solution uses. A level counts as finished once its solution has stayed correct for a moment; the rings around the receivers fill up while that happens. Progress is saved in the browser.

`help.html` explains every item with an animated example.

### Moving progress to another device

Settings (the gear button) shows a QR code and a link ending in `#restore-…` for the other device, plus a save code such as `04FN-MNMS-VF63-RZ97-J19C-C1WG` that can be copied or downloaded as a text file. Scanning the QR code, opening the link, typing the code or loading the file on another device restores the progress, merging with what is there. The format lives in `src/js/progress.js`: solved levels as bits in an append-only list of level ids, Endless wins and the last level, scrambled and protected by a checksum so typos and edited codes are rejected. It isn't encryption: the page has to be able to read its own codes.

### Endless mode

The level list also offers Endless: Easy, Medium or Hard levels generated on the spot by `src/js/generator.js`, running in a Web Worker (`src/js/endless-worker.js`) so the game keeps animating. Every generated level is checked before it is shown: not solved at the start, solvable with exactly the intended pieces, few solutions, and decoys that add none. The next level is built while you play the current one.

Each generated level has a code like `M-48213` (difficulty and seed). The same code always gives the same level, and a link ending in `#M-48213` opens it directly. Pages opened from `file://` can't start workers, so there the level is built on the page.

## Themes

Every color, font, radius and glow setting lives in `src/css/theme.css`. The page styles and the canvas renderer both read those CSS variables, so changing a value there changes the game. Dark is the default; light follows the system setting, and Settings switches between auto, light and dark.

To add a theme, copy the light block in `theme.css` under a new `:root[data-theme="..."]` selector, change the values, and add a radio with its name to the Theme group in `settings.html`. `--beam-blend: add` makes light glow on a dark board, and `over` paints it on a light one.

## Code

- `src/css/theme.css` holds the theme variables; `src/css/style.css` holds layout and components.
- `src/js/logic.js` holds the puzzle rules, the levels and the beam tracer. It has no DOM code, so it also runs in Node.
- `src/js/render.js` draws the pieces with Canvas 2D and composites the frame with WebGL, including a GPU bloom pass on the light layer. It falls back to Canvas 2D when WebGL is unavailable.
- `src/js/main.js` handles layout, input, hints and the render loop.
- `help.html` and `src/js/help.js` are the help page; its examples are tiny levels drawn by the same renderer.
- `settings.html` and `src/js/settings.js` are the settings page: theme, moving progress, restore and reset. `src/css/page.css` styles both pages.
- `src/js/progress.js` holds the save-code format and reads and merges progress in the browser.
- `src/vendor/qrcode.js` is [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4 (MIT), used for the QR code.

Every level stores one known solution, used by the hint button. Levels 14–50 were made by a generator that builds a level backwards from a random intended solution; a search over all piece placements then checked each one: unsolved at the start, solvable, needing every intended piece, and with decoy pieces that add no new solutions.

The site is a static page; `.github/workflows/pages.yml` deploys it to GitHub Pages on every push to `main`.
