'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#a5d6a7', // S - light green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#eceff1', // comodín (solo tablero, no es una pieza)
  '#f06292', // + (pentominó X) - rosa
  '#4db6ac', // U (pentominó) - verde azulado
  '#dce775', // Y (pentominó) - lima
  '#ffc400', // 1×1 - dorado (recompensa)
  '#90a4ae', // 3×3 hueca - gris piedra (reto)
  '#6b7280', // basura (solo tablero, modo Basura)
  '#4b5563', // bloque fijo (solo tablero, modo Excavación)
];

const WILD = 8;
const PLUS = 9, U_PIECE = 10, Y_PIECE = 11, SINGLE = 12, HOLLOW = 13;
const T_PIECE = 3;
const GARBAGE = 14, FIXED = 15;

// Probabilidad de que la pieza aleatoria sea especial en vez de una de las 7 clásicas
const PENTOMINO_CHANCE = 0.10;
const HOLLOW_CHANCE = 0.03;

const PIECES = [
  null,
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]],                               // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]],                  // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]],                  // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]],                  // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]],                  // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]],                  // L
  null,                                               // 8: WILD, solo tablero
  [[0, 9, 0], [9, 9, 9], [0, 9, 0]],                  // +
  [[10, 0, 10], [10, 10, 10], [0, 0, 0]],             // U
  [[0, 0, 0, 0], [11, 11, 11, 11], [0, 11, 0, 0], [0, 0, 0, 0]], // Y
  [[12]],                                             // 1×1
  [[13, 13, 13], [13, 0, 13], [13, 13, 13]],          // 3×3 hueca
  null,                                               // 14: GARBAGE, solo tablero
  null,                                               // 15: FIXED, solo tablero
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const LINE_NAMES = ['', 'SIMPLE', 'DOBLE', 'TRIPLE', 'TETRIS'];

// Bonus: T-spin (0, 1, 2, 3 líneas), back-to-back y perfect clear
const TSPIN_SCORES = [400, 800, 1200, 1600];
const B2B_FACTOR = 1.5;
const PERFECT_CLEAR_BONUS = 3000;

// Power-ups: una celda aleatoria de la pieza lo lleva y se activa al fijarla.
const POWER_CHANCE = 0.15;
const FREEZE_MS = 5000;
const POWERS = [
  { id: 'bomb', name: 'Bomba', icon: '💣' },
  { id: 'ray', name: 'Rayo', icon: '⚡' },
  { id: 'dye', name: 'Tinte', icon: '🎨' },
  { id: 'gravity', name: 'Gravedad', icon: '🧲' },
  { id: 'freeze', name: 'Congelar', icon: '❄️' },
];

// Habilidades: se elige una al vaciar la barra de energía (llena = ENERGY_MAX)
const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 15;
const SLOW_MS = 10000;
const SLOW_FACTOR = 3;
const PREVIEW_PIECES = 10;
const QUEUE_SIZE = 5;
const ABILITIES = [
  { id: 'preview', name: 'Ver 5 siguientes', desc: `Muestra las próximas 5 piezas durante ${PREVIEW_PIECES} piezas` },
  { id: 'swap', name: 'Cambiar pieza', desc: 'Cambia la pieza actual por otra al azar' },
  { id: 'slow', name: 'Ralentizar', desc: `La caída va ${SLOW_FACTOR} veces más lenta durante ${SLOW_MS / 1000} s` },
  { id: 'undo', name: 'Deshacer', desc: 'Deshace la última pieza colocada' },
  { id: 'hold', name: 'Reservar', desc: 'Guarda la pieza actual; sácala cuando quieras con C' },
];

// Modos de juego. Los campos opcionales activan cada regla/objetivo.
const MODES = {
  classic: { name: 'Clásico', desc: 'Juego libre, sin objetivo.' },
  sprint: { name: 'Sprint', desc: 'Limpia 40 líneas en 2 minutos.', lines: 40, timeLimit: 120000 },
  garbage: { name: 'Basura', desc: 'Sobrevive 2 minutos. Cada 10 s sube una fila de basura.', survive: 120000, garbageEvery: 10000 },
  dig: { name: 'Excavación', desc: 'Elimina todos los bloques fijos pre-colocados.', fixedRows: 8 },
  invisible: { name: 'Invisible', desc: 'Las piezas desaparecen al tocar suelo. Limpia 20 líneas.', lines: 20, invisible: true },
  reverse: { name: 'Rotación inversa', desc: 'Desde el nivel 3 la rotación se invierte. Limpia 40 líneas.', lines: 40, reverseFromLevel: 3 },
};
const MODE_IDS = Object.keys(MODES);

const POPUP_MS = 1200;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const queueCanvas = document.getElementById('queue-canvas');
const queueCtx = queueCanvas.getContext('2d');
const queueSection = document.getElementById('queue-section');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const energyFill = document.getElementById('energy-fill');
const energyText = document.getElementById('energy-text');
const abilityStatus = document.getElementById('ability-status');
const modeNameEl = document.getElementById('mode-name');
const objectiveEl = document.getElementById('objective');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const modesBtn = document.getElementById('modes-btn');
const modeMenu = document.getElementById('mode-menu');
const modeList = document.getElementById('mode-list');
const abilityMenu = document.getElementById('ability-menu');
const abilityList = document.getElementById('ability-list');
const abilityMsg = document.getElementById('ability-msg');
const powerEl = document.getElementById('power');
const themeBtn = document.getElementById('theme-btn');
const pauseMenu = document.getElementById('pause-menu');
const pauseResumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSel = document.getElementById('start-level');
const MAX_START_LEVEL = 15;

let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, freezeTime, singleReward;
let modeId = 'classic', mode = MODES.classic, elapsed, garbageAccum;
let combo, lastWasDifficult, lastMoveRotate;
let energy, hold, previewPieces, slowTime, undoSnapshot;
let modeMenuOpen = false, abilityMenuOpen = false;
// startLevel: preferencia guardada (se aplica en el próximo init);
// baseLevel: nivel inicial de la partida en curso (suelo del nivel en clearLines)
let startLevel = 1, baseLevel = 1;
let popups, flashTime, shakeTime, revealTime;

function levelInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const roll = Math.random();
  let type;
  if (roll < HOLLOW_CHANCE) type = HOLLOW;
  else if (roll < HOLLOW_CHANCE + PENTOMINO_CHANCE) type = [PLUS, U_PIECE, Y_PIECE][Math.floor(Math.random() * 3)];
  else type = Math.floor(Math.random() * 7) + 1;
  return makePiece(type);
}

function spawnX(shape) {
  return Math.floor(COLS / 2) - Math.floor(shape[0].length / 2);
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  let power = null, mask = null;
  if (Math.random() < POWER_CHANCE) {
    // mask marca la celda con el power-up y rota junto con shape
    power = POWERS[Math.floor(Math.random() * POWERS.length)];
    mask = shape.map(row => row.map(() => 0));
    const cells = [];
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) cells.push([r, c]);
    const [pr, pc] = cells[Math.floor(Math.random() * cells.length)];
    mask[pr][pc] = 1;
  }
  return { type, shape, power, mask, x: spawnX(shape), y: 0 };
}

// Copia independiente de una pieza (para la cola, la reserva y deshacer)
function clonePiece(p) {
  return { ...p, shape: p.shape.map(row => [...row]), mask: p.mask && p.mask.map(row => [...row]) };
}

// Copia de la pieza devuelta a la posición de aparición, manteniendo su rotación
function resetPiece(p) {
  const copy = clonePiece(p);
  copy.x = spawnX(copy.shape);
  copy.y = 0;
  return copy;
}

function fillQueue() {
  while (queue.length < QUEUE_SIZE) queue.push(randomPiece());
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
}

function rotationInverted() {
  return !!mode.reverseFromLevel && level >= mode.reverseFromLevel;
}

function tryRotate() {
  const rotate = rotationInverted() ? rotateCCW : rotateCW;
  const rotated = rotate(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      if (current.mask) current.mask = rotate(current.mask);
      current.x += kick;
      lastMoveRotate = true;
      return;
    }
  }
}

function move(dx) {
  if (!collide(current.shape, current.x + dx, current.y)) {
    current.x += dx;
    lastMoveRotate = false;
  }
}

// Devuelve false si alguna celda quedó por encima del tablero (lock out)
function merge() {
  let inside = true;
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      if (current.y + r < 0) { inside = false; continue; }
      board[current.y + r][current.x + c] = current.shape[r][c];
    }
  return inside;
}

// Una fila se completa si no tiene huecos, o si tiene al menos tantos
// comodines como huecos (cada comodín "rellena" un hueco de su fila).
function rowComplete(row) {
  const empty = row.filter(v => v === 0).length;
  const wild = row.filter(v => v === WILD).length;
  return empty <= wild;
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (rowComplete(board[r])) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    const prevLevel = level;
    lines += cleared;
    level = Math.max(baseLevel, Math.floor(lines / 10) + 1);
    dropInterval = levelInterval(level);
    if (cleared >= 4) singleReward = true;
    if (mode.reverseFromLevel && prevLevel < mode.reverseFromLevel && level >= mode.reverseFromLevel) {
      popup('¡ROTACIÓN INVERSA!', '#ff5252', 20);
    }
  }
  return cleared;
}

// T-spin: la última acción fue una rotación de la T y al menos 3 de las
// 4 esquinas diagonales de su centro están ocupadas (las paredes cuentan).
function detectTSpin() {
  if (current.type !== T_PIECE || !lastMoveRotate) return false;
  const cx = current.x + 1, cy = current.y + 1;
  let corners = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) corners++;
  }
  return corners >= 3;
}

// Puntuación de la jugada: base (líneas o T-spin) × nivel × B2B × combo, + perfect clear
function scoreClear(cleared, tspin) {
  if (!cleared) {
    if (tspin) {
      score += TSPIN_SCORES[0] * level;
      popup('T-SPIN', COLORS[T_PIECE]);
      play('tspin');
    }
    combo = 0;
    return;
  }

  combo++;
  const difficult = tspin || cleared >= 4;
  const b2b = difficult && lastWasDifficult;
  lastWasDifficult = difficult;

  let base = (tspin ? TSPIN_SCORES[Math.min(cleared, 3)] : LINE_SCORES[Math.min(cleared, 4)]) * level;
  if (b2b) base = Math.floor(base * B2B_FACTOR);
  const gained = base * combo;
  score += gained;

  const name = tspin
    ? `T-SPIN ${LINE_NAMES[Math.min(cleared, 3)]}`
    : (cleared > 4 ? `${cleared} LÍNEAS` : LINE_NAMES[cleared]);
  if (b2b) popup(`B2B ${name}`, '#ffd740', 24);
  else if (difficult) popup(name, tspin ? COLORS[T_PIECE] : COLORS[1], 24);
  if (combo >= 2) popup(`COMBO x${combo}`, '#69f0ae', 20 + Math.min(combo, 8));
  popup(`+${gained.toLocaleString()}`, '#ffffff', 16);

  const perfect = board.every(row => row.every(v => !v));
  if (perfect) {
    score += PERFECT_CLEAR_BONUS * level;
    popup('¡PERFECT CLEAR!', '#ff80ab', 26);
  }

  flashTime = 150 + cleared * 50;
  if (difficult || perfect) shakeTime = 300;
  if (mode.invisible) revealTime = 600;
  if (perfect) play('perfect');
  else if (difficult) play('big');
  else play('clear', combo);

  const wasFull = energy >= ENERGY_MAX;
  energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
  if (!wasFull && energy >= ENERGY_MAX) {
    popup('¡ENERGÍA LISTA! (E)', '#40c4ff', 18);
    play('ready');
  }

  if (combo >= 2) {
    comboEl.classList.remove('pulse');
    void comboEl.offsetWidth; // reinicia la animación CSS
    comboEl.classList.add('pulse');
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy > current.y) lastMoveRotate = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function takeSnapshot() {
  return {
    board: board.map(row => [...row]),
    piece: clonePiece(current),
    queue: queue.map(clonePiece),
    hold: hold && clonePiece(hold),
    score, lines, level, dropInterval, combo, lastWasDifficult, singleReward,
  };
}

function lockPiece() {
  undoSnapshot = takeSnapshot();
  const tspin = detectTSpin();
  if (!merge()) { endGame(); return; }
  play('lock');
  applyPowerUp();
  scoreClear(clearLines(), tspin);
  updateHUD();
  checkObjective();
  if (!gameOver) spawn();
}

function powerCell() {
  for (let r = 0; r < current.mask.length; r++)
    for (let c = 0; c < current.mask[r].length; c++)
      if (current.mask[r][c]) return { x: current.x + c, y: current.y + r };
}

function clearCell(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS || !board[y][x]) return 0;
  board[y][x] = 0;
  return 1;
}

// Gravedad "pegajosa": un bloque está apoyado si conecta (arriba/abajo/
// izquierda/derecha) con el suelo a través de otros bloques. Lo que no está
// apoyado baja una fila a la vez, como grupo, hasta que todo queda apoyado.
function settleFloating() {
  for (let step = 0; step < ROWS; step++) {
    const supported = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    const stack = [];
    for (let c = 0; c < COLS; c++)
      if (board[ROWS - 1][c]) { supported[ROWS - 1][c] = true; stack.push([ROWS - 1, c]); }
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (!board[nr][nc] || supported[nr][nc]) continue;
        supported[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
    // Debajo de un bloque flotante solo puede haber hueco u otro bloque
    // flotante, así que bajar todos juntos una fila nunca choca.
    let moved = false;
    for (let r = ROWS - 2; r >= 0; r--)
      for (let c = 0; c < COLS; c++)
        if (board[r][c] && !supported[r][c]) {
          board[r + 1][c] = board[r][c];
          board[r][c] = 0;
          moved = true;
        }
    if (!moved) return;
  }
}

function applyPowerUp() {
  if (!current.power) return;
  const { x, y } = powerCell();
  if (y < 0) return;
  let destroyed = 0;
  switch (current.power.id) {
    case 'bomb':
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          destroyed += clearCell(x + dx, y + dy);
      settleFloating();
      shakeTime = 250;
      break;
    case 'ray':
      for (let r = 0; r < ROWS; r++) destroyed += clearCell(x, r);
      for (let c = 0; c < COLS; c++) destroyed += clearCell(c, y);
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(0));
      settleFloating();
      flashTime = 200;
      break;
    case 'dye':
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board[r][c] === current.type) board[r][c] = WILD;
      break;
    case 'gravity':
      for (let c = 0; c < COLS; c++) {
        const col = [];
        for (let r = 0; r < ROWS; r++) if (board[r][c]) col.push(board[r][c]);
        for (let r = 0; r < ROWS; r++) board[r][c] = col[r - (ROWS - col.length)] || 0;
      }
      break;
    case 'freeze':
      freezeTime = FREEZE_MS;
      break;
  }
  score += destroyed * 10 * level;
  showPower(`${current.power.icon} ${current.power.name}`);
  play('power');
}

function showPower(text) {
  powerEl.textContent = text;
}

function spawn() {
  current = queue.shift();
  // Recompensa por Tetris: la siguiente pieza es un 1×1
  if (singleReward) queue.unshift(makePiece(SINGLE));
  singleReward = false;
  fillQueue();
  lastMoveRotate = false;
  if (previewPieces > 0) previewPieces--;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

// ---- Modos de desafío ----

function placeFixedRows(count) {
  // Filas llenas de bloques fijos con un único hueco cada una
  for (let r = ROWS - count; r < ROWS; r++) {
    const hole = Math.floor(Math.random() * COLS);
    board[r] = board[r].map((_, c) => (c === hole ? 0 : FIXED));
  }
}

function addGarbageRow() {
  if (board[0].some(v => v)) { endGame(); return; }
  board.shift();
  const hole = Math.floor(Math.random() * COLS);
  board.push(Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : GARBAGE)));
  // la basura empuja la pieza en juego hacia arriba
  if (collide(current.shape, current.x, current.y)) current.y--;
  if (collide(current.shape, current.x, current.y)) { endGame(); return; }
  shakeTime = 150;
  play('garbage');
}

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fixedRowsLeft() {
  return board.filter(row => row.includes(FIXED)).length;
}

function checkObjective() {
  if (gameOver) return;
  const summary = `${lines} líneas · ${fmtTime(elapsed)} · ${score.toLocaleString()} pts`;
  if (mode.lines && lines >= mode.lines) endGame('¡COMPLETADO!', summary, true);
  else if (mode.fixedRows && !fixedRowsLeft()) endGame('¡COMPLETADO!', summary, true);
  else if (mode.survive && elapsed >= mode.survive) endGame('¡SOBREVIVISTE!', summary, true);
  else if (mode.timeLimit && elapsed >= mode.timeLimit) endGame('¡TIEMPO!', `${lines}/${mode.lines} líneas`);
}

function objectiveText() {
  const parts = [];
  if (mode.lines) parts.push(`Líneas ${lines}/${mode.lines}`);
  if (mode.timeLimit) parts.push(`⏱ ${fmtTime(mode.timeLimit - elapsed)}`);
  if (mode.survive) parts.push(`Sobrevive ${fmtTime(mode.survive - elapsed)}`);
  if (mode.garbageEvery) parts.push(`Basura en ${Math.ceil((mode.garbageEvery - garbageAccum) / 1000)} s`);
  if (mode.fixedRows) parts.push(`Filas fijas: ${fixedRowsLeft()}`);
  if (mode.reverseFromLevel) parts.push(rotationInverted() ? '↺ Rotación invertida' : `Se invierte en nivel ${mode.reverseFromLevel}`);
  return parts.join(' · ') || 'Sin objetivo';
}

// ---- Habilidades ----

function openAbilityMenu() {
  if (energy < ENERGY_MAX) {
    popup('Energía insuficiente', '#90a4ae', 16);
    return;
  }
  abilityMenuOpen = true;
  cancelAnimationFrame(animId);
  abilityMsg.textContent = '';
  abilityMenu.classList.remove('hidden');
}

function closeAbilityMenu() {
  abilityMenuOpen = false;
  abilityMenu.classList.add('hidden');
  if (!gameOver && !paused) {
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }
}

function useAbility(index) {
  const ability = ABILITIES[index];
  if (!ability) return;
  if (!applyAbility(ability.id)) {
    abilityMsg.textContent = 'No disponible ahora mismo';
    return;
  }
  energy = 0;
  play('ability');
  popup(ability.name.toUpperCase(), '#40c4ff', 20);
  updateHUD();
  closeAbilityMenu();
}

// Devuelve true si la habilidad se aplicó (y por tanto consume la energía)
function applyAbility(id) {
  switch (id) {
    case 'preview':
      previewPieces = PREVIEW_PIECES;
      drawNext();
      return true;
    case 'swap': {
      const types = [1, 2, 3, 4, 5, 6, 7].filter(t => t !== current.type);
      const piece = makePiece(types[Math.floor(Math.random() * types.length)]);
      if (!collide(piece.shape, current.x, current.y)) {
        piece.x = current.x;
        piece.y = current.y;
      } else if (collide(piece.shape, piece.x, piece.y)) {
        return false;
      }
      current = piece;
      lastMoveRotate = false;
      return true;
    }
    case 'slow':
      slowTime = SLOW_MS;
      return true;
    case 'undo': {
      if (!undoSnapshot) return false;
      const s = undoSnapshot;
      board = s.board;
      queue = s.queue;
      hold = s.hold;
      ({ score, lines, level, dropInterval, combo, lastWasDifficult, singleReward } = s);
      current = resetPiece(s.piece);
      lastMoveRotate = false;
      undoSnapshot = null;
      drawNext();
      drawHold();
      return true;
    }
    case 'hold': {
      const stored = resetPiece(current);
      if (!hold) {
        hold = stored;
        spawn();
      } else {
        const back = resetPiece(hold);
        if (collide(back.shape, back.x, back.y)) return false;
        hold = stored;
        current = back;
        lastMoveRotate = false;
      }
      drawHold();
      return true;
    }
  }
  return false;
}

// Saca la pieza reservada; la actual vuelve al principio de la cola
function retrieveHold() {
  if (!hold) return;
  const back = resetPiece(hold);
  if (collide(back.shape, back.x, back.y)) return;
  queue.unshift(resetPiece(current));
  current = back;
  hold = null;
  lastMoveRotate = false;
  drawHold();
  drawNext();
}

function abilityStatusText() {
  const parts = [];
  if (previewPieces > 0) parts.push(`👁 ${previewPieces} piezas`);
  if (slowTime > 0) parts.push(`🐢 ${(slowTime / 1000).toFixed(1)} s`);
  if (hold) parts.push('📦 reserva (C)');
  return parts.join(' · ');
}

// ---- Sonido (WebAudio sintetizado, sin archivos) ----

let audioCtx = null;
let muted = false;

function ensureAudio() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, start, dur, type = 'square', vol = 0.05) {
  if (!audioCtx || muted) return;
  const t0 = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function arpeggio(freqs, step, dur, type, vol) {
  freqs.forEach((f, i) => tone(f, i * step, dur, type, vol));
}

const SOUNDS = {
  lock: () => tone(140, 0, 0.06, 'triangle', 0.08),
  // cada eslabón del combo sube dos semitonos
  clear: n => {
    const base = 392 * Math.pow(2, (Math.min(n, 12) - 1) * 2 / 12);
    arpeggio([base, base * 1.25, base * 1.5], 0.05, 0.12, 'square', 0.04);
  },
  big: () => arpeggio([523, 659, 784, 1047], 0.06, 0.18, 'square', 0.05),
  tspin: () => arpeggio([392, 523, 392, 659], 0.05, 0.12, 'sawtooth', 0.03),
  perfect: () => arpeggio([523, 659, 784, 1047, 1319, 1568], 0.08, 0.3, 'triangle', 0.08),
  power: () => arpeggio([880, 660], 0.04, 0.1, 'sawtooth', 0.03),
  garbage: () => tone(70, 0, 0.2, 'sawtooth', 0.06),
  ready: () => arpeggio([880, 1175, 1568], 0.06, 0.15, 'triangle', 0.06),
  ability: () => arpeggio([660, 990, 1320], 0.04, 0.12, 'triangle', 0.06),
  gameover: () => arpeggio([392, 330, 262, 196], 0.15, 0.3, 'triangle', 0.08),
  win: () => arpeggio([523, 659, 784, 1047, 784, 1047], 0.1, 0.25, 'square', 0.05),
};

function play(name, arg) {
  try { SOUNDS[name](arg); } catch (e) { }
}

function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('muted', muted ? '1' : '0'); } catch (e) { }
  popup(muted ? 'SONIDO OFF' : 'SONIDO ON', '#b0bec5', 16);
}

// ---- Efectos visuales ----

function popup(text, color, size = 22) {
  popups.push({ text, color, size, age: 0, y: canvas.height * 0.38 + popups.length * 30 });
}

function tickEffects(dt) {
  for (const p of popups) p.age += dt;
  popups = popups.filter(p => p.age < POPUP_MS);
  flashTime = Math.max(0, flashTime - dt);
  shakeTime = Math.max(0, shakeTime - dt);
  revealTime = Math.max(0, revealTime - dt);
}

function drawPopups() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const p of popups) {
    const t = p.age / POPUP_MS;
    ctx.globalAlpha = 1 - t * t;
    ctx.font = `bold ${p.size}px 'Courier New', monospace`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeText(p.text, canvas.width / 2, p.y - t * 40);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, canvas.width / 2, p.y - t * 40);
  }
  ctx.globalAlpha = 1;
}

// ---- HUD ----

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = `x${Math.max(1, combo)}`;
  energyFill.style.width = `${(energy / ENERGY_MAX) * 100}%`;
  energyFill.parentElement.classList.toggle('full', energy >= ENERGY_MAX);
  setText(energyText, energy >= ENERGY_MAX ? 'LISTA · pulsa E' : `${Math.floor(energy)}%`);
}

// Textos que cambian con el tiempo (temporizadores), se refrescan cada frame
function updateStatus() {
  setText(objectiveEl, objectiveText());
  setText(abilityStatus, abilityStatusText());
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'dark' ? '☀ Claro' : '☾ Oscuro';
  try { localStorage.setItem('theme', theme); } catch (e) { }
  // repintar también en pausa o game over
  draw();
  drawNext();
  drawHold();
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = cssVar('--block-highlight');
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === WILD) drawIcon(context, x, y, '★', size, '#455a64');
  if (colorIndex === FIXED) {
    context.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    context.lineWidth = 2;
    context.strokeRect(x * size + 7, y * size + 7, size - 14, size - 14);
  }
  context.globalAlpha = 1;
}

function drawIcon(context, x, y, icon, size, color) {
  context.font = `${Math.floor(size * 0.6)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color || '#fff';
  context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
}

function drawPiece(context, piece, px, py, size, alpha) {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      drawBlock(context, px + c, py + r, piece.shape[r][c], size, alpha);
      if (piece.mask && piece.mask[r][c]) {
        context.globalAlpha = alpha ?? 1;
        drawIcon(context, px + c, py + r, piece.power.icon, size);
        context.globalAlpha = 1;
      }
    }
}

// Dibuja una pieza centrada en una caja de 4×4 celdas cuya esquina está en (boxX, boxY) px
function drawCentered(context, piece, size, boxX, boxY) {
  const offX = boxX / size + (4 - piece.shape[0].length) / 2;
  const offY = boxY / size + (4 - piece.shape.length) / 2;
  drawPiece(context, piece, offX, offY, size);
}

function drawGrid() {
  ctx.strokeStyle = cssVar('--grid');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shakeTime > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  drawGrid();

  // board (en modo invisible solo se ve un instante tras limpiar, o al terminar)
  const boardAlpha = !mode.invisible || gameOver ? 1 : Math.min(1, revealTime / 300);
  if (boardAlpha > 0)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK, boardAlpha);

  // ghost
  drawPiece(ctx, current, current.x, ghostY(), BLOCK, 0.2);

  // current piece
  drawPiece(ctx, current, current.x, current.y, BLOCK);
  ctx.restore();

  // tinte azulado mientras la caída está congelada, ámbar si está ralentizada
  if (freezeTime > 0) {
    ctx.fillStyle = 'rgba(128, 222, 234, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (slowTime > 0) {
    ctx.fillStyle = 'rgba(255, 193, 7, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (flashTime > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.35, flashTime / 600)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawPopups();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawCentered(nextCtx, queue[0], NB, 0, 0);

  // con la habilidad "Ver 5 siguientes" se muestran también queue[1..4]
  queueSection.hidden = previewPieces <= 0;
  queueCtx.clearRect(0, 0, queueCanvas.width, queueCanvas.height);
  if (previewPieces > 0) {
    const QB = 12;
    for (let i = 1; i < QUEUE_SIZE; i++)
      drawCentered(queueCtx, queue[i], QB, (queueCanvas.width - 4 * QB) / 2, (i - 1) * 50);
  }
}

function drawHold() {
  const NB = 30;
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (hold) drawCentered(holdCtx, hold, NB, 0, 0);
}

function endGame(title = 'GAME OVER', detail, won = false) {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('win', won);
  overlayScore.textContent = detail ?? `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  play(won ? 'win' : 'gameover');
  updateHUD();
  updateStatus();
  draw();
}

// ---- Menú de pausa ----
// Mientras está abierto (paused) el keydown solo atiende al menú.

function togglePause() {
  if (gameOver) return;
  if (paused) resumeGame();
  else openPauseMenu();
}

function openPauseMenu() {
  paused = true;
  cancelAnimationFrame(animId);
  pauseControls.hidden = true;
  startLevelSel.value = String(startLevel);
  pauseMenu.classList.remove('hidden');
}

function resumeGame() {
  paused = false;
  pauseMenu.classList.add('hidden');
  if (document.activeElement === startLevelSel) startLevelSel.blur();
  // Sin caída instantánea al volver: se descarta el tiempo acumulado
  dropAccum = 0;
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function setStartLevel(lvl) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, lvl));
  startLevelSel.value = String(startLevel);
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) { }
}

function togglePauseControls() {
  pauseControls.hidden = !pauseControls.hidden;
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  elapsed += dt;
  tickEffects(dt);
  if (slowTime > 0) slowTime -= dt;
  if (freezeTime > 0) {
    freezeTime -= dt;
    showPower(freezeTime > 0 ? `❄️ ${(freezeTime / 1000).toFixed(1)}s` : '—');
  } else {
    dropAccum += dt;
  }
  const interval = slowTime > 0 ? dropInterval * SLOW_FACTOR : dropInterval;
  if (dropAccum >= interval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
    }
  }
  if (mode.garbageEvery && !gameOver) {
    garbageAccum += dt;
    if (garbageAccum >= mode.garbageEvery) {
      garbageAccum = 0;
      addGarbageRow();
    }
  }
  checkObjective();
  if (gameOver) return;
  updateStatus();
  draw();
  animId = requestAnimationFrame(loop);
}

function init(newModeId = modeId) {
  modeId = newModeId;
  mode = MODES[modeId];
  board = createBoard();
  if (mode.fixedRows) placeFixedRows(mode.fixedRows);
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = levelInterval(level);
  dropAccum = 0;
  freezeTime = 0;
  slowTime = 0;
  singleReward = false;
  combo = 0;
  lastWasDifficult = false;
  lastMoveRotate = false;
  energy = 0;
  hold = null;
  previewPieces = 0;
  undoSnapshot = null;
  elapsed = 0;
  garbageAccum = 0;
  popups = [];
  flashTime = 0;
  shakeTime = 0;
  revealTime = 0;
  showPower('—');
  modeNameEl.textContent = mode.name;
  lastTime = performance.now();
  queue = [];
  fillQueue();
  spawn();
  updateHUD();
  updateStatus();
  drawHold();
  overlay.classList.add('hidden');
  modeMenu.classList.add('hidden');
  abilityMenu.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  modeMenuOpen = false;
  abilityMenuOpen = false;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function openModeMenu() {
  gameOver = true; // detiene la entrada y el bucle mientras se elige
  cancelAnimationFrame(animId);
  overlay.classList.add('hidden');
  abilityMenu.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  abilityMenuOpen = false;
  paused = false;
  modeMenuOpen = true;
  modeMenu.classList.remove('hidden');
}

// Botones de los menús generados a partir de MODES y ABILITIES
function buildMenus() {
  MODE_IDS.forEach((id, i) => {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.innerHTML = `<b>${i + 1} · ${MODES[id].name}</b><small>${MODES[id].desc}</small>`;
    btn.addEventListener('click', () => { ensureAudio(); btn.blur(); init(id); });
    modeList.appendChild(btn);
  });
  ABILITIES.forEach((a, i) => {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.innerHTML = `<b>${i + 1} · ${a.name}</b><small>${a.desc}</small>`;
    btn.addEventListener('click', () => { btn.blur(); useAbility(i); });
    abilityList.appendChild(btn);
  });
}

document.addEventListener('keydown', e => {
  ensureAudio();
  const digit = /^Digit([1-9])$/.exec(e.code);

  if (modeMenuOpen) {
    if (digit && MODE_IDS[digit[1] - 1]) init(MODE_IDS[digit[1] - 1]);
    if (e.code === 'KeyT') toggleTheme();
    return;
  }
  if (abilityMenuOpen) {
    if (digit) useAbility(digit[1] - 1);
    else if (e.code === 'Escape' || e.code === 'KeyE') closeAbilityMenu();
    return;
  }
  if (paused) {
    // Menú de pausa: se bloquean todas las entradas del juego
    if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); resumeGame(); return; }
    if (e.target === startLevelSel) return; // el <select> gestiona sus propias teclas
    // Evita el scroll de la página; Tab/Enter siguen sirviendo para navegar los botones
    if (e.code.startsWith('Arrow') || (e.code === 'Space' && e.target === document.body)) e.preventDefault();
    if (e.code === 'Digit1') resumeGame();
    else if (e.code === 'Digit2') init();
    else if (e.code === 'Digit3') togglePauseControls();
    else if (e.code === 'ArrowLeft') setStartLevel(startLevel - 1);
    else if (e.code === 'ArrowRight') setStartLevel(startLevel + 1);
    else if (e.code === 'KeyT') toggleTheme();
    else if (e.code === 'KeyM') toggleMute();
    return;
  }

  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      move(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      move(1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      e.preventDefault();
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyE':
      openAbilityMenu();
      break;
    case 'KeyC':
      retrieveHold();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  ensureAudio();
  restartBtn.blur();
  init();
});
modesBtn.addEventListener('click', () => { modesBtn.blur(); openModeMenu(); });
themeBtn.addEventListener('click', () => {
  toggleTheme();
  themeBtn.blur(); // evita que Space reactive el botón
});

pauseResumeBtn.addEventListener('click', () => { ensureAudio(); pauseResumeBtn.blur(); resumeGame(); });
pauseRestartBtn.addEventListener('click', () => { ensureAudio(); pauseRestartBtn.blur(); init(); });
pauseControlsBtn.addEventListener('click', () => { ensureAudio(); pauseControlsBtn.blur(); togglePauseControls(); });
for (let i = 1; i <= MAX_START_LEVEL; i++) {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = `Nivel ${i}`;
  startLevelSel.appendChild(opt);
}
startLevelSel.addEventListener('change', () => {
  setStartLevel(parseInt(startLevelSel.value, 10) || 1);
  startLevelSel.blur();
});

try {
  const saved = parseInt(localStorage.getItem('startLevel'), 10);
  if (saved >= 1 && saved <= MAX_START_LEVEL) startLevel = saved;
} catch (e) { }
startLevelSel.value = String(startLevel);
try { muted = localStorage.getItem('muted') === '1'; } catch (e) { }
buildMenus();
init('classic');
openModeMenu();

// Por defecto oscuro; respeta la elección guardada
let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) { }
setTheme(savedTheme === 'light' ? 'light' : 'dark');
