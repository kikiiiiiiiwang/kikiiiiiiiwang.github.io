const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const imageInput = document.getElementById('image-input');
const downloadBtn = document.getElementById('download-btn');

// UI Controls
const edgeInput = document.getElementById('edge-strength');
const edgeVal = document.getElementById('edge-val');
const contrastInput = document.getElementById('contrast');
const contrastVal = document.getElementById('contrast-val');
const smoothInput = document.getElementById('smooth');
const smoothVal = document.getElementById('smooth-val');
const grainInput = document.getElementById('grain');
const grainVal = document.getElementById('grain-val');
const invertInput = document.getElementById('invert');
const scaleInput = document.getElementById('scale');
const scaleVal = document.getElementById('scale-val');

// App State
let config = {
    edge: 1.5,
    contrast: 128,
    smooth: 0,
    grain: 0.2,
    invert: false,
    scale: 1.0,
    posX: 0,
    posY: 0
};

let sourceImg = null;
let isDragging = false;
let startX, startY;

// Offscreen canvases for processing
const procCanvas = document.createElement('canvas');
const pCtx = procCanvas.getContext('2d', { willReadFrequently: true });

function init() {
    canvas.width = 1000;
    canvas.height = 1000;
    procCanvas.width = canvas.width;
    procCanvas.height = canvas.height;
    
    setupEventListeners();
    drawPlaceholder();
}

function setupEventListeners() {
    dropZone.onclick = () => imageInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#000'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border-color)'; };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        handleFile(e.dataTransfer.files[0]);
    };
    imageInput.onchange = (e) => handleFile(e.target.files[0]);

    // Parameter Updates
    const update = (key, val, display) => {
        config[key] = parseFloat(val);
        if (display) display.textContent = val;
        draw();
    };

    edgeInput.oninput = (e) => update('edge', e.target.value, edgeVal);
    contrastInput.oninput = (e) => update('contrast', e.target.value, contrastVal);
    smoothInput.oninput = (e) => update('smooth', e.target.value, smoothVal);
    grainInput.oninput = (e) => update('grain', e.target.value, grainVal);
    invertInput.onchange = (e) => { config.invert = e.target.checked; draw(); };
    scaleInput.oninput = (e) => update('scale', e.target.value, scaleVal);

    // Interaction
    canvas.onmousedown = (e) => {
        if (!sourceImg) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
    };

    window.onmousemove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        config.posX += dx;
        config.posY += dy;
        startX = e.clientX;
        startY = e.clientY;
        draw();
    };

    window.onmouseup = () => { isDragging = false; };

    downloadBtn.onclick = () => {
        if (!sourceImg) return;
        const link = document.createElement('a');
        link.download = `xerox-art-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
}

function handleFile(file) {
    if (!file || !file.type.match('image.*')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            sourceImg = img;
            const ratio = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.8;
            config.scale = ratio;
            scaleInput.value = ratio;
            scaleVal.textContent = ratio.toFixed(1);
            config.posX = 0;
            config.posY = 0;
            draw();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function drawPlaceholder() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ccc';
    ctx.font = '20px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('导入图片以开启复印风格转换', canvas.width / 2, canvas.height / 2);
}

function draw() {
    if (!sourceImg) return;

    // 1. Draw to offscreen canvas
    pCtx.fillStyle = 'white';
    pCtx.fillRect(0, 0, procCanvas.width, procCanvas.height);
    
    pCtx.save();
    if (config.smooth > 0) pCtx.filter = `blur(${config.smooth}px)`;
    pCtx.translate(procCanvas.width / 2 + config.posX, procCanvas.height / 2 + config.posY);
    pCtx.scale(config.scale, config.scale);
    pCtx.drawImage(sourceImg, -sourceImg.width / 2, -sourceImg.height / 2);
    pCtx.restore();

    const imgData = pCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
    const data = imgData.data;
    const width = procCanvas.width;
    const height = procCanvas.height;

    // 2. High Contrast Edge Detection & Thresholding
    const outputData = ctx.createImageData(width, height);
    const out = outputData.data;

    const threshold = config.contrast;
    const edgeStrength = config.edge;
    const grainAmount = config.grain;
    const invert = config.invert;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            // Grayscale
            const getLum = (ix) => (data[ix] * 0.299 + data[ix+1] * 0.587 + data[ix+2] * 0.114);
            const lum = getLum(idx);

            // Simple Sobel-like edge detection
            const lumL = getLum((y * width + (x - 1)) * 4);
            const lumR = getLum((y * width + (x + 1)) * 4);
            const lumU = getLum(((y - 1) * width + x) * 4);
            const lumD = getLum(((y + 1) * width + x) * 4);

            const dx = (lumR - lumL);
            const dy = (lumD - lumU);
            const edge = Math.sqrt(dx * dx + dy * dy) * edgeStrength;

            // Combine edge and luminosity for high contrast look
            // We want parts that are either very dark OR part of a strong edge to be black
            let val = (lum < threshold || edge > 40) ? 0 : 255;

            if (invert) val = 255 - val;

            // Add grain
            if (grainAmount > 0) {
                const grain = (Math.random() - 0.5) * grainAmount * 150;
                val = Math.min(255, Math.max(0, val + grain));
            }

            out[idx] = out[idx + 1] = out[idx + 2] = val;
            out[idx + 3] = 255;
        }
    }

    ctx.putImageData(outputData, 0, 0);
}

init();
