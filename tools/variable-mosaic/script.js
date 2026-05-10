const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('svg-input');

// Controls
const densityInput = document.getElementById('density');
const baseSizeInput = document.getElementById('base-size');
const variationInput = document.getElementById('variation');
const scaleInput = document.getElementById('scale');
const colorModeSelect = document.getElementById('color-mode');
const showGridCheckbox = document.getElementById('show-grid');
const downloadBtn = document.getElementById('download-btn');

// Value displays
const densityVal = document.getElementById('density-val');
const sizeVal = document.getElementById('size-val');
const varVal = document.getElementById('var-val');
const scaleVal = document.getElementById('scale-val');

let originalImage = null;
let offscreenCanvas = document.createElement('canvas');
let offscreenCtx = offscreenCanvas.getContext('2d');

// Initialize
function init() {
    canvas.width = 800;
    canvas.height = 800;
    
    // Event listeners
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#000';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#eee';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#eee';
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'image/svg+xml') {
            handleFile(file);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    // Control updates
    [densityInput, baseSizeInput, variationInput, scaleInput, colorModeSelect, showGridCheckbox].forEach(input => {
        input.addEventListener('input', () => {
            updateValueDisplays();
            draw();
        });
    });

    downloadBtn.addEventListener('click', downloadCanvas);

    updateValueDisplays();
    drawPlaceholder();
}

function updateValueDisplays() {
    densityVal.textContent = densityInput.value;
    sizeVal.textContent = baseSizeInput.value;
    varVal.textContent = variationInput.value;
    scaleVal.textContent = scaleInput.value;
}

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Fix for SVGs without explicit width/height
            if (img.width === 0 || img.height === 0) {
                img.width = 800;
                img.height = 800;
            }
            originalImage = img;
            draw();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function drawPlaceholder() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f0f0f0';
    ctx.font = '12px Space Mono';
    ctx.textAlign = 'center';
    ctx.fillText('PLEASE UPLOAD AN SVG FILE', canvas.width / 2, canvas.height / 2);
}

function draw() {
    if (!originalImage) return;

    const density = parseInt(densityInput.value);
    const baseSize = parseFloat(baseSizeInput.value);
    const variation = parseFloat(variationInput.value);
    const scale = parseFloat(scaleInput.value);
    const colorMode = colorModeSelect.value;
    const showGrid = showGridCheckbox.checked;

    // Set canvas size based on image aspect ratio
    const aspect = originalImage.width / originalImage.height;
    if (aspect > 1) {
        canvas.width = 1000;
        canvas.height = 1000 / aspect;
    } else {
        canvas.height = 1000;
        canvas.width = 1000 * aspect;
    }

    // Setup offscreen sampling canvas
    offscreenCanvas.width = density;
    offscreenCanvas.height = Math.round(density / aspect);
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    offscreenCtx.drawImage(originalImage, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    const sampleData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height).data;

    // Main draw
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / offscreenCanvas.width;
    const cellH = canvas.height / offscreenCanvas.height;

    if (showGrid) {
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= offscreenCanvas.width; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellW, 0);
            ctx.lineTo(i * cellW, canvas.height);
            ctx.stroke();
        }
        for (let j = 0; j <= offscreenCanvas.height; j++) {
            ctx.beginPath();
            ctx.moveTo(0, j * cellH);
            ctx.lineTo(canvas.width, j * cellH);
            ctx.stroke();
        }
    }

    for (let y = 0; y < offscreenCanvas.height; y++) {
        for (let x = 0; x < offscreenCanvas.width; x++) {
            const idx = (y * offscreenCanvas.width + x) * 4;
            const r = sampleData[idx];
            const g = sampleData[idx + 1];
            const b = sampleData[idx + 2];
            const a = sampleData[idx + 3];

            // Brightness determines the size variation
            const brightness = (r + g + b) / 3 / 255;
            const alpha = a / 255;
            
            // Only draw if there's content (alpha > 0)
            if (alpha > 0.1) {
                // Size logic: based on brightness and variation
                // Higher brightness -> smaller or larger? Let's make it customizable or intuitive
                // Usually, denser areas (darker) might want bigger blocks or vice-versa
                // Let's use alpha/brightness to modulate size
                let sizeFactor = baseSize + (1 - brightness) * variation;
                
                // Final size in pixels
                const drawW = cellW * sizeFactor * scale;
                const drawH = cellH * sizeFactor * scale;

                // Color logic
                if (colorMode === 'original') {
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                } else if (colorMode === 'mono-dark') {
                    ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
                } else if (colorMode === 'mono-light') {
                    ctx.fillStyle = `rgba(200, 200, 200, ${brightness})`;
                } else if (colorMode === 'random') {
                    ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 50%)`;
                }

                // Center the square in the cell
                const posX = x * cellW + (cellW - drawW) / 2;
                const posY = y * cellH + (cellH - drawH) / 2;

                ctx.fillRect(posX, posY, drawW, drawH);
            }
        }
    }
}

function downloadCanvas() {
    const link = document.createElement('a');
    link.download = 'variable-mosaic.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

init();
