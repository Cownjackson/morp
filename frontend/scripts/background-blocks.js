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
  const maxSpeed = 225;
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
    responsiveMinScale: 0.36,
    responsiveMaxScale: 1,
    narrowViewportWidth: 430,
    narrowViewportMinBoost: 0.14,
    referenceWidth: 1440,
    referenceHeight: 900
  };
  const motionRanges = {
    responsiveMinSpeedScale: 0.72,
    responsiveMaxSpeedScale: 1
  };
  const interactionConfig = {
    impulseRadius: 320,
    impulseStrength: 150,
    rippleLifetime: 950,
    rippleStartRadius: 10,
    rippleEndRadius: 120
  };
  const collisionJiggleConfig = {
    maxTilt: 1.2,
    maxStretch: 0.06,
    oscillationPeriod: 0.4,
    settleDuration: 1.15,
    dampingPower: 2.2,
    speedToStretch: 0.028
  };
  const ripplePalette = [
    '--mint',
    '--pinky',
    '--grape',
    '--mustard',
    '--sky',
    '--peach'
  ];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomInRange(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function easeOutCubic(value) {
    return 1 - (1 - value) ** 3;
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

  function getResponsiveMetrics() {
    const widthScale = window.innerWidth / sizeRanges.referenceWidth;
    const heightScale = window.innerHeight / sizeRanges.referenceHeight;
    const rawScale = clamp(
      Math.min(widthScale, heightScale, sizeRanges.responsiveMaxScale),
      sizeRanges.responsiveMinScale,
      sizeRanges.responsiveMaxScale
    );
    const normalizedScale =
      (rawScale - sizeRanges.responsiveMinScale) /
      (sizeRanges.responsiveMaxScale - sizeRanges.responsiveMinScale);
    const narrowViewportRatio = clamp(window.innerWidth / sizeRanges.narrowViewportWidth, 0, 1);
    const narrowViewportAdjustment =
      (1 - narrowViewportRatio) * sizeRanges.narrowViewportMinBoost;
    const viewportScale = clamp(
      sizeRanges.responsiveMinScale +
        (sizeRanges.responsiveMaxScale - sizeRanges.responsiveMinScale) * normalizedScale ** 1.15 -
        narrowViewportAdjustment,
      sizeRanges.responsiveMinScale,
      sizeRanges.responsiveMaxScale
    );
    const speedScale = clamp(
      motionRanges.responsiveMinSpeedScale +
        (motionRanges.responsiveMaxSpeedScale - motionRanges.responsiveMinSpeedScale) * normalizedScale,
      motionRanges.responsiveMinSpeedScale,
      motionRanges.responsiveMaxSpeedScale
    );

    return { viewportScale, speedScale };
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
    block.element.style.transform =
      `translate(${block.x}px, ${block.y}px) ` +
      `rotate(${block.angle + block.jiggleAngle}deg) ` +
      `scale(${block.jiggleScaleX}, ${block.jiggleScaleY})`;
  }

  function hexToRgb(hex) {
    const normalized = hex.trim();
    const value = normalized.startsWith('#') ? normalized.slice(1) : normalized;

    if (value.length !== 6) {
      return { r: 255, g: 255, b: 255 };
    }

    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16)
    };
  }

  function rgbaString(color, alpha) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
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

    let rippleLayer = container.querySelector('.background-ripple-layer');
    if (!rippleLayer) {
      rippleLayer = document.createElement('div');
      rippleLayer.className = 'background-ripple-layer';
      container.appendChild(rippleLayer);
    }

    let interactionLayer = container.querySelector('.background-interaction-layer');
    if (!interactionLayer) {
      interactionLayer = document.createElement('div');
      interactionLayer.className = 'background-interaction-layer';
      container.appendChild(interactionLayer);
    }

    const paletteColors = ripplePalette.map((cssVariable) =>
      hexToRgb(getComputedStyle(document.documentElement).getPropertyValue(cssVariable))
    );
    const ripples = [];
    let rippleIndex = 0;

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
        baseVx: config.vx,
        baseVy: config.vy,
        angle: config.rotation,
        spin: config.spin,
        jiggleCompressionX: 0,
        jiggleCompressionY: 0,
        jiggleTiltAmplitude: 0,
        jiggleTime: collisionJiggleConfig.settleDuration,
        jiggleAngle: 0,
        jiggleScaleX: 1,
        jiggleScaleY: 1,
        xRatio: config.xRatio,
        yRatio: config.yRatio
      };
    });

    function applyCollisionJiggle(block, normalX, normalY, impact) {
      const jiggleStrength = Math.min(impact * collisionJiggleConfig.speedToStretch, 1);
      const compressionX = Math.abs(normalX) * collisionJiggleConfig.maxStretch * jiggleStrength;
      const compressionY = Math.abs(normalY) * collisionJiggleConfig.maxStretch * jiggleStrength;
      const reboundX = Math.abs(normalY) * collisionJiggleConfig.maxStretch * jiggleStrength * 0.2;
      const reboundY = Math.abs(normalX) * collisionJiggleConfig.maxStretch * jiggleStrength * 0.2;

      block.jiggleCompressionX = clamp(
        block.jiggleCompressionX + compressionX - reboundX,
        0,
        collisionJiggleConfig.maxStretch
      );
      block.jiggleCompressionY = clamp(
        block.jiggleCompressionY + compressionY - reboundY,
        0,
        collisionJiggleConfig.maxStretch
      );
      block.jiggleTiltAmplitude = clamp(
        block.jiggleTiltAmplitude + (normalX * normalY) * collisionJiggleConfig.maxTilt * jiggleStrength,
        -collisionJiggleConfig.maxTilt,
        collisionJiggleConfig.maxTilt
      );
      block.jiggleTime = 0;
    }

    function updateResponsiveLayout() {
      const { viewportScale, speedScale } = getResponsiveMetrics();

      blocks.forEach((block) => {
        block.width = Math.round(block.baseWidth * viewportScale);
        block.height = Math.round(block.baseHeight * viewportScale);
        block.element.style.width = `${block.width}px`;
        block.element.style.height = `${block.height}px`;
        block.vx = Math.sign(block.vx || block.baseVx) * Math.abs(block.baseVx * speedScale);
        block.vy = Math.sign(block.vy || block.baseVy) * Math.abs(block.baseVy * speedScale);
      });
    }

    function placeBlocks() {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      updateResponsiveLayout();

      blocks.forEach((block) => {
        const maxX = Math.max(viewportWidth - block.width, 0);
        const maxY = Math.max(viewportHeight - block.height, 0);

        block.x = clamp(maxX * block.xRatio, 0, maxX);
        block.y = clamp(maxY * block.yRatio, 0, maxY);
        bounceOffWalls(block, viewportWidth, viewportHeight);
        renderBlock(block);
      });
    }

    function spawnRipple(x, y) {
      const element = document.createElement('div');
      const color = paletteColors[rippleIndex % paletteColors.length];
      rippleIndex += 1;

      element.className = 'background-ripple';
      element.style.border = `2px solid ${rgbaString(color, 0.88)}`;
      element.style.boxShadow = `0 0 14px ${rgbaString(color, 0.3)}`;

      rippleLayer.appendChild(element);
      ripples.push({
        element,
        x,
        y,
        bornAt: performance.now(),
        startRadius: interactionConfig.rippleStartRadius,
        endRadius: Math.max(
          interactionConfig.rippleEndRadius,
          Math.min(window.innerWidth, window.innerHeight) * 0.17
        )
      });
    }

    function updateRipples(now) {
      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        const progress = clamp((now - ripple.bornAt) / interactionConfig.rippleLifetime, 0, 1);
        const easedProgress = easeOutCubic(progress);
        const radius = lerp(ripple.startRadius, ripple.endRadius, easedProgress);
        const opacity = (1 - progress) ** 1.8;

        ripple.element.style.width = `${radius * 2}px`;
        ripple.element.style.height = `${radius * 2}px`;
        ripple.element.style.transform = `translate(${ripple.x - radius}px, ${ripple.y - radius}px)`;
        ripple.element.style.opacity = opacity.toFixed(3);

        if (progress >= 1) {
          ripple.element.remove();
          ripples.splice(index, 1);
        }
      }
    }

    function updateCollisionJiggle(delta) {
      blocks.forEach((block) => {
        block.jiggleTime = Math.min(block.jiggleTime + delta, collisionJiggleConfig.settleDuration);

        if (block.jiggleTime >= collisionJiggleConfig.settleDuration) {
          block.jiggleCompressionX = 0;
          block.jiggleCompressionY = 0;
          block.jiggleTiltAmplitude = 0;
          block.jiggleAngle = 0;
          block.jiggleScaleX = 1;
          block.jiggleScaleY = 1;
          return;
        }

        const progress = block.jiggleTime / collisionJiggleConfig.settleDuration;
        const decay = (1 - progress) ** collisionJiggleConfig.dampingPower;
        const oscillation =
          -Math.cos((block.jiggleTime / collisionJiggleConfig.oscillationPeriod) * Math.PI * 2);
        const amount = Math.max(oscillation, 0) * decay;

        block.jiggleScaleX = 1 - block.jiggleCompressionX * amount;
        block.jiggleScaleY = 1 - block.jiggleCompressionY * amount;
        block.jiggleAngle = block.jiggleTiltAmplitude * oscillation * decay;
      });
    }

    function applyImpulse(x, y) {
      const responsiveRadius = Math.max(
        interactionConfig.impulseRadius * 0.78,
        Math.min(window.innerWidth, window.innerHeight) * 0.42
      );
      const responsiveStrength = lerp(
        interactionConfig.impulseStrength * 0.82,
        interactionConfig.impulseStrength,
        clamp(window.innerWidth / 1024, 0, 1)
      );

      blocks.forEach((block) => {
        const centerX = block.x + block.width / 2;
        const centerY = block.y + block.height / 2;
        const dx = centerX - x;
        const dy = centerY - y;
        const distance = Math.hypot(dx, dy);

        if (distance > responsiveRadius) {
          return;
        }

        const safeDistance = Math.max(distance, 10);
        const nx = dx / safeDistance;
        const ny = dy / safeDistance;
        const falloff = (1 - distance / responsiveRadius) ** 2;
        const impulse = responsiveStrength * falloff;

        block.vx += nx * impulse;
        block.vy += ny * impulse;
      });
    }

    function handlePointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      if (document.elementFromPoint(event.clientX, event.clientY) !== interactionLayer) {
        return;
      }

      applyImpulse(event.clientX, event.clientY);
      spawnRipple(event.clientX, event.clientY);
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
          const beforeAx = blocks[i].vx;
          const beforeAy = blocks[i].vy;
          const beforeBx = blocks[j].vx;
          const beforeBy = blocks[j].vy;
          resolveCollision(blocks[i], blocks[j]);
          const impactA = Math.hypot(blocks[i].vx - beforeAx, blocks[i].vy - beforeAy);
          const impactB = Math.hypot(blocks[j].vx - beforeBx, blocks[j].vy - beforeBy);

          if (impactA > 0.5 || impactB > 0.5) {
            const dx = (blocks[j].x + blocks[j].width / 2) - (blocks[i].x + blocks[i].width / 2);
            const dy = (blocks[j].y + blocks[j].height / 2) - (blocks[i].y + blocks[i].height / 2);
            const distance = Math.hypot(dx, dy) || 1;
            const normalX = dx / distance;
            const normalY = dy / distance;

            applyCollisionJiggle(blocks[i], normalX, normalY, impactA);
            applyCollisionJiggle(blocks[j], -normalX, -normalY, impactB);
          }
        }
      }

      updateCollisionJiggle(delta);

      blocks.forEach((block) => {
        bounceOffWalls(block, viewportWidth, viewportHeight);
        keepMomentum(block);
        renderBlock(block);
      });

      updateRipples(now);

      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', placeBlocks);
    interactionLayer.addEventListener('pointerdown', handlePointerDown, { passive: true });

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
