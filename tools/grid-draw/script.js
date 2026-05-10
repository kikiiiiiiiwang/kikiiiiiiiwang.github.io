const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const clearBtn = document.getElementById('clear');
const downloadBtn = document.getElementById('download');

const gridTypeSelect = document.getElementById('grid-type');
const cellSizeInput = document.getElementById('cell-size');
const gridAlphaInput = document.getElementById('grid-alpha');
const fillInput = document.getElementById('fill');
const bgInput = document.getElementById('bg');

const cellSizeVal = document.getElementById('cell-size-val');
const gridAlphaVal = document.getElementById('grid-alpha-val');

const toolButtons = Array.from(document.querySelectorAll('.tool'));

const state = {
    tool: 'draw',
    gridType: 'hex',
    cellSize: 18,
    gridAlpha: 0.10,
    fill: '#000000',
    bg: '#ffffff',
    view: { panX: 0, panY: 0, scale: 1 },
    pointer: { down: false, lastKey: null },
    cells: {
        hex: new Map(),
        square: new Map(),
        diamond: new Map()
    },
    history: {
        hex: { undo: [], redo: [] },
        square: { undo: [], redo: [] },
        diamond: { undo: [], redo: [] }
    }
};

function init() {
    resize();
    bindUI();
    render();
}

function resize() {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${Math.floor(rect.width)}px`;
    canvas.style.height = `${Math.floor(rect.height)}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function bindUI() {
    window.addEventListener('resize', () => {
        resize();
        render();
    });

    toolButtons.forEach((b) => {
        b.addEventListener('click', () => {
            toolButtons.forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
            state.tool = b.dataset.tool;
        });
    });

    gridTypeSelect.addEventListener('change', () => {
        state.gridType = gridTypeSelect.value;
        state.pointer.lastKey = null;
        render();
    });

    cellSizeInput.addEventListener('input', () => {
        state.cellSize = parseInt(cellSizeInput.value);
        syncLabels();
        render();
    });

    gridAlphaInput.addEventListener('input', () => {
        state.gridAlpha = parseFloat(gridAlphaInput.value);
        syncLabels();
        render();
    });

    fillInput.addEventListener('input', () => {
        state.fill = fillInput.value;
        render();
    });

    bgInput.addEventListener('input', () => {
        state.bg = bgInput.value;
        render();
    });

    undoBtn.addEventListener('click', () => undo());
    redoBtn.addEventListener('click', () => redo());
    clearBtn.addEventListener('click', () => clear());
    downloadBtn.addEventListener('click', () => download());

    canvas.addEventListener('pointerdown', (e) => onPointerDown(e));
    window.addEventListener('pointermove', (e) => onPointerMove(e));
    window.addEventListener('pointerup', () => onPointerUp());
    window.addEventListener('pointercancel', () => onPointerUp());

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, Math.sign(e.deltaY) * -0.12);
    }, { passive: false });

    syncLabels();
}

function syncLabels() {
    cellSizeVal.textContent = String(state.cellSize);
    gridAlphaVal.textContent = state.gridAlpha.toFixed(2);
}

function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    state.pointer.down = true;
    state.pointer.lastKey = null;

    if (state.tool === 'pan') {
        state.pointer.panStart = { x: e.clientX, y: e.clientY, panX: state.view.panX, panY: state.view.panY };
        return;
    }
    applyPaintAt(e.clientX, e.clientY);
}

function onPointerMove(e) {
    if (!state.pointer.down) return;
    if (state.tool === 'pan') {
        const p = state.pointer.panStart;
        if (!p) return;
        state.view.panX = p.panX + (e.clientX - p.x);
        state.view.panY = p.panY + (e.clientY - p.y);
        render();
        return;
    }
    applyPaintAt(e.clientX, e.clientY);
}

function onPointerUp() {
    state.pointer.down = false;
    state.pointer.panStart = null;
    state.pointer.lastKey = null;
}

function applyPaintAt(clientX, clientY) {
    const key = pickCellKey(clientX, clientY);
    if (!key || key === state.pointer.lastKey) return;
    state.pointer.lastKey = key;

    const grid = state.gridType;
    const cells = state.cells[grid];
    const was = cells.has(key);
    const next = state.tool === 'erase' ? false : true;
    if (was === next) return;

    if (next) cells.set(key, 1);
    else cells.delete(key);

    pushHistory(grid, { key, was, next });
    render();
}

function pushHistory(grid, action) {
    const h = state.history[grid];
    h.undo.push(action);
    h.redo.length = 0;
}

function undo() {
    const grid = state.gridType;
    const h = state.history[grid];
    const action = h.undo.pop();
    if (!action) return;
    applyHistoryAction(grid, action.key, action.was);
    h.redo.push(action);
    render();
}

function redo() {
    const grid = state.gridType;
    const h = state.history[grid];
    const action = h.redo.pop();
    if (!action) return;
    applyHistoryAction(grid, action.key, action.next);
    h.undo.push(action);
    render();
}

function clear() {
    const grid = state.gridType;
    state.cells[grid].clear();
    state.history[grid].undo.length = 0;
    state.history[grid].redo.length = 0;
    render();
}

function download() {
    const link = document.createElement('a');
    link.download = `grid-draw-${state.gridType}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function zoomAt(clientX, clientY, delta) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const prev = state.view.scale;
    const next = clamp(prev * (1 + delta), 0.25, 6);
    const ax = (x - state.view.panX) / prev;
    const ay = (y - state.view.panY) / prev;

    state.view.scale = next;
    state.view.panX = x - ax * next;
    state.view.panY = y - ay * next;
    render();
}

function render() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.translate(state.view.panX, state.view.panY);
    ctx.scale(state.view.scale, state.view.scale);

    if (state.gridType === 'hex') renderHex(w, h);
    if (state.gridType === 'square') renderSquare(w, h);
    if (state.gridType === 'diamond') renderDiamond(w, h);

    ctx.restore();
}

function renderHex(viewW, viewH) {
    const size = state.cellSize;
    const root3 = Math.sqrt(3);
    const cells = state.cells.hex;

    const bounds = visibleBounds(viewW, viewH);
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = bounds.maxX;
    const maxY = bounds.maxY;

    const qMin = Math.floor((minX / (root3 * size)) - 3);
    const qMax = Math.ceil((maxX / (root3 * size)) + 3);
    const rMin = Math.floor((minY / (1.5 * size)) - 3);
    const rMax = Math.ceil((maxY / (1.5 * size)) + 3);

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(0,0,0,${state.gridAlpha})`;
    for (let r = rMin; r <= rMax; r++) {
        for (let q = qMin; q <= qMax; q++) {
            const p = hexToPixel(q, r, size);
            if (p.x < minX - size * 2 || p.x > maxX + size * 2 || p.y < minY - size * 2 || p.y > maxY + size * 2) continue;
            strokeHex(p.x, p.y, size);
        }
    }

    ctx.fillStyle = state.fill;
    for (const [key] of cells) {
        const [q, r] = key.split(',').map(Number);
        const p = hexToPixel(q, r, size);
        fillHex(p.x, p.y, size);
    }
}

function renderSquare(viewW, viewH) {
    const size = state.cellSize;
    const cells = state.cells.square;

    const bounds = visibleBounds(viewW, viewH);
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = bounds.maxX;
    const maxY = bounds.maxY;

    const x0 = Math.floor(minX / size) - 2;
    const x1 = Math.ceil(maxX / size) + 2;
    const y0 = Math.floor(minY / size) - 2;
    const y1 = Math.ceil(maxY / size) + 2;

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(0,0,0,${state.gridAlpha})`;
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            ctx.strokeRect(x * size, y * size, size, size);
        }
    }

    ctx.fillStyle = state.fill;
    for (const [key] of cells) {
        const [x, y] = key.split(',').map(Number);
        ctx.fillRect(x * size, y * size, size, size);
    }
}

function renderDiamond(viewW, viewH) {
    const size = state.cellSize;
    const cells = state.cells.diamond;

    const bounds = visibleBounds(viewW, viewH);
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = bounds.maxX;
    const maxY = bounds.maxY;

    const a = size / 2;
    const iMin = Math.floor((minX + maxY) / size) - 6;
    const iMax = Math.ceil((maxX + maxY) / size) + 6;
    const jMin = Math.floor((minX - minY) / size) - 6;
    const jMax = Math.ceil((maxX - minY) / size) + 6;

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(0,0,0,${state.gridAlpha})`;
    for (let i = iMin; i <= iMax; i++) {
        for (let j = jMin; j <= jMax; j++) {
            const c = diamondToPixel(i, j, size);
            if (c.x < minX - size || c.x > maxX + size || c.y < minY - size || c.y > maxY + size) continue;
            strokeDiamond(c.x, c.y, a);
        }
    }

    ctx.fillStyle = state.fill;
    for (const [key] of cells) {
        const [i, j] = key.split(',').map(Number);
        const c = diamondToPixel(i, j, size);
        fillDiamond(c.x, c.y, a);
    }
}

function visibleBounds(viewW, viewH) {
    const inv = 1 / state.view.scale;
    const minX = (-state.view.panX) * inv;
    const minY = (-state.view.panY) * inv;
    const maxX = (viewW - state.view.panX) * inv;
    const maxY = (viewH - state.view.panY) * inv;
    return { minX, minY, maxX, maxY };
}

function pickCellKey(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const inv = 1 / state.view.scale;
    const x = (sx - state.view.panX) * inv;
    const y = (sy - state.view.panY) * inv;

    if (state.gridType === 'square') return pickSquareKey(x, y);
    if (state.gridType === 'diamond') return pickDiamondKey(x, y);
    return pickHexKey(x, y);
}

function pickSquareKey(x, y) {
    const size = state.cellSize;
    const col = Math.floor(x / size);
    const row = Math.floor(y / size);
    return `${col},${row}`;
}

function pickDiamondKey(x, y) {
    const size = state.cellSize;
    const i = Math.round((x + y) / size);
    const j = Math.round((x - y) / size);
    return `${i},${j}`;
}

function pickHexKey(x, y) {
    const size = state.cellSize;
    const root3 = Math.sqrt(3);
    const qf = (root3 / 3 * x - 1 / 3 * y) / size;
    const rf = (2 / 3 * y) / size;
    const cube = axialToCube(qf, rf);
    const rounded = cubeRound(cube);
    return `${rounded.q},${rounded.r}`;
}

function axialToCube(q, r) {
    return { x: q, z: r, y: -q - r };
}

function cubeRound(c) {
    let rx = Math.round(c.x);
    let ry = Math.round(c.y);
    let rz = Math.round(c.z);

    const xDiff = Math.abs(rx - c.x);
    const yDiff = Math.abs(ry - c.y);
    const zDiff = Math.abs(rz - c.z);

    if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
    else if (yDiff > zDiff) ry = -rx - rz;
    else rz = -rx - ry;

    return { q: rx, r: rz };
}

function hexToPixel(q, r, size) {
    const root3 = Math.sqrt(3);
    return {
        x: size * root3 * (q + r / 2),
        y: size * 1.5 * r
    };
}

function strokeHex(cx, cy, size) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 30);
        const x = cx + size * Math.cos(a);
        const y = cy + size * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
}

function fillHex(cx, cy, size) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 30);
        const x = cx + size * Math.cos(a);
        const y = cy + size * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
}

function diamondToPixel(i, j, size) {
    return {
        x: (i + j) * (size / 2),
        y: (i - j) * (size / 2)
    };
}

function strokeDiamond(cx, cy, a) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - a);
    ctx.lineTo(cx + a, cy);
    ctx.lineTo(cx, cy + a);
    ctx.lineTo(cx - a, cy);
    ctx.closePath();
    ctx.stroke();
}

function fillDiamond(cx, cy, a) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - a);
    ctx.lineTo(cx + a, cy);
    ctx.lineTo(cx, cy + a);
    ctx.lineTo(cx - a, cy);
    ctx.closePath();
    ctx.fill();
}

function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

init();
