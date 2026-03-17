(function () {
  const swatchConfigs = [
    { selector: '.swatch-1', xRatio: 0.03, yRatio: 0.05, vx: 92, vy: 76, rotation: 4, spin: 7 },
    { selector: '.swatch-2', xRatio: 0.58, yRatio: 0.04, vx: -88, vy: 72, rotation: -5, spin: -6 },
    { selector: '.swatch-3', xRatio: 0.04, yRatio: 0.46, vx: 96, vy: -70, rotation: 3, spin: 8 },
    { selector: '.swatch-4', xRatio: 0.57, yRatio: 0.58, vx: -82, vy: -90, rotation: -4, spin: -7 },
    { selector: '.swatch-5', xRatio: 0.12, yRatio: 0.7, vx: 86, vy: -84, rotation: 5, spin: 6 },
    { selector: '.swatch-6', xRatio: 0.42, yRatio: 0.16, vx: 78, vy: 88, rotation: -3, spin: -9 },
    { selector: '.swatch-7', xRatio: 0.74, yRatio: 0.36, vx: -94, vy: 74, rotation: 6, spin: 7 },
    { selector: '.swatch-8', xRatio: 0.29, yRatio: 0.74, vx: 90, vy: -96, rotation: -6, spin: -8 }
  ];

  const restitution = 0.98;
  const minSpeed = 70;
  const maxSpeed = 180;
  const hitboxScale = 0.95;
  const sizeRanges = {
    squareMin: 170,
    squareMax: 350,
    squareVariance: 18,
    rectMin: 180,
    rectMax: 360,
    rectStretchMin: 30,
    rectStretchMax: 105,
    minSide: 150,
    responsiveMinScale: 0.5,
    responsiveMaxScale: 1,
    referenceWidth: 1440,
    referenceHeight: 900
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomInRange(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }

  function shuffle(values) {
    const copy = [...values];

    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function generateBlockSize(shapeMode) {
    if (shapeMode === 'square') {
      const baseSize = randomInRange(sizeRanges.squareMin, sizeRanges.squareMax);

      return {
        width: Math.max(sizeRanges.minSide, baseSize + randomInRange(-sizeRanges.squareVariance, sizeRanges.squareVariance)),
        height: Math.max(sizeRanges.minSide, baseSize + randomInRange(-sizeRanges.squareVariance, sizeRanges.squareVariance))
      };
    }

    const baseSize = randomInRange(sizeRanges.rectMin, sizeRanges.rectMax);
    const stretch = randomInRange(sizeRanges.rectStretchMin, sizeRanges.rectStretchMax);
    const horizontal = Math.random() > 0.5;

    return horizontal
      ? {
          width: Math.max(sizeRanges.minSide, baseSize + stretch),
          height: Math.max(sizeRanges.minSide, baseSize - randomInRange(10, stretch - 8))
        }
      : {
          width: Math.max(sizeRanges.minSide, baseSize - randomInRange(10, stretch - 8)),
          height: Math.max(sizeRanges.minSide, baseSize + stretch)
        };
  }

  function getViewportScale() {
    const widthScale = window.innerWidth / sizeRanges.referenceWidth;
    const heightScale = window.innerHeight / sizeRanges.referenceHeight;
    const scale = Math.min(widthScale, heightScale, sizeRanges.responsiveMaxScale);

    return clamp(scale, sizeRanges.responsiveMinScale, sizeRanges.responsiveMaxScale);
  }

  function getHitbox(block) {
    return {
      centerX: block.x + block.width / 2,
      centerY: block.y + block.height / 2,
      halfWidth: (block.width * hitboxScale) / 2,
      halfHeight: (block.height * hitboxScale) / 2,
      angle: (block.angle * Math.PI) / 180
    };
  }

  function getAxes(hitbox) {
    const cos = Math.cos(hitbox.angle);
    const sin = Math.sin(hitbox.angle);

    return [
      { x: cos, y: sin },
      { x: -sin, y: cos }
    ];
  }

  function projectHitbox(hitbox, axis) {
    const axes = getAxes(hitbox);
    const centerProjection = hitbox.centerX * axis.x + hitbox.centerY * axis.y;
    const radius =
      hitbox.halfWidth * Math.abs(axis.x * axes[0].x + axis.y * axes[0].y) +
      hitbox.halfHeight * Math.abs(axis.x * axes[1].x + axis.y * axes[1].y);

    return {
      min: centerProjection - radius,
      max: centerProjection + radius
    };
  }

  function getRotatedExtents(hitbox) {
    const cos = Math.cos(hitbox.angle);
    const sin = Math.sin(hitbox.angle);

    return {
      x: Math.abs(cos) * hitbox.halfWidth + Math.abs(sin) * hitbox.halfHeight,
      y: Math.abs(sin) * hitbox.halfWidth + Math.abs(cos) * hitbox.halfHeight
    };
  }

  function bounceOffWalls(block, viewportWidth, viewportHeight) {
    const hitbox = getHitbox(block);
    const extents = getRotatedExtents(hitbox);
    const minX = hitbox.centerX - extents.x;
    const maxX = hitbox.centerX + extents.x;
    const minY = hitbox.centerY - extents.y;
    const maxY = hitbox.centerY + extents.y;

    if (minX <= 0) {
      block.x += -minX;
      block.vx = Math.abs(block.vx) * restitution;
    } else if (maxX >= viewportWidth) {
      block.x -= maxX - viewportWidth;
      block.vx = -Math.abs(block.vx) * restitution;
    }

    if (minY <= 0) {
      block.y += -minY;
      block.vy = Math.abs(block.vy) * restitution;
    } else if (maxY >= viewportHeight) {
      block.y -= maxY - viewportHeight;
      block.vy = -Math.abs(block.vy) * restitution;
    }
  }

  function resolveCollision(a, b) {
    const hitboxA = getHitbox(a);
    const hitboxB = getHitbox(b);
    const axes = [...getAxes(hitboxA), ...getAxes(hitboxB)];
    let smallestOverlap = Infinity;
    let collisionAxis = null;

    for (const axis of axes) {
      const projectionA = projectHitbox(hitboxA, axis);
      const projectionB = projectHitbox(hitboxB, axis);
      const overlap = Math.min(projectionA.max, projectionB.max) - Math.max(projectionA.min, projectionB.min);

      if (overlap <= 0) {
        return;
      }

      if (overlap < smallestOverlap) {
        smallestOverlap = overlap;
        collisionAxis = axis;
      }
    }

    const dx = hitboxB.centerX - hitboxA.centerX;
    const dy = hitboxB.centerY - hitboxA.centerY;
    let normalX = collisionAxis.x;
    let normalY = collisionAxis.y;

    if (dx * normalX + dy * normalY < 0) {
      normalX *= -1;
      normalY *= -1;
    }

    const separationX = normalX * (smallestOverlap / 2);
    const separationY = normalY * (smallestOverlap / 2);

    a.x -= separationX;
    a.y -= separationY;
    b.x += separationX;
    b.y += separationY;

    const relativeVelocityX = b.vx - a.vx;
    const relativeVelocityY = b.vy - a.vy;
    const approachSpeed = relativeVelocityX * normalX + relativeVelocityY * normalY;

    if (approachSpeed >= 0) {
      return;
    }

    const impulse = (-(1 + restitution) * approachSpeed) / 2;

    a.vx -= impulse * normalX;
    a.vy -= impulse * normalY;
    b.vx += impulse * normalX;
    b.vy += impulse * normalY;
  }

  function keepMomentum(block) {
    const speed = Math.hypot(block.vx, block.vy);

    if (speed < minSpeed) {
      const scale = minSpeed / (speed || 1);
      block.vx *= scale;
      block.vy *= scale;
    } else if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      block.vx *= scale;
      block.vy *= scale;
    }
  }

  function renderBlock(block) {
    block.element.style.transform = `translate(${block.x}px, ${block.y}px) rotate(${block.angle}deg)`;
  }

  function initBackgroundBlocks(containerId = 'background-block-layer') {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.initialized === 'true') {
      return;
    }

    swatchConfigs.forEach((config, index) => {
      if (!container.querySelector(config.selector)) {
        const swatch = document.createElement('div');
        swatch.className = `swatch swatch-${index + 1}`;
        container.appendChild(swatch);
      }
    });

    const shapeModes = shuffle([
      'square', 'square', 'square', 'square',
      'rectangle', 'rectangle', 'rectangle', 'rectangle'
    ]);

    const blocks = swatchConfigs.map((config) => {
      const element = container.querySelector(config.selector);
      const { width, height } = generateBlockSize(shapeModes.pop());

      element.style.width = `${width}px`;
      element.style.height = `${height}px`;

      return {
        element,
        width,
        height,
        baseWidth: width,
        baseHeight: height,
        x: 0,
        y: 0,
        vx: config.vx,
        vy: config.vy,
        angle: config.rotation,
        spin: config.spin,
        xRatio: config.xRatio,
        yRatio: config.yRatio
      };
    });

    function updateBlockDimensions() {
      const viewportScale = getViewportScale();

      blocks.forEach((block) => {
        block.width = Math.round(block.baseWidth * viewportScale);
        block.height = Math.round(block.baseHeight * viewportScale);
        block.element.style.width = `${block.width}px`;
        block.element.style.height = `${block.height}px`;
      });
    }

    function placeBlocks() {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      updateBlockDimensions();

      blocks.forEach((block) => {
        const maxX = Math.max(viewportWidth - block.width, 0);
        const maxY = Math.max(viewportHeight - block.height, 0);

        block.x = clamp(maxX * block.xRatio, 0, maxX);
        block.y = clamp(maxY * block.yRatio, 0, maxY);
        bounceOffWalls(block, viewportWidth, viewportHeight);
        renderBlock(block);
      });
    }

    let lastTime = performance.now();

    function animate(now) {
      const delta = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      blocks.forEach((block) => {
        block.x += block.vx * delta;
        block.y += block.vy * delta;
        block.angle += block.spin * delta;
        bounceOffWalls(block, viewportWidth, viewportHeight);
      });

      for (let i = 0; i < blocks.length; i += 1) {
        for (let j = i + 1; j < blocks.length; j += 1) {
          resolveCollision(blocks[i], blocks[j]);
        }
      }

      blocks.forEach((block) => {
        bounceOffWalls(block, viewportWidth, viewportHeight);
        keepMomentum(block);
        renderBlock(block);
      });

      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', placeBlocks);

    placeBlocks();
    requestAnimationFrame((now) => {
      lastTime = now;
      animate(now);
    });

    container.dataset.initialized = 'true';
  }

  window.initBackgroundBlocks = initBackgroundBlocks;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initBackgroundBlocks(), { once: true });
  } else {
    initBackgroundBlocks();
  }
})();
