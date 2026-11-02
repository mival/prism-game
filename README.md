# Prism

A light puzzle for the browser. Route a laser into its receivers with mirrors, a prism, a beam splitter and color filters.

Play it at https://mival.github.io/prism-game/

## How to play

- Tap a piece in the tray, then tap an empty tile to place it. You can also drag it straight onto the board.
- Tap a placed piece to rotate it. Mirrors and splitters turn in 22.5° steps; a prism flips which side red and blue go.
- Drag a placed piece to move it, or drag it onto the tray to take it back.
- Arrows on each beam show which way the light travels. Light reflected straight back is drawn as two lanes with arrows pointing opposite ways.
- A prism splits white light into red, green and blue. Each receiver lights only when the color it shows arrives.

## Code

- `src/js/logic.js` holds the puzzle rules, the levels and the beam tracer. It has no DOM code, so it also runs in Node.
- `src/js/render.js` draws the pieces with Canvas 2D and composites the frame with WebGL, including a GPU bloom pass on the light layer. It falls back to Canvas 2D when WebGL is unavailable.
- `src/js/main.js` handles layout, input and the render loop.

The site is a static page; `.github/workflows/pages.yml` deploys it to GitHub Pages on every push to `main`.
