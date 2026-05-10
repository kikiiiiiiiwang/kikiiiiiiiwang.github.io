const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const imageInput = document.getElementById('image-input');
const downloadBtn = document.getElementById('download-btn');

// UI Controls
const densityInput = document.getElementById('density');
const densityVal = document.getElementById('density-val');
const thresholdInput = document.getElementById('threshold');
const thresholdVal = document.getElementById('threshold-val');
const weightInput = document.getElementById('weight');
const weightVal = document.getElementById('weight-val');
const scaleInput = document.getElementById('scale');
const scaleVal = document.getElementById('scale-val');
const fgColorInput = document.getElementById('fg-color');
const bgColorInput = document.getElementById('bg-color');
const modeBtns = document.querySelectorAll('.mode-btn');

// App State
let config = {
    density: 8,
    threshold: 128,
    weight: 1.5,
    scale: 1.0,
    fgColor: '#000000',
    bgColor: '#ffffff',
    mode: 'x-stitch',
    posX: 0,
    posY: 0
};

let sourceImg = null;
let isDragging = false;
let startX, startY;

// Offscreen canvas for sampling
const sampleCanvas = document.createElement('canvas');
const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

function init() {
    canvas.width = 1000;
    canvas.height = 1000;
    sampleCanvas.width = canvas.width;
    sampleCanvas.height = canvas.height;
    
    setupEventListeners();
    drawPlaceholder();
}

function setupEventListeners() {
    // File Upload
    dropZone.onclick = () => imageInput.click();
    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent)';
    };
    dropZone.ondragleave = () => {
        dropZone.style.borderColor = 'var(--border-color)';
    };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        handleFile(e.dataTransfer.files[0]);
    };
    imageInput.onchange = (e) => handleFile(e.target.files[0]);

    // UI Updates
    densityInput.oninput = (e) => {
        config.density = parseInt(e.target.value);
        densityVal.textContent = config.density;
        draw();
    };
    thresholdInput.oninput = (e) => {
        config.threshold = parseInt(e.target.value);
        thresholdVal.textContent = config.threshold;
        draw();
    };
    weightInput.oninput = (e) => {
        config.weight = parseFloat(e.target.value);
        weightVal.textContent = config.weight;
        draw();
    };
    scaleInput.oninput = (e) => {
        config.scale = parseFloat(e.target.value);
        scaleVal.textContent = config.scale.toFixed(1);
        draw();
    };
    fgColorInput.oninput = (e) => {
        config.fgColor = e.target.value;
        draw();
    };
    bgColorInput.oninput = (e) => {
        config.bgColor = e.target.value;
        draw();
    };

    modeBtns.forEach(btn => {
        btn.onclick = () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            config.mode = btn.dataset.mode;
            draw();
        };
    });

    // Canvas Interaction (Pan)
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

    window.onmouseup = () => {
        isDragging = false;
    };

    downloadBtn.onclick = () => {
        if (!sourceImg) return;
        const link = document.createElement('a');
        link.download = `lace-effect-${Date.now()}.png`;
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
            // Center and fit
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
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('请导入图片开始生成', canvas.width / 2, canvas.height / 2);
}

function draw() {
    if (!sourceImg) return;

    // 1. Sample the image on offscreen canvas
    sCtx.fillStyle = 'white';
    sCtx.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    sCtx.save();
    sCtx.translate(sampleCanvas.width / 2 + config.posX, sampleCanvas.height / 2 + config.posY);
    sCtx.scale(config.scale, config.scale);
    sCtx.drawImage(sourceImg, -sourceImg.width / 2, -sourceImg.height / 2);
    sCtx.restore();

    const imageData = sCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
    const data = imageData.data;

    // 2. Main Render
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = config.fgColor;
    ctx.fillStyle = config.fgColor;
    ctx.lineWidth = config.weight;
    ctx.lineCap = 'round';

    const step = config.density;
    const halfStep = step / 2;
    for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
            // Sample from the center of the cell
            const sampleX = Math.floor(x + halfStep);
            const sampleY = Math.floor(y + halfStep);
            
            if (sampleX >= sampleCanvas.width || sampleY >= sampleCanvas.height) continue;

            const index = (sampleY * sampleCanvas.width + sampleX) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];

            const brightness = (r + g + b) / 3;

            if (a > 50 && brightness < config.threshold) {
                renderPattern(x + halfStep, y + halfStep, step);
            }
        }
    }
}

function renderPattern(x, y, size) {
    const s = size * 0.8;
    const half = s / 2;

    switch (config.mode) {
        case 'x-stitch':
            ctx.beginPath();
            ctx.moveTo(x - half, y - half);
            ctx.lineTo(x + half, y + half);
            ctx.moveTo(x + half, y - half);
            ctx.lineTo(x - half, y + half);
            ctx.stroke();
            break;
        case 'dot':
            ctx.beginPath();
            ctx.arc(x, y, half, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'lace-star':
            drawLaceStar(x, y, s);
            break;
        case 'mesh':
            drawMesh(x, y, size);
            break;
    }
}

function drawLaceStar(x, y, s) {
    const half = s / 2;
    const quarter = s / 4;
    ctx.beginPath();
    // Cross
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y);
    ctx.moveTo(x, y - half);
    ctx.lineTo(x, y + half);
    // X
    ctx.moveTo(x - quarter, y - quarter);
    ctx.lineTo(x + quarter, y + quarter);
    ctx.moveTo(x + quarter, y - quarter);
    ctx.lineTo(x - quarter, y + quarter);
    ctx.stroke();
}

function drawMesh(x, y, size) {
    const half = size / 2;
    ctx.beginPath();
    ctx.rect(x - half, y - half, size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
}

init();
