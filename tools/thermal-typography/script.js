const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const textListContainer = document.getElementById('text-list');
const addTextBtn = document.getElementById('add-text-btn');
const layersInput = document.getElementById('layers');
const spreadInput = document.getElementById('spread');
const colorSchemeSelect = document.getElementById('color-scheme');
const glowInput = document.getElementById('glow');
const downloadBtn = document.getElementById('download-btn');
const fontUpload = document.getElementById('font-upload');
const fontFamilySelect = document.getElementById('font-family-select');

const layerVal = document.getElementById('layer-val');
const spreadVal = document.getElementById('spread-val');
const glowVal = document.getElementById('glow-val');

// App State
let config = {
    layers: 8,
    spread: 12,
    colorScheme: 'classic',
    glow: 0.5,
    selectedFont: '"Inter", "Microsoft YaHei", sans-serif'
};

let textObjects = [
    { id: Date.now(), text: 'good', x: 600, y: 600, fontSize: 180, rotation: 0, color: null }
];

let draggedObject = null;
let dragOffset = { x: 0, y: 0 };

const colorSchemes = {
    classic: ['#00ffff', '#0033ff', '#ff0000', '#ff9900', '#ffff00'],
    neon: ['#ff00ff', '#9900ff', '#0000ff', '#00ffff'],
    acid: ['#00ff00', '#ccff00', '#ffff00', '#ff9900'],
    monochrome: ['#333333', '#666666', '#999999', '#cccccc', '#ffffff']
};

function init() {
    canvas.width = 1200;
    canvas.height = 1200;
    setupEventListeners();
    updateTextListUI();
    draw();
}

function setupEventListeners() {
    layersInput.oninput = (e) => { config.layers = parseInt(e.target.value); layerVal.textContent = config.layers; draw(); };
    spreadInput.oninput = (e) => { config.spread = parseInt(e.target.value); spreadVal.textContent = config.spread; draw(); };
    colorSchemeSelect.onchange = (e) => { config.colorScheme = e.target.value; draw(); };
    glowInput.oninput = (e) => { config.glow = parseFloat(e.target.value); glowVal.textContent = config.glow; draw(); };
    
    addTextBtn.onclick = () => {
        textObjects.push({
            id: Date.now(),
            text: 'NEW TEXT',
            x: canvas.width / 2,
            y: canvas.height / 2,
            fontSize: 100,
            rotation: 0,
            color: null
        });
        updateTextListUI();
        draw();
    };

    fontUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const fontName = file.name.split('.')[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                const fontFace = new FontFace(fontName, event.target.result);
                await fontFace.load();
                document.fonts.add(fontFace);
                
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = fontName;
                fontFamilySelect.appendChild(option);
                fontFamilySelect.value = fontName;
                config.selectedFont = fontName;
                draw();
            };
            reader.readAsArrayBuffer(file);
        }
    };

    fontFamilySelect.onchange = (e) => {
        config.selectedFont = e.target.value;
        draw();
    };

    // Drag and Drop
    canvas.onmousedown = handleMouseDown;
    window.onmousemove = handleMouseMove;
    window.onmouseup = handleMouseUp;

    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = `thermal-typography-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
}

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check objects from top to bottom
    for (let i = textObjects.length - 1; i >= 0; i--) {
        const obj = textObjects[i];
        ctx.font = `900 ${obj.fontSize}px ${config.selectedFont}`;
        const metrics = ctx.measureText(obj.text);
        const width = metrics.width;
        const height = obj.fontSize;

        if (mouseX >= obj.x - width/2 && mouseX <= obj.x + width/2 &&
            mouseY >= obj.y - height/2 && mouseY <= obj.y + height/2) {
            draggedObject = obj;
            dragOffset.x = mouseX - obj.x;
            dragOffset.y = mouseY - obj.y;
            break;
        }
    }
}

function handleMouseMove(e) {
    if (!draggedObject) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    draggedObject.x = mouseX - dragOffset.x;
    draggedObject.y = mouseY - dragOffset.y;
    draw();
}

function handleMouseUp() {
    draggedObject = null;
}

function updateTextListUI() {
    textListContainer.innerHTML = '';
    textObjects.forEach((obj, index) => {
        const item = document.createElement('div');
        item.className = 'text-item';
        item.innerHTML = `
            <div class="text-item-header">
                <span>文本 #${index + 1}</span>
                <i class="fas fa-trash remove-btn" onclick="removeText(${obj.id})"></i>
            </div>
            <textarea oninput="updateText(${obj.id}, 'text', this.value)">${obj.text}</textarea>
            <div style="display:flex; flex-direction:column; gap:10px; font-size: 0.7rem; color: #888; margin-top:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>SIZE:</span>
                    <input type="range" min="20" max="500" value="${obj.fontSize}" oninput="updateText(${obj.id}, 'fontSize', parseInt(this.value))" style="width:70%">
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>COLOR:</span>
                    <div style="display:flex; gap:5px; align-items:center;">
                        <input type="color" value="${obj.color || '#ff0000'}" oninput="updateText(${obj.id}, 'color', this.value)" style="width:30px; height:20px; border:none; padding:0; background:none;">
                        <button onclick="updateText(${obj.id}, 'color', null)" style="font-size:0.6rem; padding:2px 5px;">RESET</button>
                    </div>
                </div>
            </div>
        `;
        textListContainer.appendChild(item);
    });
}

window.updateText = (id, key, value) => {
    const obj = textObjects.find(o => o.id === id);
    if (obj) {
        obj[key] = value;
        draw();
    }
};

window.removeText = (id) => {
    textObjects = textObjects.filter(o => o.id !== id);
    updateTextListUI();
    draw();
};

function draw() {
    // Clear and background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const globalColors = colorSchemes[config.colorScheme];

    // To achieve the interaction effect where colors mix at intersections,
    // we use a screen blend mode.
    ctx.globalCompositeOperation = 'screen';

    textObjects.forEach(obj => {
        let colors = globalColors;
        if (obj.color) {
            // Generate a simple thermal-like palette from the custom color
            colors = generatePalette(obj.color);
        }
        drawThermalText(obj, colors);
    });

    // Reset composite operation for UI or other elements if any
    ctx.globalCompositeOperation = 'source-over';
}

function generatePalette(baseColor) {
    // Helper to generate a 5-step palette from a single color
    // We create a gradient from dark version to the base color to white
    return [
        adjustColor(baseColor, -60), // Dark
        adjustColor(baseColor, -30), // Muted
        baseColor,                   // Base
        adjustColor(baseColor, 30),  // Bright
        '#ffffff'                    // Core
    ];
}

function adjustColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
}

function drawThermalText(obj, colors) {
    // Draw blurred layers
    for (let i = config.layers; i >= 1; i--) {
        const t = i / config.layers;
        const blur = i * config.spread;
        const colorIdx = Math.floor((1 - t) * (colors.length - 1));
        const color = colors[colorIdx];
        
        ctx.save();
        ctx.filter = `blur(${blur}px)`;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = blur * config.glow;
        
        ctx.font = `900 ${obj.fontSize}px ${config.selectedFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.text, obj.x, obj.y);
        ctx.restore();
    }

    // Top sharp layer
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${obj.fontSize}px ${config.selectedFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obj.text, obj.x, obj.y);
    ctx.restore();
}

init();
