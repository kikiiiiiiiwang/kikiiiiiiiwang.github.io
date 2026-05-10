const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const imageInput = document.getElementById('image-input');
const downloadBtn = document.getElementById('download-btn');

// UI Controls
const depthInput = document.getElementById('depth');
const blurInput = document.getElementById('blur');
const shineInput = document.getElementById('shine');
const specularInput = document.getElementById('specular');
const grainInput = document.getElementById('grain');
const angleInput = document.getElementById('angle');
const scaleInput = document.getElementById('scale');

const depthVal = document.getElementById('depth-val');
const blurVal = document.getElementById('blur-val');
const shineVal = document.getElementById('shine-val');
const specularVal = document.getElementById('specular-val');
const grainVal = document.getElementById('grain-val');
const angleVal = document.getElementById('angle-val');
const scaleVal = document.getElementById('scale-val');

// App State
let config = {
    depth: 10,
    blur: 5,
    shine: 1.5,
    specular: 30,
    grain: 0.2,
    angle: 135,
    scale: 1.0,
    posX: 0,
    posY: 0
};

let sourceImg = null;
let isDragging = false;
let startX, startY;

// Offscreen canvases for processing
const heightCanvas = document.createElement('canvas');
const hCtx = heightCanvas.getContext('2d', { willReadFrequently: true });

function init() {
    canvas.width = 1000;
    canvas.height = 1000;
    heightCanvas.width = canvas.width;
    heightCanvas.height = canvas.height;
    
    setupEventListeners();
    drawPlaceholder();
}

function setupEventListeners() {
    dropZone.onclick = () => imageInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#fff'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border-color)'; };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        handleFile(e.dataTransfer.files[0]);
    };
    imageInput.onchange = (e) => handleFile(e.target.files[0]);

    // Parameter Updates
    const updateUI = (key, val, display) => {
        config[key] = parseFloat(val);
        if (display) display.textContent = val;
        draw();
    };

    depthInput.oninput = (e) => updateUI('depth', e.target.value, depthVal);
    blurInput.oninput = (e) => updateUI('blur', e.target.value, blurVal);
    shineInput.oninput = (e) => updateUI('shine', e.target.value, shineVal);
    specularInput.oninput = (e) => updateUI('specular', e.target.value, specularVal);
    grainInput.oninput = (e) => updateUI('grain', e.target.value, grainVal);
    angleInput.oninput = (e) => updateUI('angle', e.target.value, angleVal);
    scaleInput.oninput = (e) => updateUI('scale', e.target.value, scaleVal);

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
        link.download = `metal-chrome-${Date.now()}.png`;
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
            const ratio = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.7;
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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#444';
    ctx.font = '20px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('上传图形以开启金属质感转换', canvas.width / 2, canvas.height / 2);
}

function draw() {
    if (!sourceImg) return;

    // 1. Generate Height Map (blurred version of the mask)
    hCtx.clearRect(0, 0, heightCanvas.width, heightCanvas.height);
    hCtx.fillStyle = 'black';
    hCtx.fillRect(0, 0, heightCanvas.width, heightCanvas.height);
    
    hCtx.save();
    hCtx.filter = `blur(${config.blur}px)`;
    hCtx.translate(heightCanvas.width / 2 + config.posX, heightCanvas.height / 2 + config.posY);
    hCtx.scale(config.scale, config.scale);
    hCtx.drawImage(sourceImg, -sourceImg.width / 2, -sourceImg.height / 2);
    hCtx.restore();

    const imgData = hCtx.getImageData(0, 0, heightCanvas.width, heightCanvas.height);
    const data = imgData.data;
    const width = heightCanvas.width;
    const height = heightCanvas.height;

    // 2. Final Render Canvas
    const outputData = ctx.createImageData(width, height);
    const out = outputData.data;

    // Light direction
    const rad = (config.angle * Math.PI) / 180;
    const lx = Math.cos(rad);
    const ly = Math.sin(rad);
    const lz = 0.5; // Light height

    const depth = config.depth;
    const shine = config.shine;
    const specularExp = config.specular;
    const grainAmount = config.grain;

    // Helper to get height value (0-255)
    const getHeight = (i) => {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        // Use brightness weighted by alpha
        const brightness = (r + g + b) / 3;
        // If the image is mostly opaque, use brightness. If it has transparency, use alpha.
        return (a < 250) ? a : brightness;
    };

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            const h = getHeight(idx);
            if (h < 2) {
                // Background
                const g = (Math.random() - 0.5) * grainAmount * 20;
                out[idx] = out[idx + 1] = out[idx + 2] = 250 + g; // White background for Variant style
                out[idx + 3] = 255;
                continue;
            }

            // Calculate normals using Sobel-like gradient
            const hL = getHeight((y * width + (x - 1)) * 4);
            const hR = getHeight((y * width + (x + 1)) * 4);
            const hU = getHeight(((y - 1) * width + x) * 4);
            const hD = getHeight(((y + 1) * width + x) * 4);

            // Normal vector (Nx, Ny, Nz)
            let nx = (hL - hR) / 255 * depth;
            let ny = (hU - hD) / 255 * depth;
            let nz = 1.0;

            // Normalize
            const mag = Math.sqrt(nx * nx + ny * ny + nz * nz);
            nx /= mag;
            ny /= mag;
            nz /= mag;

            // Lighting (Phong-like)
            // Dot product for diffuse
            const dot = nx * lx + ny * ly + nz * lz;
            const diffuse = Math.max(0, dot);

            // Specular
            // Reflection vector R = 2 * (N . L) * N - L
            const rx = 2 * dot * nx - lx;
            const ry = 2 * dot * ny - ly;
            const rz = 2 * dot * nz - lz;
            const spec = Math.pow(Math.max(0, rz), specularExp) * shine;

            // Base color (metallic grey)
            const base = 150 + diffuse * 50;
            let color = base + spec * 200;
            
            // Add grain
            const grain = (Math.random() - 0.5) * grainAmount * 80;
            color += grain;

            // Clamp and set
            const final = Math.min(255, Math.max(0, color));
            out[idx] = out[idx + 1] = out[idx + 2] = final;
            out[idx + 3] = 255;
        }
    }

    // Add a global grainy texture overlay if grain > 0
    if (config.grain > 0) {
        for (let i = 0; i < out.length; i += 4) {
            const g = (Math.random() - 0.5) * config.grain * 30;
            out[i] += g;
            out[i+1] += g;
            out[i+2] += g;
        }
    }

    ctx.putImageData(outputData, 0, 0);
}

init();
