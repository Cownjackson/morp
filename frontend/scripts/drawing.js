// ─── Drawing engine ───────────────────────────────────────────────────────────

// Per-canvas state: strokes accumulated, current in-flight stroke, drawing flag
export const _drawState = {};

// Per-tool-key settings: hint canvas vs endgame ghost canvas
const _drawTools = {
  hint:    { color: '#FFFDFD', size: 3, eraser: false, fill: false },
  endgame: { color: '#FFFDFD', size: 3, eraser: false, fill: false },
};

function _fillBg(ctx, canvas) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export function initCanvas(canvasId, toolKey) {
  _drawState[canvasId] = { strokes: [], drawing: false, lastPos: null };
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  _fillBg(ctx, canvas);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function applyToolStyle() {
    const t = _drawTools[toolKey];
    if (t.eraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle   = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = t.color;
      ctx.fillStyle   = t.color;
    }
    ctx.lineWidth = t.size;
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
  }

  function startDraw(e) {
    const ds = _drawState[canvasId];
    const t  = _drawTools[toolKey];
    const pos = getPos(e);
    // Fill tool: perform flood fill on click, don't start a stroke
    if (t.fill) {
      const fillStroke = { fill: true, x: pos.x, y: pos.y, color: t.color, points: [], eraser: false, size: 0 };
      _floodFill(ctx, Math.round(pos.x), Math.round(pos.y), t.color);
      ds.strokes.push(fillStroke);
      return;
    }
    ds.drawing  = true;
    ds.lastPos  = pos;
    ds.currentStroke = {
      color: t.eraser ? null : t.color,
      size: t.size,
      eraser: t.eraser,
      points: [{ ...ds.lastPos }],
    };
    applyToolStyle();
    // Draw a dot in case it's a single tap/click
    ctx.beginPath();
    ctx.arc(ds.lastPos.x, ds.lastPos.y, t.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function moveDraw(e) {
    const ds = _drawState[canvasId];
    if (!ds.drawing) return;
    const pos = getPos(e);
    applyToolStyle();
    ctx.beginPath();
    ctx.moveTo(ds.lastPos.x, ds.lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ds.lastPos = pos;
    ds.currentStroke.points.push({ ...pos });
  }

  function endDraw() {
    const ds = _drawState[canvasId];
    if (!ds.drawing) return;
    ds.drawing = false;
    ctx.globalCompositeOperation = 'source-over';
    if (ds.currentStroke && ds.currentStroke.points.length > 0) {
      ds.strokes.push(ds.currentStroke);
    }
    ds.currentStroke = null;
  }

  canvas.addEventListener('mousedown',  e => { e.preventDefault(); startDraw(e); });
  canvas.addEventListener('mousemove',  e => { if (e.buttons === 1) moveDraw(e); });
  canvas.addEventListener('mouseup',    endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(e); }, { passive: false });
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); moveDraw(e); },  { passive: false });
  canvas.addEventListener('touchend',   endDraw);
}

export function clearCanvas(canvasId) {
  const ds = _drawState[canvasId];
  if (!ds) return;
  ds.strokes = []; ds.drawing = false; ds.currentStroke = null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  _fillBg(ctx, canvas);
}

export function undoStroke(canvasId) {
  const ds = _drawState[canvasId];
  if (!ds || ds.strokes.length === 0) return;
  ds.strokes.pop();
  _replayCanvas(canvasId);
}

function _replayCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  _fillBg(ctx, canvas);
  for (const stroke of _drawState[canvasId].strokes) {
    _drawStrokeOnCtx(ctx, stroke, 1, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}

const _parseColorCache = {};
function _parseColor(color) {
  if (_parseColorCache[color]) return _parseColorCache[color];
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = 1;
  const c = tmp.getContext('2d');
  c.fillStyle = color;
  c.fillRect(0, 0, 1, 1);
  const rgba = c.getImageData(0, 0, 1, 1).data;
  _parseColorCache[color] = [rgba[0], rgba[1], rgba[2], rgba[3]];
  return _parseColorCache[color];
}

function _floodFill(ctx, startX, startY, fillColor, tolerance) {
  tolerance = tolerance || 80;
  const tolSq = tolerance * tolerance;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const fc = _parseColor(fillColor);
  // Target color at start pixel
  const idx = (startY * w + startX) * 4;
  const tr = data[idx], tg = data[idx+1], tb = data[idx+2], ta = data[idx+3];
  // Don't fill if target is already the fill color
  if (Math.abs(tr - fc[0]) < 3 && Math.abs(tg - fc[1]) < 3 && Math.abs(tb - fc[2]) < 3 && Math.abs(ta - fc[3]) < 3) return;
  function match(i) {
    const dr = data[i] - tr, dg = data[i+1] - tg, db = data[i+2] - tb, da = data[i+3] - ta;
    return (dr*dr + dg*dg + db*db + da*da) <= tolSq;
  }
  // Scanline flood fill
  const stack = [[startX, startY]];
  const visited = new Uint8Array(w * h);
  while (stack.length > 0) {
    let [x, y] = stack.pop();
    let pi = y * w + x;
    if (visited[pi]) continue;
    // Move left to find span start
    while (x > 0 && match(((y * w) + x - 1) * 4)) x--;
    let spanAbove = false, spanBelow = false;
    // Scan right
    while (x < w) {
      pi = y * w + x;
      const i = pi * 4;
      if (visited[pi] || !match(i)) break;
      data[i] = fc[0]; data[i+1] = fc[1]; data[i+2] = fc[2]; data[i+3] = fc[3];
      visited[pi] = 1;
      // Check above
      if (y > 0) {
        const above = ((y-1) * w + x);
        if (!visited[above] && match(above * 4)) { if (!spanAbove) { stack.push([x, y-1]); spanAbove = true; } }
        else spanAbove = false;
      }
      // Check below
      if (y < h - 1) {
        const below = ((y+1) * w + x);
        if (!visited[below] && match(below * 4)) { if (!spanBelow) { stack.push([x, y+1]); spanBelow = true; } }
        else spanBelow = false;
      }
      x++;
    }
  }
  // Anti-alias cleanup: iteratively absorb fringe pixels into the filled area.
  // Each pass fills unvisited pixels adjacent to already-filled pixels, working
  // inward through the anti-aliased gradient until reaching solid stroke color.
  const FRINGE_PASSES = 2;
  for (let pass = 0; pass < FRINGE_PASSES; pass++) {
    const absorb = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pi = y * w + x;
        if (visited[pi]) continue;
        const hasFilledNeighbor =
          (x > 0     && visited[pi - 1]) ||
          (x < w - 1 && visited[pi + 1]) ||
          (y > 0     && visited[pi - w]) ||
          (y < h - 1 && visited[pi + w]);
        if (!hasFilledNeighbor) continue;
        absorb.push(pi);
      }
    }
    if (absorb.length === 0) break;
    for (const pi of absorb) {
      const i = pi * 4;
      data[i] = fc[0]; data[i+1] = fc[1]; data[i+2] = fc[2]; data[i+3] = fc[3];
      visited[pi] = 1;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function _drawStrokeOnCtx(ctx, stroke, scaleX, scaleY) {
  if (stroke.fill) {
    _floodFill(ctx, Math.round(stroke.x * scaleX), Math.round(stroke.y * scaleY), stroke.color);
    return;
  }
  if (!stroke.points || stroke.points.length === 0) return;
  const sz = stroke.size * Math.min(scaleX, scaleY);
  ctx.save();
  if (stroke.eraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle   = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle   = stroke.color;
  }
  ctx.lineWidth = sz;
  ctx.lineCap   = 'round';
  ctx.lineJoin  = 'round';
  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY, sz / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Render strokes received from the server onto any display canvas
// Source canvas size is always 560×360 (hint-canvas / endgame-ghost-canvas dimensions)
const _SRC_W = 560, _SRC_H = 360;
export function renderStrokesToCanvas(canvas, strokes) {
  if (!strokes || !strokes.length) return;
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  _fillBg(ctx, canvas);
  const sx = canvas.width  / _SRC_W;
  const sy = canvas.height / _SRC_H;
  for (const stroke of strokes) _drawStrokeOnCtx(ctx, stroke, sx, sy);
  ctx.globalCompositeOperation = 'source-over';
}

// ─── Drawing tool controls ─────────────────────────────────────────────────────

export function setDrawColor(toolKey, el) {
  const t = _drawTools[toolKey];
  t.color  = el.dataset.color;
  t.eraser = false;
  t.fill   = false;
  const toolbar = el.closest('.draw-toolbar');
  toolbar.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const eraserBtn = toolbar.querySelector('.eraser-btn');
  if (eraserBtn) eraserBtn.classList.remove('active');
  const fillBtn = toolbar.querySelector('.fill-btn');
  if (fillBtn) fillBtn.classList.remove('active');
  const preview = toolbar.querySelector('.draw-current-color');
  if (preview) preview.style.background = el.dataset.color;
}

export function setDrawSize(toolKey, el) {
  _drawTools[toolKey].size = parseInt(el.dataset.size, 10);
  const toolbar = el.closest('.draw-toolbar');
  toolbar.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

export function toggleEraser(toolKey, el) {
  const t = _drawTools[toolKey];
  t.eraser = !t.eraser;
  t.fill = false;
  el.classList.toggle('active', t.eraser);
  const toolbar = el.closest('.draw-toolbar');
  toolbar.querySelectorAll('.color-swatch').forEach(b => b.classList.toggle('active', !t.eraser && b.dataset.color === t.color));
  const fillBtn = toolbar.querySelector('.fill-btn');
  if (fillBtn) fillBtn.classList.remove('active');
}

export function toggleFill(toolKey, el) {
  const t = _drawTools[toolKey];
  t.fill = !t.fill;
  t.eraser = false;
  el.classList.toggle('active', t.fill);
  const toolbar = el.closest('.draw-toolbar');
  toolbar.querySelectorAll('.color-swatch').forEach(b => b.classList.toggle('active', !t.fill && b.dataset.color === t.color));
  const eraserBtn = toolbar.querySelector('.eraser-btn');
  if (eraserBtn) eraserBtn.classList.remove('active');
}
