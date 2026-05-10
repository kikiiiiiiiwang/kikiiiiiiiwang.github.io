const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

const dropZone = document.getElementById('drop-zone');
const imageInput = document.getElementById('image-input');
const downloadBtn = document.getElementById('download-btn');

const modeSelect = document.getElementById('mode');
const thresholdInput = document.getElementById('threshold');
const autoThresholdInput = document.getElementById('auto-threshold');
const blurInput = document.getElementById('blur');
const smoothInput = document.getElementById('smooth');
const layersInput = document.getElementById('layers');
const invertInput = document.getElementById('invert');
const fillColorInput = document.getElementById('fill-color');
const bgColorInput = document.getElementById('bg-color');
const underlayInput = document.getElementById('underlay');
const outlineColorInput = document.getElementById('outline-color');
const outlineInput = document.getElementById('outline');
const resolutionInput = document.getElementById('resolution');

const thresholdVal = document.getElementById('threshold-val');
const blurVal = document.getElementById('blur-val');
const smoothVal = document.getElementById('smooth-val');
const layersVal = document.getElementById('layers-val');
const underlayVal = document.getElementById('underlay-val');
const outlineVal = document.getElementById('outline-val');
const resVal = document.getElementById('res-val');

let sourceImg = null;

let view = {
    panX: 0,
    panY: 0,
    scale: 1,
    dragging: false,
    lastX: 0,
    lastY: 0
};

const workCanvas = document.createElement('canvas');
const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

function init() {
    canvas.width = 1100;
    canvas.height = 900;
    bindUI();
    drawPlaceholder();
}

function bindUI() {
    dropZone.addEventListener('click', () => imageInput.click());
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
        if (file && file.type.startsWith('image/')) handleFile(file);
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    [
        modeSelect,
        thresholdInput,
        autoThresholdInput,
        blurInput,
        smoothInput,
        layersInput,
        invertInput,
        fillColorInput,
        bgColorInput,
        underlayInput,
        outlineColorInput,
        outlineInput,
        resolutionInput
    ].forEach((el) => {
        el.addEventListener('input', () => {
            syncLabels();
            render();
        });
        el.addEventListener('change', () => {
            syncLabels();
            render();
        });
    });

    canvas.addEventListener('mousedown', (e) => {
        view.dragging = true;
        view.lastX = e.clientX;
        view.lastY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
        if (!view.dragging) return;
        const dx = e.clientX - view.lastX;
        const dy = e.clientY - view.lastY;
        view.lastX = e.clientX;
        view.lastY = e.clientY;
        view.panX += dx;
        view.panY += dy;
        render();
    });
    window.addEventListener('mouseup', () => {
        view.dragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const prevScale = view.scale;
        const delta = Math.sign(e.deltaY) * -0.08;
        const nextScale = clamp(view.scale * (1 + delta), 0.2, 6);

        const ax = (mx - view.panX) / prevScale;
        const ay = (my - view.panY) / prevScale;

        view.scale = nextScale;
        view.panX = mx - ax * nextScale;
        view.panY = my - ay * nextScale;
        render();
    }, { passive: false });

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `abstract-shapes-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    syncLabels();
}

function syncLabels() {
    thresholdVal.textContent = Number(thresholdInput.value).toFixed(2);
    blurVal.textContent = String(parseInt(blurInput.value));
    smoothVal.textContent = String(parseInt(smoothInput.value));
    layersVal.textContent = String(parseInt(layersInput.value));
    underlayVal.textContent = Number(underlayInput.value).toFixed(2);
    outlineVal.textContent = String(parseInt(outlineInput.value));
    resVal.textContent = String(parseInt(resolutionInput.value));
}

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            sourceImg = img;
            resetView();
            render();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function resetView() {
    view.scale = 1;
    view.panX = 0;
    view.panY = 0;
}

function drawPlaceholder() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#888888';
    ctx.font = '14px Space Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('UPLOAD AN IMAGE TO ABSTRACT', canvas.width / 2, canvas.height / 2);
}

function render() {
    if (!sourceImg) {
        drawPlaceholder();
        return;
    }

    const bg = bgColorInput.value;
    const underlay = parseFloat(underlayInput.value);

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(view.panX, view.panY);
    ctx.scale(view.scale, view.scale);

    const fitted = fitToCanvas(sourceImg.width, sourceImg.height, canvas.width, canvas.height);
    const drawW = fitted.w;
    const drawH = fitted.h;
    const dx = (canvas.width - drawW) / 2;
    const dy = (canvas.height - drawH) / 2;

    if (underlay > 0) {
        ctx.globalAlpha = underlay;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sourceImg, dx, dy, drawW, drawH);
        ctx.globalAlpha = 1;
    }

    const output = buildAbstractImage(drawW, drawH);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(output, dx, dy, drawW, drawH);

    ctx.restore();
}

function buildAbstractImage(targetW, targetH) {
    const res = parseInt(resolutionInput.value);
    const aspect = sourceImg.width / sourceImg.height;
    const w = res;
    const h = Math.max(1, Math.round(res / aspect));

    workCanvas.width = w;
    workCanvas.height = h;
    maskCanvas.width = w;
    maskCanvas.height = h;
    tempCanvas.width = w;
    tempCanvas.height = h;

    const blurPx = parseInt(blurInput.value);
    workCtx.save();
    workCtx.clearRect(0, 0, w, h);
    workCtx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
    workCtx.drawImage(sourceImg, 0, 0, w, h);
    workCtx.restore();

    const imgData = workCtx.getImageData(0, 0, w, h);
    const gray = toGrayscale(imgData.data);

    const invert = invertInput.checked;
    for (let i = 0; i < gray.length; i++) {
        gray[i] = invert ? 1 - gray[i] : gray[i];
    }

    const mode = modeSelect.value;
    const layers = parseInt(layersInput.value);
    const threshold = parseFloat(thresholdInput.value);
    const useAuto = autoThresholdInput.checked;
    const outline = parseInt(outlineInput.value);
    const outlineColor = outlineColorInput.value;
    const smooth = parseInt(smoothInput.value);

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d', { willReadFrequently: true });

    octx.clearRect(0, 0, w, h);
    octx.fillStyle = 'rgba(0,0,0,0)';
    octx.fillRect(0, 0, w, h);

    if (mode === 'posterize' && layers > 1) {
        const palette = buildPalette(fillColorInput.value, layers);
        for (let li = 0; li < layers; li++) {
            const t0 = li / layers;
            const t1 = (li + 1) / layers;
            const mask = buildRangeMask(gray, t0, t1);
            const closed = smooth > 0 ? morphClose(mask, w, h, smooth) : mask;
            drawMaskFill(octx, closed, w, h, palette[li]);
        }
    } else {
        const th = useAuto ? otsuThreshold(gray) : threshold;
        const mask = buildBinaryMask(gray, th);
        const closed = smooth > 0 ? morphClose(mask, w, h, smooth) : mask;
        drawMaskFill(octx, closed, w, h, fillColorInput.value);
        if (outline > 0) {
            const edge = edgeMask(closed, w, h);
            const thick = morphDilate(edge, w, h, Math.max(1, Math.round(outline / 3)));
            drawMaskFill(octx, thick, w, h, outlineColor);
            octx.globalCompositeOperation = 'destination-out';
            const inner = morphErode(thick, w, h, Math.max(1, Math.round(outline / 3)));
            drawMaskFill(octx, inner, w, h, '#000000');
            octx.globalCompositeOperation = 'source-over';
        }
    }

    return out;
}

function fitToCanvas(srcW, srcH, dstW, dstH) {
    const s = Math.min(dstW / srcW, dstH / srcH);
    return { w: srcW * s, h: srcH * s };
}

function toGrayscale(rgba) {
    const out = new Float32Array(rgba.length / 4);
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
        const r = rgba[i] / 255;
        const g = rgba[i + 1] / 255;
        const b = rgba[i + 2] / 255;
        out[p] = r * 0.299 + g * 0.587 + b * 0.114;
    }
    return out;
}

function buildBinaryMask(gray, threshold) {
    const mask = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
        mask[i] = gray[i] >= threshold ? 1 : 0;
    }
    return mask;
}

function buildRangeMask(gray, t0, t1) {
    const mask = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
        const v = gray[i];
        mask[i] = (v >= t0 && v < t1) ? 1 : 0;
    }
    return mask;
}

function drawMaskFill(octx, mask, w, h, color) {
    const img = octx.getImageData(0, 0, w, h);
    const data = img.data;
    const rgb = hexToRgb(color);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        if (mask[p]) {
            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
            data[i + 3] = 255;
        }
    }
    octx.putImageData(img, 0, 0);
}

function buildPalette(baseHex, layers) {
    const rgb = hexToRgb(baseHex);
    const base = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const out = [];
    for (let i = 0; i < layers; i++) {
        const t = layers <= 1 ? 0 : i / (layers - 1);
        const l = clamp(base.l * 0.35 + t * 0.55, 0, 1);
        const col = hslToRgb(base.h, base.s, l);
        out.push(rgbToHex(col.r, col.g, col.b));
    }
    return out;
}

function edgeMask(mask, w, h) {
    const out = new Uint8Array(mask.length);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (!mask[i]) continue;
            const n = mask[i - w] + mask[i + w] + mask[i - 1] + mask[i + 1];
            if (n < 4) out[i] = 1;
        }
    }
    return out;
}

function morphClose(mask, w, h, iters) {
    let m = mask;
    m = morphDilate(m, w, h, iters);
    m = morphErode(m, w, h, iters);
    return m;
}

function morphDilate(mask, w, h, iters) {
    let current = mask;
    for (let k = 0; k < iters; k++) {
        const next = new Uint8Array(current.length);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = y * w + x;
                if (current[i]) { next[i] = 1; continue; }
                if (
                    current[i - w - 1] || current[i - w] || current[i - w + 1] ||
                    current[i - 1] || current[i + 1] ||
                    current[i + w - 1] || current[i + w] || current[i + w + 1]
                ) next[i] = 1;
            }
        }
        current = next;
    }
    return current;
}

function morphErode(mask, w, h, iters) {
    let current = mask;
    for (let k = 0; k < iters; k++) {
        const next = new Uint8Array(current.length);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = y * w + x;
                if (!current[i]) { next[i] = 0; continue; }
                if (
                    current[i - w - 1] && current[i - w] && current[i - w + 1] &&
                    current[i - 1] && current[i + 1] &&
                    current[i + w - 1] && current[i + w] && current[i + w + 1]
                ) next[i] = 1;
            }
        }
        current = next;
    }
    return current;
}

function otsuThreshold(gray) {
    const bins = 256;
    const hist = new Uint32Array(bins);
    for (let i = 0; i < gray.length; i++) {
        const b = clamp(Math.floor(gray[i] * 255), 0, 255);
        hist[b]++;
    }
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < bins; i++) sum += i * hist[i];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = -1;
    let threshold = 128;

    for (let t = 0; t < bins; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;

        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > varMax) {
            varMax = between;
            threshold = t;
        }
    }
    return threshold / 255;
}

function hexToRgb(hex) {
    const s = hex.replace('#', '');
    const v = parseInt(s, 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function rgbToHex(r, g, b) {
    const v = (r << 16) | (g << 8) | b;
    return '#' + v.toString(16).padStart(6, '0');
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case r: h = ((g - b) / d) % 6; break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
        if (h < 0) h += 1;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    const hp = h * 6;
    if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
    else if (hp >= 1 && hp < 2) { r1 = x; g1 = c; b1 = 0; }
    else if (hp >= 2 && hp < 3) { r1 = 0; g1 = c; b1 = x; }
    else if (hp >= 3 && hp < 4) { r1 = 0; g1 = x; b1 = c; }
    else if (hp >= 4 && hp < 5) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
    };
}

function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

init();
