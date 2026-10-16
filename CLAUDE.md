# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris on HTML5 Canvas. No dependencies, no `package.json`, no build step, no linter, no test suite. UI strings and the README are in Spanish; keep new user-facing text in Spanish.

## Running

Open `index.html` directly, or serve the folder statically (recommended):

```bash
python -m http.server 8000   # then open http://localhost:8000
```

There are no automated tests — verify changes by playing the game in a browser.

## Architecture

Three files: `index.html` (DOM + two canvases + overlay), `style.css` (dark/retro theme), and `game.js` (all logic, plain script with `'use strict'`, no modules). All game state lives in module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) that `init()` resets; the restart button just calls `init()` again.

Key conventions in `game.js`:

- **Piece type = color index = cell value.** `PIECES[i]` matrices are filled with the value `i`, and `COLORS[i]` is its color. Board cells store `0` (empty) or that index, so `merge()` copies shape values straight into the board. Index 0 is `null` in both arrays. Adding a piece means adding to both arrays at the same index and updating the `* 7` in `randomPiece()`.
- **Collision is the single source of truth.** `collide(shape, x, y)` is used for movement, rotation wall kicks (`tryRotate` tries x offsets `0, -1, 1, -2, 2`; not SRS), ghost projection (`ghostY`), gravity, and game-over detection in `spawn()`. Cells with `y < 0` are allowed above the board.
- **Piece lifecycle:** gravity/soft drop/hard drop → `lockPiece()` → `merge()` → `clearLines()` (also recomputes level and `dropInterval = max(100, 1000 - (level-1)*90)`) → `spawn()` (promotes `next` to `current`, game over if it collides immediately).
- **Loop:** `requestAnimationFrame(loop)` accumulates `dt` into `dropAccum` and steps gravity once per `dropInterval`; the whole board is redrawn every frame. Pause/game over work by `cancelAnimationFrame(animId)`; resume restarts the loop with a fresh `lastTime`.
- **Power-ups:** `randomPiece()` gives ~`POWER_CHANCE` of pieces a `power` (from `POWERS`) plus a `mask` matrix marking the carrying cell; `mask` is rotated alongside `shape` in `tryRotate`. `lockPiece()` runs `applyPowerUp()` between `merge()` and `clearLines()`. `WILD = 8` is a board-only color index (no entry in `PIECES`); `rowComplete()` treats a row as full when its wildcards ≥ its empty cells. Freeze uses `freezeTime`, decremented in `loop` instead of accumulating `dropAccum`.
- **HUD** (`updateHUD`) is DOM text, updated after line clears, soft drops, and every keydown. The overlay element is shared by PAUSA and GAME OVER states.

## Coupled values

- `<canvas id="board">` size in `index.html` must equal `COLS × BLOCK` by `ROWS × BLOCK` (300×600 by default).
- `#next-canvas` is 120×120, which matches the hardcoded `NB = 30` × 4 cells in `drawNext()`.
