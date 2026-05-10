const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const textInput = document.getElementById('text-input');
const fontFamilySelect = document.getElementById('font-family');
const fontUploadInput = document.getElementById('font-upload');
const fontStatus = document.getElementById('font-status');
const patternSizeInput = document.getElementById('pattern-size');
const lineWeightInput = document.getElementById('line-weight');
const sizeValDisplay = document.getElementById('size-val');
const downloadBtn = document.getElementById('download-btn');
const toggleBtns = document.querySelectorAll('.toggle-btn');

// Multi-Text Management
const addTextBtn = document.getElementById('add-text-btn');
const deleteTextBtn = document.getElementById('delete-text-btn');
const layerList = document.getElementById('layer-list');

// Transform Controls
const fontScaleInput = document.getElementById('font-scale');
const fontRotationInput = document.getElementById('font-rotation');
const fontSkewInput = document.getElementById('font-skew');

// Global Configuration
let globalConfig = {
    patternSize: 8,
    lineWeight: 1.5,
    mode: 'x'
};

// Text Objects (Layers)
let textLayers = [
    {
        id: Date.now(),
        text: "Art",
        font: "serif",
        scale: 1,
        rotation: 0,
        skew: 0,
        posX: 0,
        posY: 0
    }
];
let activeLayerId = textLayers[0].id;

// Drag state
let isDragging = false;
let startX, startY;

// Offscreen canvas for sampling
const sampleCanvas = document.createElement('canvas');
const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

function init() {
    canvas.width = 1200;
    canvas.height = 800;
    sampleCanvas.width = canvas.width;
    sampleCanvas.height = canvas.height;
    
    setupEventListeners();
    updateLayerList();
    syncUIWithActiveLayer();
    draw();
}

function getActiveLayer() {
    return textLayers.find(l => l.id === activeLayerId);
}

function syncUIWithActiveLayer() {
    const layer = getActiveLayer();
    if (!layer) return;

    textInput.value = layer.text;
    fontFamilySelect.value = layer.font;
    fontScaleInput.value = layer.scale;
    fontRotationInput.value = layer.rotation;
    fontSkewInput.value = layer.skew;
}

function updateLayerList() {
    layerList.innerHTML = '';
    textLayers.forEach(layer => {
        const item = document.createElement('div');
        item.className = `layer-item ${layer.id === activeLayerId ? 'active' : ''}`;
        item.textContent = layer.text || '(空)';
        item.onclick = () => {
            activeLayerId = layer.id;
            updateLayerList();
            syncUIWithActiveLayer();
            draw();
        };
        layerList.appendChild(item);
    });
}

function setupEventListeners() {
    // Layer Management
    addTextBtn.onclick = () => {
        const newLayer = {
            id: Date.now(),
            text: "New Text",
            font: "serif",
            scale: 1,
            rotation: 0,
            skew: 0,
            posX: (Math.random() - 0.5) * 100,
            posY: (Math.random() - 0.5) * 100
        };
        textLayers.push(newLayer);
        activeLayerId = newLayer.id;
        updateLayerList();
        syncUIWithActiveLayer();
        draw();
    };

    deleteTextBtn.onclick = () => {
        if (textLayers.length <= 1) {
            alert("至少保留一个文字图层");
            return;
        }
        textLayers = textLayers.filter(l => l.id !== activeLayerId);
        activeLayerId = textLayers[0].id;
        updateLayerList();
        syncUIWithActiveLayer();
        draw();
    };

    // Input Controls
    textInput.oninput = (e) => {
        const layer = getActiveLayer();
        if (layer) {
            layer.text = e.target.value;
            updateLayerList();
            draw();
        }
    };

    fontFamilySelect.onchange = (e) => {
        const layer = getActiveLayer();
        if (layer) {
            layer.font = e.target.value;
            draw();
        }
    };

    fontUploadInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fontName = 'CustomLaceFont_' + Date.now();
        const reader = new FileReader();
        reader.onload = async (event) => {
            const fontData = event.target.result;
            const fontFace = new FontFace(fontName, fontData);
            try {
                const loadedFace = await fontFace.load();
                document.fonts.add(loadedFace);
                
                const layer = getActiveLayer();
                if (layer) {
                    layer.font = fontName;
                    const option = document.createElement('option');
                    option.value = fontName;
                    option.textContent = `已导入: ${file.name}`;
                    option.selected = true;
                    fontFamilySelect.appendChild(option);
                    draw();
                }
            } catch (err) {
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Global Patterns
    patternSizeInput.oninput = (e) => {
        globalConfig.patternSize = parseInt(e.target.value);
        sizeValDisplay.textContent = globalConfig.patternSize;
        draw();
    };

    lineWeightInput.oninput = (e) => {
        globalConfig.lineWeight = parseFloat(e.target.value);
        draw();
    };

    // Transforms
    fontScaleInput.oninput = (e) => {
        const layer = getActiveLayer();
        if (layer) {
            layer.scale = parseFloat(e.target.value);
            draw();
        }
    };
    fontRotationInput.oninput = (e) => {
        const layer = getActiveLayer();
        if (layer) {
            layer.rotation = parseInt(e.target.value);
            draw();
        }
    };
    fontSkewInput.oninput = (e) => {
        const layer = getActiveLayer();
        if (layer) {
            layer.skew = parseInt(e.target.value);
            draw();
        }
    };

    // Canvas Interaction
    canvas.onmousedown = (e) => {
        isDragging = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        canvas.style.cursor = 'grabbing';
    };

    window.onmousemove = (e) => {
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const layer = getActiveLayer();
        if (layer) {
            layer.posX += (currentX - startX) * scaleX;
            layer.posY += (currentY - startY) * scaleY;
        }
        
        startX = currentX;
        startY = currentY;
        draw();
    };

    window.onmouseup = () => {
        isDragging = false;
        canvas.style.cursor = 'crosshair';
    };

    toggleBtns.forEach(btn => {
        btn.onclick = () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            globalConfig.mode = btn.dataset.mode;
            draw();
        };
    });

    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = `lace-design-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    };
}

function draw() {
    // 1. Draw all layers to sample canvas
    sCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    
    textLayers.forEach(layer => {
        sCtx.save();
        sCtx.translate(sampleCanvas.width / 2 + layer.posX, sampleCanvas.height / 2 + layer.posY);
        sCtx.rotate(layer.rotation * Math.PI / 180);
        sCtx.scale(layer.scale, layer.scale);
        sCtx.transform(1, 0, Math.tan(layer.skew * Math.PI / 180), 1, 0, 0);

        sCtx.fillStyle = 'black';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.font = `400px ${layer.font}`;
        sCtx.fillText(layer.text, 0, 0);
        sCtx.restore();
    });

    // 2. Main Canvas Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imageData = sCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
    const data = imageData.data;
    const step = globalConfig.patternSize;

    ctx.strokeStyle = '#1a1a1a';
    ctx.fillStyle = '#1a1a1a';
    ctx.lineWidth = globalConfig.lineWeight;

    for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
            const index = (y * sampleCanvas.width + x) * 4;
            const alpha = data[index + 3];

            if (alpha > 128) {
                if (globalConfig.mode === 'x') {
                    drawX(x, y, step * 0.8);
                } else if (globalConfig.mode === 'dot') {
                    drawDot(x, y, step * 0.4);
                } else if (globalConfig.mode === 'stipple') {
                    drawStipple(x, y, step);
                }
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

function drawDot(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawStipple(x, y, size) {
    const dots = 5; // Number of tiny dots per cell
    const radius = globalConfig.lineWeight * 0.5;
    const range = size * 0.4;

    for (let i = 0; i < dots; i++) {
        // Pseudo-random but consistent based on x, y coordinates
        const offsetX = (Math.sin(x * 12.9898 + y * i * 78.233) * 43758.5453) % 1 * range;
        const offsetY = (Math.cos(x * i * 12.9898 + y * 78.233) * 43758.5453) % 1 * range;
        
        ctx.beginPath();
        ctx.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

init();
