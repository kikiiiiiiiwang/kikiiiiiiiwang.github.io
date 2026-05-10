const gridCanvas = document.getElementById('grid-canvas');
const textPreview = document.getElementById('text-preview');
const previewTextInput = document.getElementById('preview-text');
const moduleGapInput = document.getElementById('module-gap');
const moduleScaleInput = document.getElementById('module-scale');
const gapVal = document.getElementById('gap-val');
const weightVal = document.getElementById('weight-val');
const clearGridBtn = document.getElementById('clear-grid');
const downloadBtn = document.getElementById('download-btn');
const sizeBtns = document.querySelectorAll('.size-btn');
const shapeBtns = document.querySelectorAll('.shape-btn');
const fontUpload = document.getElementById('font-upload');
const fontFamilySelect = document.getElementById('font-family-select');

// App State
let config = {
    gridSize: 8,
    activeShape: 'square',
    moduleGap: 0,
    moduleScale: 1.0,
    baseFont: 'sans-serif',
    // gridData stores the "Pattern Mask"
    // By default, we'll fill it so it's all "on"
    gridData: {} 
};

// Offscreen sampling canvas
const sampleCanvas = document.createElement('canvas');
const sampleCtx = sampleCanvas.getContext('2d');

function init() {
    // Initialize gridData with all cells "on" for a default solid look
    resetGridData(true);
    
    generateGrid();
    setupEventListeners();
    updatePreview();
}

function resetGridData(state = true) {
    config.gridData = {};
    for (let y = 0; y < 16; y++) { // Max grid size
        for (let x = 0; x < 16; x++) {
            if (state) {
                config.gridData[`${x},${y}`] = 'square';
            }
        }
    }
}

function setupEventListeners() {
    // Size Presets
    sizeBtns.forEach(btn => {
        btn.onclick = () => {
            sizeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            config.gridSize = parseInt(btn.dataset.size);
            resetGridData(true);
            generateGrid();
            updatePreview();
        };
    });

    // Shape Selector
    shapeBtns.forEach(btn => {
        btn.onclick = () => {
            shapeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            config.activeShape = btn.dataset.shape;
        };
    });

    // Font Handling
    fontUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const fontName = 'CustomFont_' + Date.now();
            const reader = new FileReader();
            reader.onload = async (event) => {
                const fontFace = new FontFace(fontName, event.target.result);
                await fontFace.load();
                document.fonts.add(fontFace);
                
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = file.name;
                fontFamilySelect.appendChild(option);
                fontFamilySelect.value = fontName;
                config.baseFont = fontName;
                updatePreview();
                generateGrid(); // Refresh ghost background
            };
            reader.readAsArrayBuffer(file);
        }
    };

    fontFamilySelect.onchange = (e) => {
        config.baseFont = e.target.value;
        updatePreview();
        generateGrid();
    };

    // Inputs
    previewTextInput.oninput = () => {
        updatePreview();
        generateGrid(); // Ghost update
    };
    
    moduleGapInput.oninput = (e) => {
        config.moduleGap = parseInt(e.target.value);
        gapVal.textContent = config.moduleGap;
        updatePreview();
    };
    
    moduleScaleInput.oninput = (e) => {
        config.moduleScale = parseFloat(e.target.value);
        weightVal.textContent = config.moduleScale.toFixed(1);
        updatePreview();
    };

    // Actions
    clearGridBtn.onclick = () => {
        resetGridData(false);
        generateGrid();
        updatePreview();
    };

    downloadBtn.onclick = downloadArt;
}

/**
 * Samples a character and returns an array of brightness values
 */
function sampleCharacter(char, size) {
    sampleCanvas.width = size;
    sampleCanvas.height = size;
    sampleCtx.clearRect(0, 0, size, size);
    
    sampleCtx.fillStyle = 'black';
    sampleCtx.font = `900 ${size}px ${config.baseFont}`;
    sampleCtx.textAlign = 'center';
    sampleCtx.textBaseline = 'middle';
    sampleCtx.fillText(char, size / 2, size / 2);
    
    const imgData = sampleCtx.getImageData(0, 0, size, size).data;
    const samples = [];
    for (let i = 0; i < imgData.length; i += 4) {
        // Just use alpha or average of RGB as intensity
        samples.push(imgData[i + 3] > 128 ? 1 : 0);
    }
    return samples;
}

function generateGrid() {
    gridCanvas.innerHTML = '';
    gridCanvas.style.gridTemplateColumns = `repeat(${config.gridSize}, 40px)`;
    gridCanvas.style.gridTemplateRows = `repeat(${config.gridSize}, 40px)`;

    // Sample the first letter of preview text as a background ghost
    const firstChar = (previewTextInput.value || 'A')[0].toUpperCase();
    const samples = sampleCharacter(firstChar, config.gridSize);

    for (let y = 0; y < config.gridSize; y++) {
        for (let x = 0; x < config.gridSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            const isPartOfChar = samples[y * config.gridSize + x];
            if (isPartOfChar) {
                cell.classList.add('ghost-active');
            }

            const key = `${x},${y}`;
            if (config.gridData[key]) {
                cell.innerHTML = `<div class="module ${config.gridData[key]}"></div>`;
            }
            
            cell.onclick = () => toggleModule(cell, x, y);
            gridCanvas.appendChild(cell);
        }
    }
}

function toggleModule(cell, x, y) {
    const key = `${x},${y}`;
    if (config.gridData[key]) {
        // If it's the same shape, remove it. If different, change it.
        if (config.gridData[key] === config.activeShape) {
            delete config.gridData[key];
            cell.innerHTML = '';
        } else {
            config.gridData[key] = config.activeShape;
            cell.innerHTML = `<div class="module ${config.activeShape}"></div>`;
        }
    } else {
        config.gridData[key] = config.activeShape;
        cell.innerHTML = `<div class="module ${config.activeShape}"></div>`;
    }
    updatePreview();
}

function updatePreview() {
    textPreview.innerHTML = '';
    const text = previewTextInput.value.toUpperCase();
    if (!text) return;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charContainer = document.createElement('div');
        charContainer.className = 'preview-char';
        
        const cellSize = 10; 
        charContainer.style.gridTemplateColumns = `repeat(${config.gridSize}, ${cellSize}px)`;
        charContainer.style.gridTemplateRows = `repeat(${config.gridSize}, ${cellSize}px)`;
        charContainer.style.gap = `${config.moduleGap}px`;

        const samples = sampleCharacter(char, config.gridSize);

        for (let y = 0; y < config.gridSize; y++) {
            for (let x = 0; x < config.gridSize; x++) {
                const cell = document.createElement('div');
                cell.style.width = `${cellSize}px`;
                cell.style.height = `${cellSize}px`;
                
                const isPartOfChar = samples[y * config.gridSize + x];
                const key = `${x},${y}`;
                const patternShape = config.gridData[key];

                if (isPartOfChar && patternShape) {
                    const module = document.createElement('div');
                    module.className = `module ${patternShape}`;
                    module.style.transform = `scale(${config.moduleScale})`;
                    cell.appendChild(module);
                }
                charContainer.appendChild(cell);
            }
        }
        textPreview.appendChild(charContainer);
    }
}

function downloadArt() {
    const canvasExport = document.createElement('canvas');
    const text = previewTextInput.value.toUpperCase();
    if (!text) return;

    const cellSize = 20;
    const charGap = 30;
    const padding = 60;
    
    canvasExport.width = (config.gridSize * cellSize * text.length) + (charGap * (text.length - 1)) + padding * 2;
    canvasExport.height = (config.gridSize * cellSize) + padding * 2;
    
    const ctx = canvasExport.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasExport.width, canvasExport.height);
    ctx.fillStyle = 'black';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const samples = sampleCharacter(char, config.gridSize);
        const xBase = padding + i * (config.gridSize * cellSize + charGap);
        const yBase = padding;
        
        for (let y = 0; y < config.gridSize; y++) {
            for (let x = 0; x < config.gridSize; x++) {
                const isPart = samples[y * config.gridSize + x];
                const key = `${x},${y}`;
                const shape = config.gridData[key];
                
                if (isPart && shape) {
                    const px = xBase + x * cellSize;
                    const py = yBase + y * cellSize;
                    const s = cellSize * config.moduleScale;
                    const offset = (cellSize - s) / 2;
                    drawModule(ctx, px + offset, py + offset, s, shape);
                }
            }
        }
    }
    
    const link = document.createElement('a');
    link.download = `modular-font-${Date.now()}.png`;
    link.href = canvasExport.toDataURL();
    link.click();
}

function drawModule(ctx, x, y, s, shape) {
    ctx.beginPath();
    if (shape === 'square') {
        ctx.rect(x, y, s, s);
    } else if (shape === 'circle') {
        ctx.arc(x + s/2, y + s/2, s/2, 0, Math.PI * 2);
    } else if (shape === 'arc-tl') {
        ctx.moveTo(x + s, y); ctx.lineTo(x, y); ctx.lineTo(x, y + s); ctx.arcTo(x, y, x + s, y, s);
    } else if (shape === 'arc-tr') {
        ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.arcTo(x + s, y, x, y, s);
    } else if (shape === 'arc-bl') {
        ctx.moveTo(x, y); ctx.lineTo(x, y + s); ctx.lineTo(x + s, y + s); ctx.arcTo(x, y + s, x, y, s);
    } else if (shape === 'arc-br') {
        ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.arcTo(x + s, y + s, x + s, y, s);
    }
    ctx.fill();
}

init();
