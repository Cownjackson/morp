(function () {
  const swatchConfigs = [
    { selector: '.swatch-1', xRatio: 0.03, yRatio: 0.05, vx: 55, vy: 46, rotation: 4, spin: 7 },
    { selector: '.swatch-2', xRatio: 0.58, yRatio: 0.04, vx: -53, vy: 43, rotation: -5, spin: -6 },
    { selector: '.swatch-3', xRatio: 0.04, yRatio: 0.46, vx: 58, vy: -42, rotation: 3, spin: 8 },
    { selector: '.swatch-4', xRatio: 0.57, yRatio: 0.58, vx: -49, vy: -54, rotation: -4, spin: -7 },
    { selector: '.swatch-5', xRatio: 0.12, yRatio: 0.7, vx: 52, vy: -50, rotation: 5, spin: 6 },
    { selector: '.swatch-6', xRatio: 0.42, yRatio: 0.16, vx: 47, vy: 53, rotation: -3, spin: -9 },
    { selector: '.swatch-7', xRatio: 0.74, yRatio: 0.36, vx: -56, vy: 44, rotation: 6, spin: 7 },
    { selector: '.swatch-8', xRatio: 0.29, yRatio: 0.74, vx: 54, vy: -58, rotation: -6, spin: -8 }
  ];

  const restitution = 0.98;
  const minSpeed = 42;
  const maxSpeed = 135;
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
    responsiveMinScale: 0.306,
    responsiveMaxScale: 1.035,
    baseCurvePower: 1.8,
    narrowViewportWidth: 430,
    narrowViewportMinBoost: 0.14,
    radiusMinScale: 0.82,
    radiusMaxScale: 1.04,
    radiusShortSideClamp: 0.19,
    referenceWidth: 1680,
    referenceHeight: 980,
    mobileBreakpoint: 960,
    mobileSizeBoost: 1.25
  };
  const prototypePlayerConfig = {
    id: 'local-prototype-player',
    xRatio: 0.48,
    yRatio: 0.5,
    vx: -44,
    vy: 41,
    rotation: 0,
    spin: 7,
    baseSize: 124,
    minScale: 0.74,
    maxScale: 1.18,
    speedScaleMultiplier: 0.82,
    labelFontMin: 0.68,
    labelFontMax: 0.88,
    labelMaxWidthRatio: 1.4
  };
  const floatingPlayerSeatRatios = [
    { xRatio: 0.18, yRatio: 0.22, vx: 36, vy: 42, spin: 6 },
    { xRatio: 0.74, yRatio: 0.18, vx: -38, vy: 39, spin: -5 },
    { xRatio: 0.84, yRatio: 0.52, vx: -42, vy: -34, spin: 7 },
    { xRatio: 0.68, yRatio: 0.78, vx: -34, vy: -40, spin: -6 },
    { xRatio: 0.34, yRatio: 0.8, vx: 39, vy: -36, spin: 5 },
    { xRatio: 0.1, yRatio: 0.58, vx: 35, vy: -41, spin: -7 },
    { xRatio: 0.28, yRatio: 0.38, vx: 40, vy: 33, spin: 6 },
    { xRatio: 0.58, yRatio: 0.34, vx: -37, vy: 35, spin: -5 },
    { xRatio: 0.46, yRatio: 0.62, vx: 33, vy: -38, spin: 7 },
    { xRatio: 0.88, yRatio: 0.3, vx: -35, vy: 37, spin: -6 }
  ];
  const responsiveBoostTiers = [
    {
      startWidth: 700,
      startHeight: 960,
      targetWidth: 820,
      targetHeight: 1180,
      boost: 1.08
    },
    {
      startWidth: sizeRanges.referenceWidth,
      startHeight: sizeRanges.referenceHeight,
      targetWidth: 2560,
      targetHeight: 1440,
      boost: 1.15
    },
    {
      startWidth: 2560,
      startHeight: 1440,
      targetWidth: 3840,
      targetHeight: 2160,
      boost: 1.3
    }
  ];
  const motionRanges = {
    responsiveMinSpeedScale: 0.72,
    responsiveMaxSpeedScale: 1
  };
  const interactionConfig = {
    impulseRadius: 320,
    impulseStrength: 150,
    rippleLifetime: 950,
    rippleStartRadius: 10,
    rippleEndRadius: 120,
    cornerRippleWindow: 180
  };
  const collisionJiggleConfig = {
    maxTilt: 0.72,
    maxStretch: 0.036,
    settleDuration: 0.5,
    speedToStretch: 0.028
  };
  const spinConfig = {
    couplingFactor: 0.06,
    maxSpeed: 24,
    decayPerSecond: 0.98
  };
  const ripplePalette = [
    '--mint',
    '--pinky',
    '--grape',
    '--mustard',
    '--sky',
    '--peach'
  ];
  const logoPaintConfig = {
    shadowDarkness: 0.52,
    shadowOpacity: 0.9,
    holdDuration: 234,
    fadeDuration: 468,
    detectionInsetRatio: 0.215,
    alphaThreshold: 108,
    maskSampleDivisions: 8
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomInRange(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function isPlayerEntity(entity) {
    return entity?.type === 'player';
  }

  function getPrototypePlayerPayload(overrides = {}) {
    return {
      id: prototypePlayerConfig.id,
      name: 'you',
      cosmetics: null,
      isHost: false,
      ...overrides
    };
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function easeOutCubic(value) {
    return 1 - (1 - value) ** 3;
  }

  function smootherstep(value) {
    const clamped = clamp(value, 0, 1);
    return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
  }

  function getViewportRatio(targetWidth, targetHeight) {
    return Math.min(window.innerWidth / targetWidth, window.innerHeight / targetHeight);
  }

  function getTierBoost() {
    let boost = 1;

    responsiveBoostTiers.forEach((tier) => {
      const startRatio = Math.min(
        tier.startWidth / tier.targetWidth,
        tier.startHeight / tier.targetHeight
      );
      const targetRatio = getViewportRatio(tier.targetWidth, tier.targetHeight);
      const progress = smootherstep(
        clamp((targetRatio - startRatio) / (1 - startRatio), 0, 1)
      );

      boost = lerp(boost, tier.boost, progress);
    });

    return boost;
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
    const smoothedScale = smootherstep(normalizedScale);
    const sizeCurveScale = smoothedScale ** sizeRanges.baseCurvePower;
    const narrowViewportRatio = clamp(window.innerWidth / sizeRanges.narrowViewportWidth, 0, 1);
    const narrowViewportAdjustment =
      smootherstep(1 - narrowViewportRatio) * sizeRanges.narrowViewportMinBoost;
    const baseViewportScale = clamp(
      sizeRanges.responsiveMinScale +
        (sizeRanges.responsiveMaxScale - sizeRanges.responsiveMinScale) * sizeCurveScale -
        narrowViewportAdjustment,
      sizeRanges.responsiveMinScale,
      sizeRanges.responsiveMaxScale
    );
    const mobileSizeBoost = window.innerWidth < sizeRanges.mobileBreakpoint ? sizeRanges.mobileSizeBoost : 1;
    const viewportScale = baseViewportScale * getTierBoost() * mobileSizeBoost;
    const speedScale = clamp(
      motionRanges.responsiveMinSpeedScale +
        (motionRanges.responsiveMaxSpeedScale - motionRanges.responsiveMinSpeedScale) * normalizedScale,
      motionRanges.responsiveMinSpeedScale,
      motionRanges.responsiveMaxSpeedScale
    );
    const radiusScale = clamp(
      sizeRanges.radiusMinScale +
        (sizeRanges.radiusMaxScale - sizeRanges.radiusMinScale) * smoothedScale ** 1.15,
      sizeRanges.radiusMinScale,
      sizeRanges.radiusMaxScale
    );

    return { viewportScale, speedScale, radiusScale };
  }

  function getHitbox(block, visual = false) {
    const angle = visual ? block.angle + block.jiggleAngle : block.angle;
    const scaleX = visual ? block.jiggleScaleX : 1;
    const scaleY = visual ? block.jiggleScaleY : 1;

    return {
      centerX: block.x + block.width / 2,
      centerY: block.y + block.height / 2,
      halfWidth: (block.width * scaleX * hitboxScale) / 2,
      halfHeight: (block.height * scaleY * hitboxScale) / 2,
      angle: (angle * Math.PI) / 180
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

  function pointInRotatedHitbox(hitbox, x, y) {
    const cos = Math.cos(hitbox.angle);
    const sin = Math.sin(hitbox.angle);
    const dx = x - hitbox.centerX;
    const dy = y - hitbox.centerY;
    const localX = (dx * cos) + (dy * sin);
    const localY = (-dx * sin) + (dy * cos);

    return (
      Math.abs(localX) <= hitbox.halfWidth &&
      Math.abs(localY) <= hitbox.halfHeight
    );
  }

  function bounceOffWalls(block, viewportWidth, viewportHeight) {
    const hitbox = getHitbox(block);
    const extents = getRotatedExtents(hitbox);
    const minX = hitbox.centerX - extents.x;
    const maxX = hitbox.centerX + extents.x;
    const minY = hitbox.centerY - extents.y;
    const maxY = hitbox.centerY + extents.y;

    let normalX = 0;
    let normalY = 0;

    if (minX <= 0) {
      block.x += -minX;
      block.vx = Math.abs(block.vx) * restitution;
      normalX = 1;
    } else if (maxX >= viewportWidth) {
      block.x -= maxX - viewportWidth;
      block.vx = -Math.abs(block.vx) * restitution;
      normalX = -1;
    }

    if (minY <= 0) {
      block.y += -minY;
      block.vy = Math.abs(block.vy) * restitution;
      normalY = 1;
    } else if (maxY >= viewportHeight) {
      block.y -= maxY - viewportHeight;
      block.vy = -Math.abs(block.vy) * restitution;
      normalY = -1;
    }

    return (normalX !== 0 || normalY !== 0) ? { normalX, normalY } : null;
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

      if (overlap <= 0) return null;

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

    // Positional correction: push each block out by half the overlap
    const half = smallestOverlap * 0.5;
    a.x -= normalX * half;
    a.y -= normalY * half;
    b.x += normalX * half;
    b.y += normalY * half;

    // Velocity impulse (equal mass elastic collision along normal)
    const relVx = b.vx - a.vx;
    const relVy = b.vy - a.vy;
    const approachSpeed = relVx * normalX + relVy * normalY;

    if (approachSpeed >= 0) return null;

    const impulse = -(1 + restitution) * approachSpeed * 0.5;

    a.vx -= impulse * normalX;
    a.vy -= impulse * normalY;
    b.vx += impulse * normalX;
    b.vy += impulse * normalY;

    // Spin coupling: tangential relative velocity bleeds into angular velocity
    const tx = -normalY;
    const ty = normalX;
    const relTangential = relVx * tx + relVy * ty;
    const spinDelta = relTangential * spinConfig.couplingFactor;
    a.spin = clamp(a.spin + spinDelta, -spinConfig.maxSpeed, spinConfig.maxSpeed);
    b.spin = clamp(b.spin - spinDelta, -spinConfig.maxSpeed, spinConfig.maxSpeed);

    return { normalX, normalY, impulse };
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
    if (isPlayerEntity(block)) {
      block.element.style.transform = `translate(${block.x}px, ${block.y}px)`;
      if (block.bodyElement) {
        block.bodyElement.style.transform =
          `rotate(${block.angle + block.jiggleAngle}deg) ` +
          `scale(${block.jiggleScaleX}, ${block.jiggleScaleY})`;
      }
      return;
    }

    block.element.style.transform =
      `translate(${block.x}px, ${block.y}px) ` +
      `rotate(${block.angle + block.jiggleAngle}deg) ` +
      `scale(${block.jiggleScaleX}, ${block.jiggleScaleY})`;
  }

  function renderPlayerEntityVisual(entity) {
    if (!entity?.bodyElement) return;
    entity.bodyElement.innerHTML = '';
    entity.bodyElement.style.visibility = 'hidden';

    if (!entity.playerData?.spriteSrc) {
      return;
    }

    const img = document.createElement('img');
    img.className = 'bg-player-sprite';
    img.alt = '';
    img.src = entity.playerData.spriteSrc;
    entity.bodyElement.appendChild(img);
    entity.bodyElement.style.visibility = 'visible';
  }

  function updatePlayerEntityText(entity) {
    if (!entity) return;
    if (entity.nameElement) {
      entity.nameElement.textContent = entity.playerData?.name || 'you';
      entity.nameElement.classList.toggle('is-you', entity.playerData?.isYou === true);
    }
    if (entity.crownElement) {
      entity.crownElement.style.display = entity.playerData?.isHost ? 'block' : 'none';
    }
  }

  function updatePlayerEntityLayout(entity, playerScale) {
    if (!entity || !entity.element || !entity.bodyElement || !entity.labelElement || !entity.nameElement) return;

    const bodySize = Math.round(entity.baseWidth * playerScale);
    const labelFontSize = clamp(
      0.5 + playerScale * 0.28,
      prototypePlayerConfig.labelFontMin,
      prototypePlayerConfig.labelFontMax
    );

    entity.width = bodySize;
    entity.height = bodySize;
    entity.radius = bodySize * 0.5;
    entity.element.style.width = `${bodySize}px`;
    entity.element.style.height = `${bodySize}px`;
    entity.bodyElement.style.width = `${bodySize}px`;
    entity.bodyElement.style.height = `${bodySize}px`;
    entity.labelElement.style.top = `${bodySize + 8}px`;
    entity.nameElement.style.fontSize = `${labelFontSize}rem`;
    entity.nameElement.style.maxWidth = `${Math.round(bodySize * prototypePlayerConfig.labelMaxWidthRatio)}px`;

    if (entity.crownElement) {
      entity.crownElement.style.fontSize = `${Math.max(0.7, labelFontSize + 0.04)}rem`;
    }
  }

  function createPlayerEntity(container, playerData = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bg-player-entity';

    const body = document.createElement('div');
    body.className = 'bg-player-body';

    const label = document.createElement('div');
    label.className = 'bg-player-label';

    const crown = document.createElement('div');
    crown.className = 'bg-player-crown';
    crown.textContent = '♛';

    const name = document.createElement('div');
    name.className = 'bg-player-name';

    label.append(crown, name);
    wrapper.append(body, label);
    container.appendChild(wrapper);

    const entity = {
      type: 'player',
      id: playerData.id || prototypePlayerConfig.id,
      playerData: getPrototypePlayerPayload(playerData),
      element: wrapper,
      bodyElement: body,
      labelElement: label,
      crownElement: crown,
      nameElement: name,
      width: prototypePlayerConfig.baseSize,
      height: prototypePlayerConfig.baseSize,
      baseWidth: prototypePlayerConfig.baseSize,
      baseHeight: prototypePlayerConfig.baseSize,
      color: 'transparent',
      radius: prototypePlayerConfig.baseSize * 0.5,
      baseRadius: prototypePlayerConfig.baseSize * 0.5,
      x: 0,
      y: 0,
      vx: prototypePlayerConfig.vx,
      vy: prototypePlayerConfig.vy,
      baseVx: prototypePlayerConfig.vx,
      baseVy: prototypePlayerConfig.vy,
      angle: prototypePlayerConfig.rotation,
      spin: prototypePlayerConfig.spin,
      jiggleCompressionX: 0,
      jiggleCompressionY: 0,
      jiggleTiltAmplitude: 0,
      jiggleTime: collisionJiggleConfig.settleDuration,
      jiggleAngle: 0,
      jiggleScaleX: 1,
      jiggleScaleY: 1,
      xRatio: prototypePlayerConfig.xRatio,
      yRatio: prototypePlayerConfig.yRatio,
      lastWallHitX: -Infinity,
      lastWallHitNX: 0,
      lastWallHitY: -Infinity,
      lastWallHitNY: 0
    };

    updatePlayerEntityText(entity);
    updatePlayerEntityLayout(entity, 1);
    renderPlayerEntityVisual(entity);

    return entity;
  }

  function getFloatingPlayerSeat(playerId, fallbackIndex = 0) {
    const hash = hashString(String(playerId || fallbackIndex));
    return floatingPlayerSeatRatios[hash % floatingPlayerSeatRatios.length];
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

  function parseRgbString(color) {
    const matches = color.match(/\d+(\.\d+)?/g);

    if (!matches || matches.length < 3) {
      return { r: 255, g: 255, b: 255 };
    }

    return {
      r: Number.parseFloat(matches[0]),
      g: Number.parseFloat(matches[1]),
      b: Number.parseFloat(matches[2])
    };
  }

  function darkenColor(color, factor) {
    return {
      r: Math.round(color.r * factor),
      g: Math.round(color.g * factor),
      b: Math.round(color.b * factor)
    };
  }

  function mixColor(start, end, amount) {
    return {
      r: Math.round(lerp(start.r, end.r, amount)),
      g: Math.round(lerp(start.g, end.g, amount)),
      b: Math.round(lerp(start.b, end.b, amount))
    };
  }

  function createLogoLetterObjects(landingLogoText) {
    if (!landingLogoText) {
      return [];
    }

    return Array.from(landingLogoText.querySelectorAll('.logo-letter')).map((element) => {
      const character = element.dataset.letter || element.textContent.trim();
      element.dataset.letter = character;

      if (!element.querySelector('.logo-letter-fill')) {
        const shadowElement = document.createElement('span');
        shadowElement.className = 'logo-letter-shadow';
        shadowElement.setAttribute('aria-hidden', 'true');
        shadowElement.textContent = character;

        const fillElement = document.createElement('span');
        fillElement.className = 'logo-letter-fill';
        fillElement.setAttribute('aria-hidden', 'true');
        fillElement.textContent = character;

        element.textContent = '';
        element.append(shadowElement, fillElement);
      }

      return {
        element,
        fillElement: element.querySelector('.logo-letter-fill'),
        bounds: null,
        character,
        maskCanvas: document.createElement('canvas'),
        maskAlpha: null,
        maskScale: 1,
        maskWidth: 0,
        maskHeight: 0,
        lastPaintedAt: -Infinity,
        lastPaintColor: null
      };
    });
  }

  function getLogoFont(fillElement) {
    const style = getComputedStyle(fillElement);
    const fontStyle = style.fontStyle || 'normal';
    const fontWeight = style.fontWeight || '400';
    const fontSize = style.fontSize || '16px';
    const fontFamily = style.fontFamily || 'sans-serif';

    return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
  }

  function rebuildLogoLetterMask(letter) {
    const bounds = letter.bounds;
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      letter.maskAlpha = null;
      letter.maskWidth = 0;
      letter.maskHeight = 0;
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = Math.max(1, Math.ceil(bounds.width * dpr));
    const canvasHeight = Math.max(1, Math.ceil(bounds.height * dpr));
    const canvas = letter.maskCanvas;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      letter.maskAlpha = null;
      letter.maskWidth = 0;
      letter.maskHeight = 0;
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.font = getLogoFont(letter.fillElement);
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#fff';

    const metrics = context.measureText(letter.character);
    const glyphWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const x =
      ((bounds.width - glyphWidth) / 2) + metrics.actualBoundingBoxLeft;
    const y =
      ((bounds.height - glyphHeight) / 2) + metrics.actualBoundingBoxAscent;

    context.fillText(letter.character, x, y);

    letter.maskAlpha = context.getImageData(0, 0, canvasWidth, canvasHeight).data;
    letter.maskScale = dpr;
    letter.maskWidth = canvasWidth;
    letter.maskHeight = canvasHeight;
  }

  function letterHasShapeOverlap(letter, hitbox, overlapLeft, overlapTop, overlapRight, overlapBottom) {
    if (!letter.maskAlpha || !letter.bounds) {
      return false;
    }

    const scale = letter.maskScale;
    const startX = Math.max(0, Math.floor((overlapLeft - letter.bounds.left) * scale));
    const endX = Math.min(letter.maskWidth, Math.ceil((overlapRight - letter.bounds.left) * scale));
    const startY = Math.max(0, Math.floor((overlapTop - letter.bounds.top) * scale));
    const endY = Math.min(letter.maskHeight, Math.ceil((overlapBottom - letter.bounds.top) * scale));

    if (endX <= startX || endY <= startY) {
      return false;
    }

    const sampleStep = Math.max(
      1,
      Math.floor(Math.min(endX - startX, endY - startY) / logoPaintConfig.maskSampleDivisions)
    );

    for (let y = startY; y < endY; y += sampleStep) {
      for (let x = startX; x < endX; x += sampleStep) {
        const viewportX = letter.bounds.left + (x / scale);
        const viewportY = letter.bounds.top + (y / scale);
        if (!pointInRotatedHitbox(hitbox, viewportX, viewportY)) {
          continue;
        }

        const alphaIndex = ((y * letter.maskWidth) + x) * 4 + 3;
        if (letter.maskAlpha[alphaIndex] >= logoPaintConfig.alphaThreshold) {
          return true;
        }
      }
    }

    const centerX = Math.floor((startX + endX - 1) / 2);
    const centerY = Math.floor((startY + endY - 1) / 2);
    const centerViewportX = letter.bounds.left + (centerX / scale);
    const centerViewportY = letter.bounds.top + (centerY / scale);
    if (!pointInRotatedHitbox(hitbox, centerViewportX, centerViewportY)) {
      return false;
    }

    const centerIndex = ((centerY * letter.maskWidth) + centerX) * 4 + 3;
    return letter.maskAlpha[centerIndex] >= logoPaintConfig.alphaThreshold;
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
    const landingLogoText = document.getElementById('landing-logo-text');
    const logoLetters = createLogoLetterObjects(landingLogoText);
    const defaultLogoFill = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--punch'));
    const defaultLogoShadow = darkenColor(defaultLogoFill, logoPaintConfig.shadowDarkness);
    let logoBoundsRaf = 0;

    const shapeModes = shuffle([
      'square', 'square', 'square', 'square',
      'rectangle', 'rectangle', 'rectangle', 'rectangle'
    ]);

    const blocks = swatchConfigs.map((config) => {
      const element = container.querySelector(config.selector);
      const { width, height } = generateBlockSize(shapeModes.pop());
      const baseRadius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;

      element.style.width = `${width}px`;
      element.style.height = `${height}px`;

      const dvdImg = document.createElement('img');
      dvdImg.src = 'assets/dvd_logo.png';
      dvdImg.className = 'swatch-dvd-logo';
      dvdImg.setAttribute('aria-hidden', 'true');
      dvdImg.setAttribute('draggable', 'false');
      dvdImg.style.opacity = '0';
      element.appendChild(dvdImg);

      return {
        element,
        width,
        height,
        baseWidth: width,
        baseHeight: height,
        color: getComputedStyle(element).backgroundColor,
        radius: baseRadius,
        baseRadius,
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
        yRatio: config.yRatio,
        lastWallHitX: -Infinity,
        lastWallHitNX: 0,
        lastWallHitY: -Infinity,
        lastWallHitNY: 0,
        dvdImg,
        dvdTimeout: null
      };
    });
    const playerEntities = [];
    const playerEntitiesById = new Map();
    const prototypePlayerEntity = createPlayerEntity(container, getPrototypePlayerPayload());
    playerEntities.push(prototypePlayerEntity);
    prototypePlayerEntity.hiddenFromScene = true;
    prototypePlayerEntity.element.classList.add('hidden');
    const backgroundMoopModes = Object.freeze({
      OFF: 'off',
      PREGAME: 'pregame',
    });
    let backgroundMoopMode = backgroundMoopModes.OFF;

    function getPhysicsEntities() {
      return blocks.concat(playerEntities.filter((entity) => !entity.hiddenFromScene));
    }

    function syncPrototypePlayer(overrides = {}) {
      prototypePlayerEntity.playerData = getPrototypePlayerPayload(overrides);
      updatePlayerEntityText(prototypePlayerEntity);
      renderPlayerEntityVisual(prototypePlayerEntity);
    }

    function showPrototypePlayer(show) {
      prototypePlayerEntity.element.classList.toggle('hidden', !show);
      prototypePlayerEntity.hiddenFromScene = !show;
    }

    function attachPlayerEntity(entity) {
      if (!playerEntities.includes(entity)) {
        playerEntities.push(entity);
      }
      entity.hiddenFromScene = false;
      entity.element.classList.remove('hidden');
    }

    function detachPlayerEntity(entity) {
      const index = playerEntities.indexOf(entity);
      if (index >= 0) {
        playerEntities.splice(index, 1);
      }
      entity.element.remove();
    }

    function clearBackgroundPlayers() {
      Array.from(playerEntitiesById.values()).forEach((entity) => {
        playerEntitiesById.delete(entity.id);
        detachPlayerEntity(entity);
      });
      showPrototypePlayer(false);
    }

    function setBackgroundMoopMode(mode = backgroundMoopModes.OFF) {
      backgroundMoopMode = mode === backgroundMoopModes.PREGAME
        ? backgroundMoopModes.PREGAME
        : backgroundMoopModes.OFF;

      if (backgroundMoopMode === backgroundMoopModes.OFF) {
        clearBackgroundPlayers();
      }
    }

    function updatePlayerEntityFromPlayer(entity, playerData = {}) {
      const previousSpriteSrc = entity.playerData?.spriteSrc;
      const previousName = entity.playerData?.name;
      const previousIsHost = entity.playerData?.isHost;
      const previousIsYou = entity.playerData?.isYou;

      entity.playerData = {
        ...entity.playerData,
        ...playerData
      };

      if (
        previousName !== entity.playerData.name ||
        previousIsHost !== entity.playerData.isHost ||
        previousIsYou !== entity.playerData.isYou
      ) {
        updatePlayerEntityText(entity);
      }

      if (previousSpriteSrc !== entity.playerData.spriteSrc) {
        renderPlayerEntityVisual(entity);
      }
    }

    function createPlayerEntityFromPlayer(playerData = {}) {
      const entity = createPlayerEntity(container, playerData);
      const seat = getFloatingPlayerSeat(playerData.id, playerEntitiesById.size);
      entity.xRatio = seat.xRatio;
      entity.yRatio = seat.yRatio;
      entity.vx = seat.vx;
      entity.vy = seat.vy;
      entity.baseVx = seat.vx;
      entity.baseVy = seat.vy;
      entity.spin = seat.spin;
      attachPlayerEntity(entity);
      playerEntitiesById.set(playerData.id, entity);
      return entity;
    }

    function syncPregameLobbyMoops(players = []) {
      if (backgroundMoopMode !== backgroundMoopModes.PREGAME) {
        clearBackgroundPlayers();
        return;
      }

      if (!Array.isArray(players) || players.length === 0) {
        clearBackgroundPlayers();
        return;
      }

      showPrototypePlayer(false);

      const incomingIds = new Set(players.map((player) => player.id));

      Array.from(playerEntitiesById.entries()).forEach(([playerId, entity]) => {
        if (incomingIds.has(playerId)) return;
        playerEntitiesById.delete(playerId);
        detachPlayerEntity(entity);
      });

      players.forEach((player) => {
        const existing = playerEntitiesById.get(player.id);
        if (existing) {
          updatePlayerEntityFromPlayer(existing, player);
          return;
        }

        createPlayerEntityFromPlayer(player);
      });
    }

    function syncBackgroundPlayers(players = []) {
      if (!Array.isArray(players) || players.length === 0) {
        setBackgroundMoopMode(backgroundMoopModes.OFF);
        return;
      }

      setBackgroundMoopMode(backgroundMoopModes.PREGAME);
      syncPregameLobbyMoops(players);
    }
    function triggerCornerFanfare(block) {
      if (!block?.dvdImg) {
        return;
      }

      block.element.classList.remove('corner-flash');
      void block.element.offsetWidth;
      block.element.classList.add('corner-flash');

      block.dvdImg.style.opacity = '1';
      clearTimeout(block.dvdTimeout);
      block.dvdTimeout = setTimeout(() => {
        block.dvdImg.style.opacity = '0';
      }, 10000);
    }

    function updateLogoLetterBounds() {
      logoLetters.forEach((letter) => {
        letter.bounds = letter.fillElement.getBoundingClientRect();
        rebuildLogoLetterMask(letter);
      });
    }

    function scheduleLogoBoundsRefresh(frameCount = 2) {
      if (logoBoundsRaf) {
        cancelAnimationFrame(logoBoundsRaf);
      }

      const refresh = (remainingFrames) => {
        if (remainingFrames > 0) {
          logoBoundsRaf = requestAnimationFrame(() => refresh(remainingFrames - 1));
          return;
        }

        logoBoundsRaf = 0;
        updateLogoLetterBounds();
      };

      refresh(frameCount);
    }

    function updateLogoPaint(now) {
      if (!logoLetters.length) {
        return;
      }

      const bestByLetter = logoLetters.map(() => ({ score: 0, color: null }));

      blocks.forEach((block) => {
        const hitbox = getHitbox(block, true);
        const extents = getRotatedExtents(hitbox);
        const blockLeft = hitbox.centerX - extents.x;
        const blockRight = hitbox.centerX + extents.x;
        const blockTop = hitbox.centerY - extents.y;
        const blockBottom = hitbox.centerY + extents.y;

        logoLetters.forEach((letter, index) => {
          const bounds = letter.bounds;
          if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            return;
          }

          const insetX = bounds.width * logoPaintConfig.detectionInsetRatio;
          const insetY = bounds.height * logoPaintConfig.detectionInsetRatio;
          const effectiveLeft = bounds.left + insetX;
          const effectiveRight = bounds.right - insetX;
          const effectiveTop = bounds.top + insetY;
          const effectiveBottom = bounds.bottom - insetY;

          const overlapWidth = Math.min(blockRight, effectiveRight) - Math.max(blockLeft, effectiveLeft);
          const overlapHeight = Math.min(blockBottom, effectiveBottom) - Math.max(blockTop, effectiveTop);

          if (overlapWidth <= 0 || overlapHeight <= 0) {
            return;
          }

          const overlapLeft = Math.max(blockLeft, effectiveLeft);
          const overlapTop = Math.max(blockTop, effectiveTop);
          const overlapRight = Math.min(blockRight, effectiveRight);
          const overlapBottom = Math.min(blockBottom, effectiveBottom);

          if (!letterHasShapeOverlap(letter, hitbox, overlapLeft, overlapTop, overlapRight, overlapBottom)) {
            return;
          }

          const score = overlapWidth * overlapHeight;
          if (score > bestByLetter[index].score) {
            bestByLetter[index] = { score, color: parseRgbString(block.color) };
          }
        });
      });

      logoLetters.forEach((letter, index) => {
        if (bestByLetter[index].color) {
          letter.lastPaintColor = bestByLetter[index].color;
          letter.lastPaintedAt = now;
        }

        const elapsed = now - letter.lastPaintedAt;
        const fadeProgress = clamp(
          (elapsed - logoPaintConfig.holdDuration) / logoPaintConfig.fadeDuration,
          0,
          1
        );
        const activeColor = letter.lastPaintColor ?? defaultLogoFill;
        const fillColor = mixColor(activeColor, defaultLogoFill, fadeProgress);
        const shadowColor = mixColor(
          darkenColor(activeColor, logoPaintConfig.shadowDarkness),
          defaultLogoShadow,
          fadeProgress
        );

        letter.element.style.setProperty('--logo-fill', rgbaString(fillColor, 1));
        letter.element.style.setProperty(
          '--logo-shadow',
          rgbaString(shadowColor, logoPaintConfig.shadowOpacity)
        );
      });
    }

    function applyCollisionJiggle(block, normalX, normalY, impact) {
      const jiggleStrength = Math.min(impact * collisionJiggleConfig.speedToStretch, 1);
      const compressionX = Math.abs(normalX) * collisionJiggleConfig.maxStretch * jiggleStrength;
      const compressionY = Math.abs(normalY) * collisionJiggleConfig.maxStretch * jiggleStrength;

      block.jiggleCompressionX = clamp(
        block.jiggleCompressionX + compressionX,
        0,
        collisionJiggleConfig.maxStretch
      );
      block.jiggleCompressionY = clamp(
        block.jiggleCompressionY + compressionY,
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
      const { viewportScale, speedScale, radiusScale } = getResponsiveMetrics();

      blocks.forEach((block) => {
        block.width = Math.round(block.baseWidth * viewportScale);
        block.height = Math.round(block.baseHeight * viewportScale);
        const shortestSide = Math.min(block.width, block.height);
        const scaledRadius = block.baseRadius * radiusScale;
        block.radius = Math.min(
          scaledRadius,
          Math.max(8, shortestSide * sizeRanges.radiusShortSideClamp)
        );
        block.element.style.width = `${block.width}px`;
        block.element.style.height = `${block.height}px`;
        block.element.style.borderRadius = `${block.radius}px`;
        block.vx = Math.sign(block.vx || block.baseVx) * Math.abs(block.baseVx * speedScale);
        block.vy = Math.sign(block.vy || block.baseVy) * Math.abs(block.baseVy * speedScale);
      });

      const playerScale = clamp(
        viewportScale * 1.02,
        prototypePlayerConfig.minScale,
        prototypePlayerConfig.maxScale
      );
      const playerSpeedScale = speedScale * prototypePlayerConfig.speedScaleMultiplier;

      playerEntities.forEach((entity) => {
        updatePlayerEntityLayout(entity, playerScale);
        entity.vx = Math.sign(entity.vx || entity.baseVx) * Math.abs(entity.baseVx * playerSpeedScale);
        entity.vy = Math.sign(entity.vy || entity.baseVy) * Math.abs(entity.baseVy * playerSpeedScale);
      });
    }

    function placeBlocks() {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      updateResponsiveLayout();

      getPhysicsEntities().forEach((entity) => {
        const maxX = Math.max(viewportWidth - entity.width, 0);
        const maxY = Math.max(viewportHeight - entity.height, 0);

        entity.x = clamp(maxX * entity.xRatio, 0, maxX);
        entity.y = clamp(maxY * entity.yRatio, 0, maxY);
        bounceOffWalls(entity, viewportWidth, viewportHeight);
        renderBlock(entity);
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
      getPhysicsEntities().forEach((block) => {
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
        const amount = Math.sin(progress * Math.PI);

        block.jiggleScaleX = 1 - block.jiggleCompressionX * amount + block.jiggleCompressionY * amount;
        block.jiggleScaleY = 1 - block.jiggleCompressionY * amount + block.jiggleCompressionX * amount;
        block.jiggleAngle = block.jiggleTiltAmplitude * Math.sin(progress * Math.PI * 2);
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

      getPhysicsEntities().forEach((block) => {
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
      const physicsEntities = getPhysicsEntities();

      // Integrate positions
      physicsEntities.forEach((block) => {
        block.x += block.vx * delta;
        block.y += block.vy * delta;
        block.angle += block.spin * delta;
        block.spin *= spinConfig.decayPerSecond ** delta;
      });

      // Block-block collision — two passes: first applies impulse + jiggle,
      // second cleans up any residual overlap without re-triggering jiggle
      for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < physicsEntities.length; i += 1) {
          for (let j = i + 1; j < physicsEntities.length; j += 1) {
            const hit = resolveCollision(physicsEntities[i], physicsEntities[j]);
            if (hit && hit.impulse > 0.5 && pass === 0) {
              applyCollisionJiggle(physicsEntities[i], -hit.normalX, -hit.normalY, hit.impulse);
              applyCollisionJiggle(physicsEntities[j], hit.normalX, hit.normalY, hit.impulse);
            }
          }
        }
      }

      // Wall bounce — single pass after collision resolution, with jiggle + corner ripple
      physicsEntities.forEach((block) => {
        const wallHit = bounceOffWalls(block, viewportWidth, viewportHeight);
        if (wallHit) {
          const speed = Math.hypot(block.vx, block.vy);
          applyCollisionJiggle(block, wallHit.normalX, wallHit.normalY, speed * 0.4);

          if (wallHit.normalX !== 0) {
            block.lastWallHitX = now;
            block.lastWallHitNX = wallHit.normalX;
          }
          if (wallHit.normalY !== 0) {
            block.lastWallHitY = now;
            block.lastWallHitNY = wallHit.normalY;
          }
          if (now - block.lastWallHitX < interactionConfig.cornerRippleWindow &&
              now - block.lastWallHitY < interactionConfig.cornerRippleWindow) {
            const cornerX = block.lastWallHitNX < 0 ? viewportWidth : 0;
            const cornerY = block.lastWallHitNY < 0 ? viewportHeight : 0;
            spawnRipple(cornerX, cornerY);
            triggerCornerFanfare(block);
            block.lastWallHitX = -Infinity;
            block.lastWallHitY = -Infinity;
          }
        }
      });

      // Update jiggle animation, clamp speeds, render
      updateCollisionJiggle(delta);
      physicsEntities.forEach((block) => {
        keepMomentum(block);
        renderBlock(block);
      });

      updateLogoPaint(now);
      updateRipples(now);

      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
      updateLogoLetterBounds();
      placeBlocks();
      scheduleLogoBoundsRefresh(1);
    });
    interactionLayer.addEventListener('pointerdown', handlePointerDown, { passive: true });
    updateLogoLetterBounds();
    scheduleLogoBoundsRefresh();

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        updateLogoLetterBounds();
        scheduleLogoBoundsRefresh();
      });
    }

    if (typeof ResizeObserver !== 'undefined' && landingLogoText) {
      const logoObserver = new ResizeObserver(() => {
        updateLogoLetterBounds();
        scheduleLogoBoundsRefresh(1);
      });
      logoObserver.observe(landingLogoText);
    }

    placeBlocks();
    requestAnimationFrame((now) => {
      lastTime = now;
      animate(now);
    });

    window.addEventListener('background-prototype-player-change', (event) => {
      syncPrototypePlayer(event.detail || {});
    });
    window.setBackgroundMoopMode = setBackgroundMoopMode;
    window.syncPregameLobbyMoops = syncPregameLobbyMoops;
    window.syncBackgroundPlayers = syncBackgroundPlayers;
    window.setBackgroundPrototypePlayer = syncPrototypePlayer;
    syncPrototypePlayer(window.backgroundPrototypePlayerData || {});
    container.dataset.initialized = 'true';
  }

  window.initBackgroundBlocks = initBackgroundBlocks;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initBackgroundBlocks(), { once: true });
  } else {
    initBackgroundBlocks();
  }
})();
