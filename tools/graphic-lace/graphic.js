const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const miniPreview = document.getElementById('mini-preview');

const thresholdInput = document.getElementById('threshold');
const patternSizeInput = document.getElementById('pattern-size');
const lineWeightInput = document.getElementById('line-weight');
const imgScaleInput = document.getElementById('img-scale');
const downloadBtn = document.getElementById('download-btn');

let config = {
    threshold: 128,
    patternSize: 6,
    lineWeight: 1,
    scale: 1,
    posX: 0,
    posY: 0
};

let sourceImg = null;
let isDragging = false;
let startX, startY;

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
    // File Upload Handlers
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    };
    fileInput.onchange = (e) => handleFile(e.target.files[0]);

    // Parameter Handlers
    thresholdInput.oninput = (e) => { config.threshold = parseInt(e.target.value); draw(); };
    patternSizeInput.oninput = (e) => { config.patternSize = parseInt(e.target.value); draw(); };
    lineWeightInput.oninput = (e) => { config.lineWeight = parseFloat(e.target.value); draw(); };
    imgScaleInput.oninput = (e) => { config.scale = parseFloat(e.target.value); draw(); };

    // Drag Interaction
    canvas.onmousedown = (e) => {
        if (!sourceImg) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        canvas.style.cursor = 'grabbing';
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
        canvas.style.cursor = 'crosshair';
    };

    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = `graphic-lace-${Date.now()}.png`;
        link.href = canvas.toDataURL();
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
            miniPreview.style.backgroundImage = `url(${e.target.result})`;
            miniPreview.style.display = 'block';
            
            // Auto-scale to fit canvas initially
            const ratio = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.8;
            config.scale = ratio;
            imgScaleInput.value = ratio;
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
    ctx.fillStyle = '#888';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('请导入图片或矢量图形以开始转换', canvas.width / 2, canvas.height / 2);
}

function draw() {
    if (!sourceImg) return;

    // 1. Draw transformed image to sample canvas
    sCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    sCtx.save();
    sCtx.translate(sampleCanvas.width / 2 + config.posX, sampleCanvas.height / 2 + config.posY);
    sCtx.scale(config.scale, config.scale);
    sCtx.drawImage(sourceImg, -sourceImg.width / 2, -sourceImg.height / 2);
    sCtx.restore();

    // 2. Main Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imageData = sCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
    const data = imageData.data;
    const step = config.patternSize;

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = config.lineWeight;

    for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
            const index = (y * sampleCanvas.width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const alpha = data[index + 3];

            // Grayscale conversion
            const brightness = (r + g + b) / 3;

            // Threshold check (Darker areas or opaque areas are rendered)
            if (alpha > 50 && brightness < config.threshold) {
                drawX(x, y, step * 0.8);
            }
        }
    }
}

function drawX(x, y, size) {
    const half = size / 2;
    ctx.beginPath();
    ctx.moveTo(x - half, y - half);
    ctx.lineTo(x + half, y + half);
    ctx.moveTo(x + half, y - half);
    ctx.lineTo(x - half, y + half);
    ctx.stroke();
}

init();
