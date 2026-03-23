(function () {
  const swatchConfigs = [
    { selector: '.swatch-1', xRatio: 0.03, yRatio: 0.05, vx: 55, vy: 46, rotation: 4, spin: 7, colorVariable: '--grape', baseRadius: 44 },
    { selector: '.swatch-2', xRatio: 0.58, yRatio: 0.04, vx: -53, vy: 43, rotation: -5, spin: -6, colorVariable: '--eggplant', baseRadius: 40 },
    { selector: '.swatch-3', xRatio: 0.04, yRatio: 0.46, vx: 58, vy: -42, rotation: 3, spin: 8, colorVariable: '--trumskin', baseRadius: 36 },
    { selector: '.swatch-4', xRatio: 0.57, yRatio: 0.58, vx: -49, vy: -54, rotation: -4, spin: -7, colorVariable: '--mint', baseRadius: 44 },
    { selector: '.swatch-5', xRatio: 0.12, yRatio: 0.7, vx: 52, vy: -50, rotation: 5, spin: 6, colorVariable: '--punch', baseRadius: 38 },
    { selector: '.swatch-6', xRatio: 0.42, yRatio: 0.16, vx: 47, vy: 53, rotation: -3, spin: -9, colorVariable: '--mustard', baseRadius: 32 },
    { selector: '.swatch-7', xRatio: 0.74, yRatio: 0.36, vx: -56, vy: 44, rotation: 6, spin: 7, colorVariable: '--pinky', baseRadius: 34 },
    { selector: '.swatch-8', xRatio: 0.29, yRatio: 0.74, vx: 54, vy: -58, rotation: -6, spin: -8, colorVariable: '--shreks-toe', baseRadius: 30 }
  ];
  const themeFallbacks = Object.freeze({
    '--eggplant': '#820D51',
    '--grape': '#6528CE',
    '--punch': '#B21030',
    '--mint': '#87DCAB',
    '--mustard': '#D1912A',
    '--pinky': '#FEAED2',
    '--trumskin': '#CC6711',
    '--shreks-toe': '#A3AF0A',
    '--sky': '#71B2E6',
    '--peach': '#FFE1B1'
  });

  const restitution = 0.98;
  const minSpeed = 42;
  const maxSpeed = 135;
  // Corner overdrive tuning is grouped by behavior so future visual passes are easy to edit.
  const cornerOverdriveConfig = Object.freeze({
    timing: Object.freeze({
      durationMs: 10000
    }),
    speed: Object.freeze({
      maxSpeedMultiplier: 2.625,
      sustainSpeedMultiplier: 1.2
    }),
    bounce: Object.freeze({
      restitutionMultiplier: 1.16,
      jiggleStretchMultiplier: 1.8,
      jiggleTiltMultiplier: 1.55,
      jiggleResponseMultiplier: 1.18,
      activationJiggleImpactMultiplier: 0.95
    }),
    speedLines: Object.freeze({
      spawnIntervalMs: 54,
      lifetimeMs: 520,
      lineCount: 3,
      thickness: Object.freeze({
        minPx: 4,
        maxPx: 18,
        blockRatio: 0.085
      }),
      length: Object.freeze({
        minPx: 32,
        maxPx: 350,
        blockRatio: 0.62,
        speedFactor: 0.04,
        multiplier: 1.56
      }),
      spread: Object.freeze({
        minPx: 12,
        maxPx: 44,
        blockRatio: 0.16
      }),
      stagger: Object.freeze({
        minPx: 8,
        maxPx: 30,
        blockRatio: 0.09
      }),
      sourceInset: Object.freeze({
        minPx: 12,
        blockRatio: 0.18
      }),
      segments: Object.freeze({
        densityMultiplier: 1.3,
        diameterRatio: 1.08,
        tailFadeStrength: 0.72
      }),
      color: Object.freeze({
        coreOpacity: 0.82,
        glowOpacity: 0.4
      })
    })
  });
  const hitboxScale = 0.95;
  const playerHitboxScale = 0.8;
  const sizeRanges = {
    squareMin: 170,
    squareMax: 350,
    squareVariance: 18,
    rectMin: 180,
    rectMax: 360,
    rectStretchMin: 30,
    rectStretchMax: 105,
    minSide: 150,
    radiusShortSideClamp: 0.19
  };
  // Shared responsive anchors for both block sprites and floating moops.
  // These are blended continuously so the scene never snaps between classes.
  // Ordered from smallest usable mobile viewport through large desktop.
  const responsiveSceneConfig = Object.freeze({
    referenceWidth: 1680,
    referenceHeight: 980,
    minBaseScale: 0.306,
    maxBaseScale: 1.035,
    baseCurvePower: 1.65,
    classMetricHeightWeight: 0.22,
    browserChromePenalty: 0.55,
    safePaddingShortSideRatio: 0.012,
    safePaddingChromeRatio: 0.16,
    minSafePadding: 14,
    maxSafePadding: 72,
    blockMinScale: 0.33,
    blockMaxScale: 1.22,
    blockRadiusMinScale: 0.82,
    blockRadiusMaxScale: 1.04,
    playerMinScale: 0.35,
    playerMaxScale: 1.08,
    profiles: [
      {
        classMetric: 520,
        blockScaleMultiplier: 1.08,
        playerScaleMultiplier: 1.14,
        speedScaleMultiplier: 0.96,
        radiusScaleMultiplier: 0.96,
        spreadScale: 0.78,
        impulseRadiusMultiplier: 0.92,
        impulseStrengthMultiplier: 0.82,
        rippleRadiusMultiplier: 0.88
      },
      {
        classMetric: 650,
        blockScaleMultiplier: 1.16,
        playerScaleMultiplier: 1.21,
        speedScaleMultiplier: 0.98,
        radiusScaleMultiplier: 0.98,
        spreadScale: 0.83,
        impulseRadiusMultiplier: 0.97,
        impulseStrengthMultiplier: 0.88,
        rippleRadiusMultiplier: 0.92
      },
      {
        classMetric: 980,
        blockScaleMultiplier: 1.28,
        playerScaleMultiplier: 1.3,
        speedScaleMultiplier: 1,
        radiusScaleMultiplier: 1,
        spreadScale: 0.9,
        impulseRadiusMultiplier: 1,
        impulseStrengthMultiplier: 0.93,
        rippleRadiusMultiplier: 0.97
      },
      {
        classMetric: 1400,
        blockScaleMultiplier: 1,
        playerScaleMultiplier: 1,
        speedScaleMultiplier: 1,
        radiusScaleMultiplier: 1,
        spreadScale: 1,
        impulseRadiusMultiplier: 1,
        impulseStrengthMultiplier: 1,
        rippleRadiusMultiplier: 1
      },
      {
        classMetric: 2300,
        blockScaleMultiplier: 1.15,
        playerScaleMultiplier: 1.02,
        speedScaleMultiplier: 1.02,
        radiusScaleMultiplier: 1.03,
        spreadScale: 1.08,
        impulseRadiusMultiplier: 1.08,
        impulseStrengthMultiplier: 1.04,
        rippleRadiusMultiplier: 1.05
      }
    ]
  });
  const prototypePlayerConfig = {
    id: 'local-prototype-player',
    xRatio: 0.48,
    yRatio: 0.5,
    vx: -44,
    vy: 41,
    rotation: 0,
    spin: 7,
    baseSize: 248,
    speedScaleMultiplier: 0.82,
    label: {
      gapPx: 0.4,
      baseFontRem: 0.5,
      fontScalePerPlayerScale: 0.28,
      minFontRem: 0.84,
      maxFontRem: 1.19,
      maxWidthRatio: 1.4,
      crownMinFontRem: 0.7,
      crownFontOffsetRem: 0.04
    }
  };
  const motionConfig = {
    minSpeedScale: 0.72,
    maxSpeedScale: 1
  };
  const softKeyboardConfig = Object.freeze({
    minHeightDrop: 120,
    minHeightDropRatio: 0.18,
    maxWidthDelta: 120,
    maxWidthDeltaRatio: 0.12,
    settleFrames: 3
  });
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
  const interactionConfig = {
    impulseRadius: 320,
    impulseStrength: 150,
    rippleLifetime: 950,
    rippleStartRadius: 10,
    rippleEndRadius: 120
  };
  const cornerTriggerConfig = Object.freeze({
    size: {
      minPx: 24,
      maxPx: 40,
      shortSideRatio: 0.035,
      scale: 0.85
    },
    effects: ['cornerRipple', 'cornerOverdrive', 'dvdFanfare']
  });
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
  const backgroundPerfSampleWindow = 180;
  const maxPooledSpeedLineGroups = 24;
  const maxPooledRipples = 32;
  const collisionScratch = {
    normalX: 0,
    normalY: 0,
    impulse: 0
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // Reused by both physics and visual hitboxes so we can invalidate cheaply
  // when a block moves or jiggles instead of rebuilding geometry every call.
  function createGeometryCache() {
    return {
      version: -1,
      centerX: 0,
      centerY: 0,
      halfWidth: 0,
      halfHeight: 0,
      angle: 0,
      cos: 1,
      sin: 0,
      axes: [
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      extents: {
        x: 0,
        y: 0
      },
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    };
  }

  function invalidateBlockGeometry(block) {
    block.geometryVersion = (block.geometryVersion || 0) + 1;
    block.visualGeometryVersion = (block.visualGeometryVersion || 0) + 1;
  }

  function invalidateBlockVisualGeometry(block) {
    block.visualGeometryVersion = (block.visualGeometryVersion || 0) + 1;
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

  function isCornerOverdriveActive(block, now = performance.now()) {
    return Number.isFinite(block?.cornerOverdriveUntil) && block.cornerOverdriveUntil > now;
  }

  function getCornerOverdriveTopSpeed() {
    return maxSpeed * cornerOverdriveConfig.speed.maxSpeedMultiplier;
  }

  function getBlockMaxSpeed(block, now = performance.now()) {
    return isCornerOverdriveActive(block, now) ? getCornerOverdriveTopSpeed() : maxSpeed;
  }

  function getBlockRestitution(block, now = performance.now()) {
    return restitution * (isCornerOverdriveActive(block, now) ? cornerOverdriveConfig.bounce.restitutionMultiplier : 1);
  }

  function getCollisionJiggleSettings(block, now = performance.now()) {
    if (!isCornerOverdriveActive(block, now)) {
      return collisionJiggleConfig;
    }

    return {
      maxTilt: collisionJiggleConfig.maxTilt * cornerOverdriveConfig.bounce.jiggleTiltMultiplier,
      maxStretch: collisionJiggleConfig.maxStretch * cornerOverdriveConfig.bounce.jiggleStretchMultiplier,
      settleDuration: collisionJiggleConfig.settleDuration,
      speedToStretch: collisionJiggleConfig.speedToStretch * cornerOverdriveConfig.bounce.jiggleResponseMultiplier
    };
  }

  function scaleCornerSpeedLineDimension(blockSize, dimensionConfig) {
    return clamp(
      blockSize * dimensionConfig.blockRatio,
      dimensionConfig.minPx,
      dimensionConfig.maxPx
    );
  }

  function getCornerSpeedLineMetrics(block) {
    const speedLineConfig = cornerOverdriveConfig.speedLines;
    const lengthConfig = speedLineConfig.length;
    const blockSize = Math.min(block.width, block.height);
    const speed = Math.hypot(block.vx, block.vy);
    const lineThickness = scaleCornerSpeedLineDimension(blockSize, speedLineConfig.thickness);
    const lineLength = clamp(
      (
        blockSize * lengthConfig.blockRatio
        + speed * lengthConfig.speedFactor
      ) * lengthConfig.multiplier,
      lengthConfig.minPx,
      lengthConfig.maxPx
    );

    return {
      speed,
      lineThickness,
      lineLength,
      lineSpread: scaleCornerSpeedLineDimension(blockSize, speedLineConfig.spread),
      lineStagger: scaleCornerSpeedLineDimension(blockSize, speedLineConfig.stagger),
      sourceInset: Math.max(
        blockSize * speedLineConfig.sourceInset.blockRatio,
        speedLineConfig.sourceInset.minPx
      )
    };
  }

  function getCornerSpeedLineSegmentCount(lineLength, lineThickness) {
    const segmentConfig = cornerOverdriveConfig.speedLines.segments;
    const segmentDiameter = lineThickness * segmentConfig.diameterRatio;

    return {
      segmentDiameter,
      segmentCount: Math.max(
        4,
        Math.round(
          (lineLength / Math.max(segmentDiameter, 1)) * segmentConfig.densityMultiplier
        )
      )
    };
  }

  function getCornerTriggerNormal(triggerId) {
    switch (triggerId) {
      case 'top-left':
        return { normalX: 1, normalY: 1 };
      case 'top-right':
        return { normalX: -1, normalY: 1 };
      case 'bottom-left':
        return { normalX: 1, normalY: -1 };
      case 'bottom-right':
        return { normalX: -1, normalY: -1 };
      default:
        return { normalX: 0, normalY: 0 };
    }
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
      spriteBounds: null,
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

  let viewportState = null;
  let stableViewportSnapshot = null;
  const keyboardViewportState = {
    focusedElement: null,
    baselineSnapshot: null,
    locked: false,
    settling: false,
    settleRaf: 0
  };

  function mixResponsiveProfile(lowerProfile, upperProfile, amount) {
    return {
      blockScaleMultiplier: lerp(lowerProfile.blockScaleMultiplier, upperProfile.blockScaleMultiplier, amount),
      playerScaleMultiplier: lerp(lowerProfile.playerScaleMultiplier, upperProfile.playerScaleMultiplier, amount),
      speedScaleMultiplier: lerp(lowerProfile.speedScaleMultiplier, upperProfile.speedScaleMultiplier, amount),
      radiusScaleMultiplier: lerp(lowerProfile.radiusScaleMultiplier, upperProfile.radiusScaleMultiplier, amount),
      spreadScale: lerp(lowerProfile.spreadScale, upperProfile.spreadScale, amount),
      impulseRadiusMultiplier: lerp(lowerProfile.impulseRadiusMultiplier, upperProfile.impulseRadiusMultiplier, amount),
      impulseStrengthMultiplier: lerp(lowerProfile.impulseStrengthMultiplier, upperProfile.impulseStrengthMultiplier, amount),
      rippleRadiusMultiplier: lerp(lowerProfile.rippleRadiusMultiplier, upperProfile.rippleRadiusMultiplier, amount)
    };
  }

  function getResponsiveProfile(classMetric) {
    const { profiles } = responsiveSceneConfig;
    if (classMetric <= profiles[0].classMetric) {
      return profiles[0];
    }

    for (let index = 1; index < profiles.length; index += 1) {
      const upperProfile = profiles[index];
      if (classMetric <= upperProfile.classMetric) {
        const lowerProfile = profiles[index - 1];
        const amount = smootherstep(
          clamp(
            (classMetric - lowerProfile.classMetric) /
            (upperProfile.classMetric - lowerProfile.classMetric),
            0,
            1
          )
        );
        return mixResponsiveProfile(lowerProfile, upperProfile, amount);
      }
    }

    return profiles[profiles.length - 1];
  }

  function shuffle(values) {
    const copy = [...values];

    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function getViewportSnapshot() {
    const layoutWidth =
      window.innerWidth ||
      document.documentElement.clientWidth ||
      responsiveSceneConfig.referenceWidth;
    const layoutHeight =
      window.innerHeight ||
      document.documentElement.clientHeight ||
      responsiveSceneConfig.referenceHeight;

    return {
      layoutWidth,
      layoutHeight,
      visibleWidth: Math.max(1, Math.round(window.visualViewport?.width || layoutWidth)),
      visibleHeight: Math.max(1, Math.round(window.visualViewport?.height || layoutHeight))
    };
  }

  function isTextEntryElement(element) {
    if (!element || element.disabled || element.readOnly) {
      return false;
    }

    if (element.isContentEditable) {
      return true;
    }

    const tagName = element.tagName?.toLowerCase();
    if (tagName === 'textarea') {
      return true;
    }

    if (tagName !== 'input') {
      return false;
    }

    const type = (element.getAttribute('type') || 'text').toLowerCase();
    return ![
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'reset',
      'submit'
    ].includes(type);
  }

  function hasFocusedTextEntry() {
    return (
      isTextEntryElement(keyboardViewportState.focusedElement) ||
      isTextEntryElement(document.activeElement)
    );
  }

  function isSoftKeyboardViewportShift(
    snapshot,
    baselineSnapshot = keyboardViewportState.baselineSnapshot || stableViewportSnapshot
  ) {
    if (!window.visualViewport || !baselineSnapshot) {
      return false;
    }

    const requiredHeightDrop = Math.max(
      softKeyboardConfig.minHeightDrop,
      baselineSnapshot.visibleHeight * softKeyboardConfig.minHeightDropRatio
    );
    const maxWidthDelta = Math.max(
      softKeyboardConfig.maxWidthDelta,
      baselineSnapshot.visibleWidth * softKeyboardConfig.maxWidthDeltaRatio
    );
    const heightDrop = baselineSnapshot.visibleHeight - snapshot.visibleHeight;
    const widthDelta = Math.abs(baselineSnapshot.visibleWidth - snapshot.visibleWidth);
    const layoutWidthDelta = Math.abs(baselineSnapshot.layoutWidth - snapshot.layoutWidth);

    return (
      heightDrop >= requiredHeightDrop &&
      widthDelta <= maxWidthDelta &&
      layoutWidthDelta <= maxWidthDelta
    );
  }

  function shouldPreserveSceneViewport(snapshot) {
    if (keyboardViewportState.settling) {
      return true;
    }

    if (!(hasFocusedTextEntry() || keyboardViewportState.locked)) {
      return false;
    }

    return isSoftKeyboardViewportShift(snapshot);
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

  function measureSceneViewport(snapshot = getViewportSnapshot()) {
    const { layoutWidth, layoutHeight, visibleWidth, visibleHeight } = snapshot;
    const browserChromeHeight = Math.max(Math.round(layoutHeight - visibleHeight), 0);
    const shortSide = Math.min(visibleWidth, visibleHeight);
    const baseFitScale = Math.min(
      visibleWidth / responsiveSceneConfig.referenceWidth,
      visibleHeight / responsiveSceneConfig.referenceHeight
    );
    const fitProgress = smootherstep(
      clamp(
        (baseFitScale - responsiveSceneConfig.minBaseScale) /
        (responsiveSceneConfig.maxBaseScale - responsiveSceneConfig.minBaseScale),
        0,
        1
      )
    );
    const baseScale = clamp(
      responsiveSceneConfig.minBaseScale +
      (responsiveSceneConfig.maxBaseScale - responsiveSceneConfig.minBaseScale) *
        (fitProgress ** responsiveSceneConfig.baseCurvePower),
      responsiveSceneConfig.minBaseScale,
      responsiveSceneConfig.maxBaseScale
    );
    const classMetric = Math.max(
      0,
      visibleWidth +
        (visibleHeight * responsiveSceneConfig.classMetricHeightWeight) -
        (browserChromeHeight * responsiveSceneConfig.browserChromePenalty)
    );
    const profile = getResponsiveProfile(classMetric);
    const bounds = {
      left: 0,
      top: 0,
      right: Math.max(visibleWidth, 1),
      bottom: Math.max(visibleHeight, 1)
    };
    bounds.width = Math.max(bounds.right - bounds.left, 1);
    bounds.height = Math.max(bounds.bottom - bounds.top, 1);

    return {
      layoutWidth,
      layoutHeight,
      visibleWidth,
      visibleHeight,
      blockScale: clamp(
        baseScale * profile.blockScaleMultiplier,
        responsiveSceneConfig.blockMinScale,
        responsiveSceneConfig.blockMaxScale
      ),
      playerScale: clamp(
        baseScale * profile.playerScaleMultiplier,
        responsiveSceneConfig.playerMinScale,
        responsiveSceneConfig.playerMaxScale
      ),
      speedScale: clamp(
        lerp(motionConfig.minSpeedScale, motionConfig.maxSpeedScale, fitProgress) * profile.speedScaleMultiplier,
        motionConfig.minSpeedScale,
        motionConfig.maxSpeedScale * 1.02
      ),
      radiusScale: clamp(
        lerp(
          responsiveSceneConfig.blockRadiusMinScale,
          responsiveSceneConfig.blockRadiusMaxScale,
          fitProgress ** 1.1
        ) * profile.radiusScaleMultiplier,
        responsiveSceneConfig.blockRadiusMinScale,
        responsiveSceneConfig.blockRadiusMaxScale * 1.04
      ),
      spreadScale: profile.spreadScale,
      bounds,
      impulseRadius:
        Math.max(interactionConfig.impulseRadius * 0.78, shortSide * 0.42) * profile.impulseRadiusMultiplier,
      impulseStrength:
        lerp(
          interactionConfig.impulseStrength * 0.82,
          interactionConfig.impulseStrength,
          clamp(visibleWidth / 1024, 0, 1)
        ) * profile.impulseStrengthMultiplier,
      rippleEndRadius:
        Math.max(interactionConfig.rippleEndRadius, shortSide * 0.17) * profile.rippleRadiusMultiplier
    };
  }

  function getSceneViewport() {
    const rawSnapshot = getViewportSnapshot();
    const snapshot = shouldPreserveSceneViewport(rawSnapshot)
      ? (stableViewportSnapshot || rawSnapshot)
      : rawSnapshot;

    if (
      !viewportState ||
      viewportState.layoutWidth !== snapshot.layoutWidth ||
      viewportState.layoutHeight !== snapshot.layoutHeight ||
      viewportState.visibleWidth !== snapshot.visibleWidth ||
      viewportState.visibleHeight !== snapshot.visibleHeight
    ) {
      viewportState = measureSceneViewport(snapshot);
    }

    return viewportState;
  }

  function spreadSceneRatio(ratio, spreadScale) {
    return clamp(0.5 + (((ratio ?? 0.5) - 0.5) * spreadScale), 0, 1);
  }

  function getEntityCollisionBounds(block) {
    if (!isPlayerEntity(block)) {
      return {
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        scale: hitboxScale
      };
    }

    const bounds = block.playerData?.spriteBounds;
    if (!bounds) {
      return {
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        scale: playerHitboxScale
      };
    }

    const left = clamp(bounds.left ?? 0, 0, 1);
    const top = clamp(bounds.top ?? 0, 0, 1);

    return {
      left,
      top,
      width: clamp(bounds.width ?? 1, 0.01, 1 - left),
      height: clamp(bounds.height ?? 1, 0.01, 1 - top),
      scale: playerHitboxScale
    };
  }

  function getHitbox(block, visual = false) {
    const cacheKey = visual ? 'visualGeometryCache' : 'physicsGeometryCache';
    const versionKey = visual ? 'visualGeometryVersion' : 'geometryVersion';
    const version = block[versionKey] || 0;
    const cache = block[cacheKey] || (block[cacheKey] = createGeometryCache());

    if (cache.version === version) {
      return cache;
    }

    const angle = visual ? block.angle + block.jiggleAngle : block.angle;
    const scaleX = visual ? block.jiggleScaleX : 1;
    const scaleY = visual ? block.jiggleScaleY : 1;
    const collisionBounds = getEntityCollisionBounds(block);
    const angleRadians = (angle * Math.PI) / 180;
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    const localCenterX = (collisionBounds.left + collisionBounds.width * 0.5) - 0.5;
    const localCenterY = (collisionBounds.top + collisionBounds.height * 0.5) - 0.5;
    const offsetX = localCenterX * block.width * scaleX;
    const offsetY = localCenterY * block.height * scaleY;

    cache.centerX = block.x + block.width / 2 + (offsetX * cos) - (offsetY * sin);
    cache.centerY = block.y + block.height / 2 + (offsetX * sin) + (offsetY * cos);
    cache.halfWidth = (block.width * scaleX * collisionBounds.width * collisionBounds.scale) / 2;
    cache.halfHeight = (block.height * scaleY * collisionBounds.height * collisionBounds.scale) / 2;
    cache.angle = angleRadians;
    cache.cos = cos;
    cache.sin = sin;
    cache.axes[0].x = cos;
    cache.axes[0].y = sin;
    cache.axes[1].x = -sin;
    cache.axes[1].y = cos;
    cache.extents.x = Math.abs(cos) * cache.halfWidth + Math.abs(sin) * cache.halfHeight;
    cache.extents.y = Math.abs(sin) * cache.halfWidth + Math.abs(cos) * cache.halfHeight;
    cache.left = cache.centerX - cache.extents.x;
    cache.right = cache.centerX + cache.extents.x;
    cache.top = cache.centerY - cache.extents.y;
    cache.bottom = cache.centerY + cache.extents.y;
    cache.version = version;

    return cache;
  }

  function getAxes(hitbox) {
    return hitbox.axes;
  }

  function getProjectionRadius(hitbox, axisX, axisY) {
    return (
      hitbox.halfWidth * Math.abs(axisX * hitbox.axes[0].x + axisY * hitbox.axes[0].y) +
      hitbox.halfHeight * Math.abs(axisX * hitbox.axes[1].x + axisY * hitbox.axes[1].y)
    );
  }

  function getAxisOverlap(hitboxA, hitboxB, axisX, axisY) {
    const centerProjectionA = hitboxA.centerX * axisX + hitboxA.centerY * axisY;
    const centerProjectionB = hitboxB.centerX * axisX + hitboxB.centerY * axisY;
    const radiusA = getProjectionRadius(hitboxA, axisX, axisY);
    const radiusB = getProjectionRadius(hitboxB, axisX, axisY);

    return Math.min(centerProjectionA + radiusA, centerProjectionB + radiusB) -
      Math.max(centerProjectionA - radiusA, centerProjectionB - radiusB);
  }

  function axisAlignedHitboxesOverlap(hitboxA, hitboxB) {
    return !(
      hitboxA.right <= hitboxB.left ||
      hitboxA.left >= hitboxB.right ||
      hitboxA.bottom <= hitboxB.top ||
      hitboxA.top >= hitboxB.bottom
    );
  }

  function getRotatedExtents(hitbox) {
    return hitbox.extents;
  }

  function createAxisAlignedHitbox(left, top, width, height) {
    const hitbox = createGeometryCache();
    hitbox.centerX = left + width / 2;
    hitbox.centerY = top + height / 2;
    hitbox.halfWidth = width / 2;
    hitbox.halfHeight = height / 2;
    hitbox.angle = 0;
    hitbox.cos = 1;
    hitbox.sin = 0;
    hitbox.axes[0].x = 1;
    hitbox.axes[0].y = 0;
    hitbox.axes[1].x = 0;
    hitbox.axes[1].y = 1;
    hitbox.extents.x = hitbox.halfWidth;
    hitbox.extents.y = hitbox.halfHeight;
    hitbox.left = left;
    hitbox.right = left + width;
    hitbox.top = top;
    hitbox.bottom = top + height;
    hitbox.version = 0;
    return hitbox;
  }

  function hitboxesOverlap(hitboxA, hitboxB) {
    if (!axisAlignedHitboxesOverlap(hitboxA, hitboxB)) {
      return false;
    }

    const axesA = hitboxA.axes;
    const axesB = hitboxB.axes;

    return (
      getAxisOverlap(hitboxA, hitboxB, axesA[0].x, axesA[0].y) > 0 &&
      getAxisOverlap(hitboxA, hitboxB, axesA[1].x, axesA[1].y) > 0 &&
      getAxisOverlap(hitboxA, hitboxB, axesB[0].x, axesB[0].y) > 0 &&
      getAxisOverlap(hitboxA, hitboxB, axesB[1].x, axesB[1].y) > 0
    );
  }

  function pointInRotatedHitbox(hitbox, x, y) {
    const cos = hitbox.cos ?? Math.cos(hitbox.angle);
    const sin = hitbox.sin ?? Math.sin(hitbox.angle);
    const dx = x - hitbox.centerX;
    const dy = y - hitbox.centerY;
    const localX = (dx * cos) + (dy * sin);
    const localY = (-dx * sin) + (dy * cos);

    return (
      Math.abs(localX) <= hitbox.halfWidth &&
      Math.abs(localY) <= hitbox.halfHeight
    );
  }

  function bounceOffWalls(block, bounds) {
    const hitbox = getHitbox(block);
    const extents = getRotatedExtents(hitbox);
    const minX = hitbox.centerX - extents.x;
    const maxX = hitbox.centerX + extents.x;
    const minY = hitbox.centerY - extents.y;
    const maxY = hitbox.centerY + extents.y;
    const blockRestitution = getBlockRestitution(block);

    let normalX = 0;
    let normalY = 0;

    if (minX <= bounds.left) {
      block.x += bounds.left - minX;
      block.vx = Math.abs(block.vx) * blockRestitution;
      normalX = 1;
    } else if (maxX >= bounds.right) {
      block.x -= maxX - bounds.right;
      block.vx = -Math.abs(block.vx) * blockRestitution;
      normalX = -1;
    }

    if (minY <= bounds.top) {
      block.y += bounds.top - minY;
      block.vy = Math.abs(block.vy) * blockRestitution;
      normalY = 1;
    } else if (maxY >= bounds.bottom) {
      block.y -= maxY - bounds.bottom;
      block.vy = -Math.abs(block.vy) * blockRestitution;
      normalY = -1;
    }

    if (normalX === 0 && normalY === 0) {
      return null;
    }

    invalidateBlockGeometry(block);
    collisionScratch.normalX = normalX;
    collisionScratch.normalY = normalY;
    collisionScratch.impulse = 0;
    return collisionScratch;
  }

  function resolveCollision(a, b, hitboxA = getHitbox(a), hitboxB = getHitbox(b)) {
    if (!axisAlignedHitboxesOverlap(hitboxA, hitboxB)) {
      return null;
    }

    const axesA = hitboxA.axes;
    const axesB = hitboxB.axes;
    let smallestOverlap = Infinity;
    let collisionAxisX = 0;
    let collisionAxisY = 0;

    const considerAxis = (axisX, axisY) => {
      const overlap = getAxisOverlap(hitboxA, hitboxB, axisX, axisY);

      if (overlap <= 0) {
        return false;
      }

      if (overlap < smallestOverlap) {
        smallestOverlap = overlap;
        collisionAxisX = axisX;
        collisionAxisY = axisY;
      }

      return true;
    };

    if (
      !considerAxis(axesA[0].x, axesA[0].y) ||
      !considerAxis(axesA[1].x, axesA[1].y) ||
      !considerAxis(axesB[0].x, axesB[0].y) ||
      !considerAxis(axesB[1].x, axesB[1].y)
    ) {
      return null;
    }

    const dx = hitboxB.centerX - hitboxA.centerX;
    const dy = hitboxB.centerY - hitboxA.centerY;
    let normalX = collisionAxisX;
    let normalY = collisionAxisY;

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
    invalidateBlockGeometry(a);
    invalidateBlockGeometry(b);

    // Velocity impulse (equal mass elastic collision along normal)
    const relVx = b.vx - a.vx;
    const relVy = b.vy - a.vy;
    const approachSpeed = relVx * normalX + relVy * normalY;

    if (approachSpeed >= 0) return null;

    const collisionRestitution = Math.max(getBlockRestitution(a), getBlockRestitution(b));
    const impulse = -(1 + collisionRestitution) * approachSpeed * 0.5;

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

    collisionScratch.normalX = normalX;
    collisionScratch.normalY = normalY;
    collisionScratch.impulse = impulse;
    return collisionScratch;
  }

  function keepMomentum(block) {
    const speed = Math.hypot(block.vx, block.vy);
    const blockMaxSpeed = getBlockMaxSpeed(block);

    if (speed < minSpeed) {
      const scale = minSpeed / (speed || 1);
      block.vx *= scale;
      block.vy *= scale;
    } else if (speed > blockMaxSpeed) {
      const scale = blockMaxSpeed / speed;
      block.vx *= scale;
      block.vy *= scale;
    }
  }

  function renderBlock(block) {
    if (isPlayerEntity(block)) {
      const bodyRotation = block.angle + block.jiggleAngle;
      block.element.style.transform = `translate(${block.x}px, ${block.y}px)`;
      if (block.bodyElement) {
        block.bodyElement.style.transform = `rotate(${bodyRotation}deg)`;
      }
      if (block.spriteElement) {
        block.spriteElement.style.transform = `scale(${block.jiggleScaleX}, ${block.jiggleScaleY})`;
      }
      return;
    }

    block.element.style.transform =
      `translate(${block.x}px, ${block.y}px) ` +
      `rotate(${block.angle + block.jiggleAngle}deg) ` +
      `scale(${block.jiggleScaleX}, ${block.jiggleScaleY})`;
  }

  function renderPlayerEntityVisual(entity) {
    if (!entity?.spriteElement) return;
    entity.spriteElement.innerHTML = '';
    entity.spriteElement.style.visibility = 'hidden';

    if (!entity.playerData?.spriteSrc) {
      return;
    }

    const img = document.createElement('img');
    img.className = 'bg-player-sprite';
    img.alt = '';
    img.src = entity.playerData.spriteSrc;
    entity.spriteElement.appendChild(img);
    entity.spriteElement.style.visibility = 'visible';
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
    if (!entity || !entity.element || !entity.bodyElement || !entity.spriteElement || !entity.labelElement || !entity.nameElement) return;

    const labelConfig = prototypePlayerConfig.label;
    const bodySize = Math.round(entity.baseWidth * playerScale);
    const labelFontSize = clamp(
      labelConfig.baseFontRem + playerScale * labelConfig.fontScalePerPlayerScale,
      labelConfig.minFontRem,
      labelConfig.maxFontRem
    );

    entity.width = bodySize;
    entity.height = bodySize;
    entity.radius = bodySize * 0.5;
    entity.element.style.width = `${bodySize}px`;
    entity.element.style.height = `${bodySize}px`;
    entity.bodyElement.style.width = `${bodySize}px`;
    entity.bodyElement.style.height = `${bodySize}px`;
    entity.spriteElement.style.width = `${bodySize}px`;
    entity.spriteElement.style.height = `${bodySize}px`;
    entity.labelElement.style.setProperty('--bg-player-label-gap', `${labelConfig.gapPx}px`);
    entity.nameElement.style.fontSize = `${labelFontSize}rem`;
    entity.nameElement.style.maxWidth = `${Math.round(bodySize * labelConfig.maxWidthRatio)}px`;

    if (entity.crownElement) {
      entity.crownElement.style.fontSize =
        `${Math.max(labelConfig.crownMinFontRem, labelFontSize + labelConfig.crownFontOffsetRem)}rem`;
    }

    invalidateBlockGeometry(entity);
  }

  function createPlayerEntity(container, playerData = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bg-player-entity';

    const body = document.createElement('div');
    body.className = 'bg-player-body';

    const sprite = document.createElement('div');
    sprite.className = 'bg-player-sprite-shell';

    const label = document.createElement('div');
    label.className = 'bg-player-label';

    const crown = document.createElement('div');
    crown.className = 'bg-player-crown';
    crown.textContent = '♛';

    const name = document.createElement('div');
    name.className = 'bg-player-name';

    label.append(crown, name);
    body.append(sprite, label);
    wrapper.appendChild(body);
    container.appendChild(wrapper);

    const entity = {
      type: 'player',
      id: playerData.id || prototypePlayerConfig.id,
      playerData: getPrototypePlayerPayload(playerData),
      element: wrapper,
      bodyElement: body,
      spriteElement: sprite,
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
      geometryVersion: 0,
      visualGeometryVersion: 0,
      physicsGeometryCache: createGeometryCache(),
      visualGeometryCache: createGeometryCache()
    };

    updatePlayerEntityText(entity);
    updatePlayerEntityLayout(entity, getSceneViewport().playerScale);
    renderPlayerEntityVisual(entity);

    return entity;
  }

  function getFloatingPlayerSeat(playerId, fallbackIndex = 0) {
    const hash = hashString(String(playerId || fallbackIndex));
    return floatingPlayerSeatRatios[hash % floatingPlayerSeatRatios.length];
  }

  function hexToRgb(hex) {
    const normalized = hex.trim();
    if (normalized.startsWith('rgb')) {
      return parseRgbString(normalized);
    }
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

  function getThemeColorRgb(cssVariable) {
    const value =
      getComputedStyle(document.documentElement).getPropertyValue(cssVariable).trim() ||
      themeFallbacks[cssVariable] ||
      '#FFFFFF';

    return hexToRgb(value);
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

  function createLogoLetterObjects(logoTextElement) {
    if (!logoTextElement) {
      return [];
    }

    return Array.from(logoTextElement.querySelectorAll('.logo-letter')).map((element) => {
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

    let speedLineLayer = container.querySelector('.background-speed-line-layer');
    if (!speedLineLayer) {
      speedLineLayer = document.createElement('div');
      speedLineLayer.className = 'background-speed-line-layer';
      container.insertBefore(speedLineLayer, container.firstChild);
    }

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

    let paletteColors = [];
    const ripples = [];
    const ripplePool = [];
    const speedLineGroupPool = [];
    let rippleIndex = 0;
    const logoTargetIds = ['landing-logo-text', 'pregame-logo-text'];
    let logoTextElements = [];
    let logoLetters = [];
    const logoPaintScores = [];
    let defaultLogoFill = getThemeColorRgb('--punch');
    let defaultLogoShadow = darkenColor(defaultLogoFill, logoPaintConfig.shadowDarkness);
    const refreshHandles = {
      logoBounds: 0,
      layout: 0,
      logo: 0
    };
    const perfStats = {
      frames: 0,
      frameTimeTotal: 0,
      maxFrameMs: 0,
      sections: {
        integrate: 0,
        collisions: 0,
        walls: 0,
        jiggleAndRender: 0,
        logo: 0,
        ripples: 0
      },
      collisionPairs: 0,
      broadPhaseRejected: 0,
      narrowPhaseTests: 0,
      collisionHits: 0,
      speedLineSpawns: 0,
      rippleSpawns: 0,
      lastFrameMs: 0,
      lastEntityCount: 0
    };

    function resetPerfStats() {
      perfStats.frames = 0;
      perfStats.frameTimeTotal = 0;
      perfStats.maxFrameMs = 0;
      perfStats.sections.integrate = 0;
      perfStats.sections.collisions = 0;
      perfStats.sections.walls = 0;
      perfStats.sections.jiggleAndRender = 0;
      perfStats.sections.logo = 0;
      perfStats.sections.ripples = 0;
      perfStats.collisionPairs = 0;
      perfStats.broadPhaseRejected = 0;
      perfStats.narrowPhaseTests = 0;
      perfStats.collisionHits = 0;
      perfStats.speedLineSpawns = 0;
      perfStats.rippleSpawns = 0;
      perfStats.lastFrameMs = 0;
      perfStats.lastEntityCount = 0;
    }

    function getPerfSnapshot() {
      const frames = Math.max(perfStats.frames, 1);
      const collisionPairs = perfStats.collisionPairs;
      const narrowPhaseTests = perfStats.narrowPhaseTests;

      return {
        frames: perfStats.frames,
        avgFrameMs: perfStats.frameTimeTotal / frames,
        maxFrameMs: perfStats.maxFrameMs,
        lastFrameMs: perfStats.lastFrameMs,
        avgCollisionPairs: collisionPairs / frames,
        avgNarrowPhaseTests: narrowPhaseTests / frames,
        broadPhaseRejectRate: collisionPairs > 0
          ? perfStats.broadPhaseRejected / collisionPairs
          : 0,
        collisionHits: perfStats.collisionHits,
        speedLineSpawns: perfStats.speedLineSpawns,
        rippleSpawns: perfStats.rippleSpawns,
        lastEntityCount: perfStats.lastEntityCount,
        pooledSpeedLineGroups: speedLineGroupPool.length,
        pooledRipples: ripplePool.length,
        liveRipples: ripples.length,
        sectionAverages: {
          integrate: perfStats.sections.integrate / frames,
          collisions: perfStats.sections.collisions / frames,
          walls: perfStats.sections.walls / frames,
          jiggleAndRender: perfStats.sections.jiggleAndRender / frames,
          logo: perfStats.sections.logo / frames,
          ripples: perfStats.sections.ripples / frames
        }
      };
    }

    window.backgroundBlocksPerf = {
      sampleWindow: backgroundPerfSampleWindow,
      reset: resetPerfStats,
      snapshot: getPerfSnapshot
    };

    function syncLogoTargets() {
      logoTextElements = logoTargetIds
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      logoLetters = logoTextElements.reduce((letters, logoTextElement) => (
        letters.concat(createLogoLetterObjects(logoTextElement))
      ), []);
    }

    function syncThemeStyles() {
      paletteColors = ripplePalette.map((cssVariable) => getThemeColorRgb(cssVariable));
      defaultLogoFill = getThemeColorRgb('--punch');
      defaultLogoShadow = darkenColor(defaultLogoFill, logoPaintConfig.shadowDarkness);

      blocks.forEach((block) => {
        block.colorRgb = getThemeColorRgb(block.colorVariable);
      });
    }

    function createBlockState(config, element, width, height) {
      return {
        element,
        width,
        height,
        baseWidth: width,
        baseHeight: height,
        colorVariable: config.colorVariable,
        colorRgb: getThemeColorRgb(config.colorVariable),
        radius: config.baseRadius,
        baseRadius: config.baseRadius,
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
        activeCornerTriggerMask: 0,
        cornerOverdriveUntil: 0,
        cornerOverdriveTargetSpeed: 0,
        cornerSpeedLinesLastAt: 0,
        dvdImg: null,
        dvdTimeout: null,
        geometryVersion: 0,
        visualGeometryVersion: 0,
        physicsGeometryCache: createGeometryCache(),
        visualGeometryCache: createGeometryCache()
      };
    }

    function createCornerTriggerBox(triggerBox, index) {
      let element = container.querySelector(`[data-corner-trigger-box="${triggerBox.id}"]`);
      if (!element) {
        element = document.createElement('div');
        element.className = 'background-corner-trigger-box';
        element.dataset.cornerTriggerBox = triggerBox.id;
        element.setAttribute('aria-hidden', 'true');
        container.insertBefore(element, rippleLayer);
      }

      return {
        ...triggerBox,
        maskBit: 1 << index,
        element,
        hitbox: null,
        cornerX: 0,
        cornerY: 0
      };
    }

    const shapeModes = shuffle([
      'square', 'square', 'square', 'square',
      'rectangle', 'rectangle', 'rectangle', 'rectangle'
    ]);

    const blocks = swatchConfigs.map((config) => {
      const element = container.querySelector(config.selector);
      const { width, height } = generateBlockSize(shapeModes.pop());

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
        ...createBlockState(config, element, width, height),
        dvdImg
      };
    });
    const cornerTriggerBoxes = [
      { id: 'top-left' },
      { id: 'top-right' },
      { id: 'bottom-left' },
      { id: 'bottom-right' }
    ].map(createCornerTriggerBox);
    const playerEntities = [];
    const playerEntitiesById = new Map();
    const activePhysicsEntities = [];

    // Keep a stable array for the animation loop to avoid rebuilding
    // blocks + visible players every frame.
    function syncActivePhysicsEntities() {
      activePhysicsEntities.length = 0;
      for (let index = 0; index < blocks.length; index += 1) {
        activePhysicsEntities.push(blocks[index]);
      }
      for (let index = 0; index < playerEntities.length; index += 1) {
        const entity = playerEntities[index];
        if (!entity.hiddenFromScene) {
          activePhysicsEntities.push(entity);
        }
      }
    }

    // Corner speed lines are short-lived, so pooling avoids repeated DOM
    // creation/removal during fast corner bounce bursts.
    function createSpeedLineGroupShell() {
      const group = document.createElement('div');
      group.className = 'background-speed-line-group';
      group._lines = [];
      group.addEventListener('animationend', () => {
        if (group.parentNode) {
          group.remove();
        }
        if (speedLineGroupPool.length < maxPooledSpeedLineGroups) {
          speedLineGroupPool.push(group);
        }
      });
      return group;
    }

    function hideSpeedLineGroupLines(group) {
      for (let lineIndex = 0; lineIndex < group._lines.length; lineIndex += 1) {
        group._lines[lineIndex].style.display = 'none';
      }
    }

    function acquireSpeedLineGroup() {
      const group = speedLineGroupPool.pop() || createSpeedLineGroupShell();
      group.style.animation = 'none';
      hideSpeedLineGroupLines(group);
      return group;
    }

    function getOrCreateSpeedLine(group, lineIndex) {
      let line = group._lines[lineIndex];
      if (!line) {
        line = document.createElement('div');
        line.className = 'background-speed-line';
        line._segments = [];
        group._lines.push(line);
        group.appendChild(line);
      }
      return line;
    }

    function ensureSpeedLineSegments(line, count) {
      const segments = line._segments || (line._segments = []);
      while (segments.length < count) {
        const segment = document.createElement('div');
        segment.className = 'background-speed-line-segment';
        line.appendChild(segment);
        segments.push(segment);
      }
      return segments;
    }

    function acquireRippleElement() {
      return ripplePool.pop() || document.createElement('div');
    }

    // Ripples are also pooled because interaction bursts can create many of
    // them in a short window.
    function releaseRippleElement(element) {
      if (element.parentNode) {
        element.remove();
      }
      if (ripplePool.length < maxPooledRipples) {
        ripplePool.push(element);
      }
    }

    function restartSpeedLineAnimation(group) {
      requestAnimationFrame(() => {
        group.style.animation = '';
      });
    }

    function spawnCornerSpeedLines(block, now = performance.now()) {
      if (!isCornerOverdriveActive(block, now)) {
        return;
      }

      const speedLineConfig = cornerOverdriveConfig.speedLines;
      const lifetime = Math.min(
        speedLineConfig.lifetimeMs,
        block.cornerOverdriveUntil - now
      );
      if (lifetime < 110) {
        return;
      }

      const {
        speed,
        lineThickness,
        lineLength,
        lineSpread,
        lineStagger,
        sourceInset
      } = getCornerSpeedLineMetrics(block);
      const dirX = speed > 0 ? block.vx / speed : 0;
      const dirY = speed > 0 ? block.vy / speed : 0;
      const centerX = block.x + block.width / 2;
      const centerY = block.y + block.height / 2;
      const anchorX = centerX - dirX * sourceInset;
      const anchorY = centerY - dirY * sourceInset;
      const group = acquireSpeedLineGroup();
      const angle = Math.atan2(dirY, dirX) * (180 / Math.PI);

      group.className = 'background-speed-line-group';
      group.style.setProperty(
        '--background-speed-line-transform',
        `translate(${anchorX}px, ${anchorY}px) rotate(${angle}deg)`
      );
      group.style.setProperty('--background-speed-line-lifetime', `${lifetime}ms`);
      group.style.setProperty(
        '--background-speed-line-core',
        rgbaString(block.colorRgb, speedLineConfig.color.coreOpacity)
      );
      group.style.setProperty(
        '--background-speed-line-glow',
        rgbaString(block.colorRgb, speedLineConfig.color.glowOpacity)
      );
      perfStats.speedLineSpawns += 1;

      for (let index = 0; index < speedLineConfig.lineCount; index += 1) {
        const line = getOrCreateSpeedLine(group, index);
        const yOffset =
          (index - ((speedLineConfig.lineCount - 1) / 2)) * lineSpread;
        const xOffset = -index * lineStagger;
        const individualLength = Math.max(
          speedLineConfig.length.minPx * 0.72,
          lineLength - index * lineStagger
        );

        line.style.display = '';
        line.style.width = `${individualLength}px`;
        line.style.height = `${lineThickness}px`;
        line.style.left = `${xOffset - individualLength}px`;
        line.style.top = `${yOffset - (lineThickness * 0.5)}px`;

        const { segmentDiameter, segmentCount } = getCornerSpeedLineSegmentCount(
          individualLength,
          lineThickness
        );
        const segmentTravel = Math.max(individualLength - segmentDiameter, 0);
        const segments = ensureSpeedLineSegments(line, segmentCount);

        for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
          const segment = segments[segmentIndex];
          const progress = segmentCount === 1 ? 0 : segmentIndex / (segmentCount - 1);
          const fadeAmount = 1 - progress * speedLineConfig.segments.tailFadeStrength;

          segment.style.display = '';
          segment.style.width = `${segmentDiameter}px`;
          segment.style.height = `${segmentDiameter}px`;
          segment.style.left = `${progress * segmentTravel}px`;
          segment.style.top = `${(lineThickness - segmentDiameter) * 0.5}px`;
          segment.style.opacity = fadeAmount.toFixed(3);
        }

        for (let segmentIndex = segmentCount; segmentIndex < segments.length; segmentIndex += 1) {
          segments[segmentIndex].style.display = 'none';
        }
      }

      for (let lineIndex = speedLineConfig.lineCount; lineIndex < group._lines.length; lineIndex += 1) {
        group._lines[lineIndex].style.display = 'none';
      }

      speedLineLayer.appendChild(group);
      restartSpeedLineAnimation(group);
    }

    function applyCornerOverdriveVelocity(block, now = performance.now()) {
      const directionX = block.vx || block.baseVx;
      const directionY = block.vy || block.baseVy;
      const directionLength = Math.hypot(directionX, directionY) || 1;
      const targetSpeed = block.cornerOverdriveTargetSpeed
        || getBlockMaxSpeed(block, now);

      block.vx = (directionX / directionLength) * targetSpeed;
      block.vy = (directionY / directionLength) * targetSpeed;
    }

    function updateCornerOverdriveEffects(now) {
      const speedLineConfig = cornerOverdriveConfig.speedLines;
      blocks.forEach((block) => {
        if (!isCornerOverdriveActive(block, now)) {
          block.cornerOverdriveTargetSpeed = 0;
          return;
        }

        applyCornerOverdriveVelocity(block, now);

        if (now - block.cornerSpeedLinesLastAt >= speedLineConfig.spawnIntervalMs) {
          spawnCornerSpeedLines(block, now);
          block.cornerSpeedLinesLastAt = now;
        }
      });
    }

    function triggerCornerOverdrive(block, triggerBox, now = performance.now()) {
      const overdriveTopSpeed = getCornerOverdriveTopSpeed();
      const speed = Math.hypot(block.vx, block.vy);
      const targetSpeed = Math.max(
        minSpeed,
        overdriveTopSpeed * cornerOverdriveConfig.speed.sustainSpeedMultiplier
      );
      const direction = speed > 0
        ? { x: block.vx / speed, y: block.vy / speed }
        : getCornerTriggerNormal(triggerBox.id);
      const directionLength = Math.hypot(direction.x, direction.y) || 1;

      block.cornerOverdriveUntil = now + cornerOverdriveConfig.timing.durationMs;
      block.cornerOverdriveTargetSpeed = targetSpeed;
      block.cornerSpeedLinesLastAt = now - cornerOverdriveConfig.speedLines.spawnIntervalMs;
      block.vx = (direction.x / directionLength) * targetSpeed;
      block.vy = (direction.y / directionLength) * targetSpeed;

      const { normalX, normalY } = getCornerTriggerNormal(triggerBox.id);
      applyCollisionJiggle(
        block,
        normalX,
        normalY,
        targetSpeed * cornerOverdriveConfig.bounce.activationJiggleImpactMultiplier
      );
      spawnCornerSpeedLines(block, now);
    }

    const prototypePlayerEntity = createPlayerEntity(container, getPrototypePlayerPayload());
    playerEntities.push(prototypePlayerEntity);
    prototypePlayerEntity.hiddenFromScene = true;
    prototypePlayerEntity.element.classList.add('hidden');
    syncActivePhysicsEntities();
    const backgroundMoopModes = Object.freeze({
      OFF: 'off',
      PREGAME: 'pregame',
    });
    let backgroundMoopMode = backgroundMoopModes.OFF;

    function getPhysicsEntities() {
      return activePhysicsEntities;
    }

    function syncPrototypePlayer(overrides = {}) {
      prototypePlayerEntity.playerData = getPrototypePlayerPayload(overrides);
      updatePlayerEntityText(prototypePlayerEntity);
      renderPlayerEntityVisual(prototypePlayerEntity);
    }

    function showPrototypePlayer(show) {
      prototypePlayerEntity.element.classList.toggle('hidden', !show);
      prototypePlayerEntity.hiddenFromScene = !show;
      syncActivePhysicsEntities();
    }

    function attachPlayerEntity(entity) {
      if (!playerEntities.includes(entity)) {
        playerEntities.push(entity);
      }
      entity.hiddenFromScene = false;
      entity.element.classList.remove('hidden');
      syncActivePhysicsEntities();
    }

    function syncPlayerEntityToViewport(entity, viewport = getSceneViewport()) {
      const playerSpeedScale = viewport.speedScale * prototypePlayerConfig.speedScaleMultiplier;
      updatePlayerEntityLayout(entity, viewport.playerScale);
      entity.vx = Math.sign(entity.vx || entity.baseVx) * Math.abs(entity.baseVx * playerSpeedScale);
      entity.vy = Math.sign(entity.vy || entity.baseVy) * Math.abs(entity.baseVy * playerSpeedScale);
    }

    function positionEntityInViewport(entity, viewport = getSceneViewport()) {
      const sceneBounds = viewport.bounds;
      const maxX = Math.max(sceneBounds.width - entity.width, 0);
      const maxY = Math.max(sceneBounds.height - entity.height, 0);

      entity.x =
        sceneBounds.left +
        clamp(maxX * spreadSceneRatio(entity.xRatio, viewport.spreadScale), 0, maxX);
      entity.y =
        sceneBounds.top +
        clamp(maxY * spreadSceneRatio(entity.yRatio, viewport.spreadScale), 0, maxY);
      invalidateBlockGeometry(entity);
      bounceOffWalls(entity, sceneBounds);
      renderBlock(entity);
    }

    function detachPlayerEntity(entity) {
      const index = playerEntities.indexOf(entity);
      if (index >= 0) {
        playerEntities.splice(index, 1);
      }
      entity.element.remove();
      syncActivePhysicsEntities();
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
      const viewport = getSceneViewport();
      entity.xRatio = seat.xRatio;
      entity.yRatio = seat.yRatio;
      entity.vx = seat.vx;
      entity.vy = seat.vy;
      entity.baseVx = seat.vx;
      entity.baseVy = seat.vy;
      entity.spin = seat.spin;
      attachPlayerEntity(entity);
      syncPlayerEntityToViewport(entity, viewport);
      positionEntityInViewport(entity, viewport);
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

    function getCornerTriggerSize(viewport = getSceneViewport()) {
      const shortSide = Math.min(viewport.visibleWidth, viewport.visibleHeight);
      const baseSize = Math.round(
        clamp(
          shortSide * cornerTriggerConfig.size.shortSideRatio,
          cornerTriggerConfig.size.minPx,
          cornerTriggerConfig.size.maxPx
        )
      );
      return Math.max(1, Math.round(baseSize * cornerTriggerConfig.size.scale));
    }

    function getCornerTriggerDefinitions(viewport = getSceneViewport()) {
      const triggerSize = getCornerTriggerSize(viewport);

      return {
        'top-left': {
          left: 0,
          top: 0,
          cornerX: 0,
          cornerY: 0,
          size: triggerSize
        },
        'top-right': {
          left: Math.max(viewport.visibleWidth - triggerSize, 0),
          top: 0,
          cornerX: viewport.visibleWidth,
          cornerY: 0,
          size: triggerSize
        },
        'bottom-left': {
          left: 0,
          top: Math.max(viewport.visibleHeight - triggerSize, 0),
          cornerX: 0,
          cornerY: viewport.visibleHeight,
          size: triggerSize
        },
        'bottom-right': {
          left: Math.max(viewport.visibleWidth - triggerSize, 0),
          top: Math.max(viewport.visibleHeight - triggerSize, 0),
          cornerX: viewport.visibleWidth,
          cornerY: viewport.visibleHeight,
          size: triggerSize
        }
      };
    }

    function updateCornerTriggerLayout(viewport = getSceneViewport()) {
      const definitions = getCornerTriggerDefinitions(viewport);

      cornerTriggerBoxes.forEach((triggerBox) => {
        const definition = definitions[triggerBox.id];
        triggerBox.cornerX = definition.cornerX;
        triggerBox.cornerY = definition.cornerY;
        triggerBox.hitbox = createAxisAlignedHitbox(
          definition.left,
          definition.top,
          definition.size,
          definition.size
        );
        triggerBox.element.style.width = `${definition.size}px`;
        triggerBox.element.style.height = `${definition.size}px`;
        triggerBox.element.style.transform = `translate(${definition.left}px, ${definition.top}px)`;
      });
    }

    function getActiveCornerTriggerMask(block) {
      let activeTriggerMask = 0;
      const blockHitbox = getHitbox(block);

      cornerTriggerBoxes.forEach((triggerBox) => {
        if (triggerBox.hitbox && hitboxesOverlap(blockHitbox, triggerBox.hitbox)) {
          activeTriggerMask |= triggerBox.maskBit;
        }
      });

      return activeTriggerMask;
    }

    function syncCornerTriggerOccupancy() {
      blocks.forEach((block) => {
        block.activeCornerTriggerMask = getActiveCornerTriggerMask(block);
      });
    }

    const cornerEffectHandlers = Object.freeze({
      cornerRipple(block, triggerBox) {
        spawnRipple(triggerBox.cornerX, triggerBox.cornerY);
      },
      cornerOverdrive(block, triggerBox) {
        triggerCornerOverdrive(block, triggerBox);
      },
      dvdFanfare(block) {
        triggerCornerFanfare(block);
      }
    });

    function runCornerTriggerEffects(block, triggerBox) {
      cornerTriggerConfig.effects.forEach((effectId) => {
        cornerEffectHandlers[effectId]?.(block, triggerBox);
      });
    }

    function processCornerTriggerEntries() {
      blocks.forEach((block) => {
        const nextActiveTriggerMask = getActiveCornerTriggerMask(block);

        cornerTriggerBoxes.some((triggerBox) => {
          if (
            !(nextActiveTriggerMask & triggerBox.maskBit) ||
            (block.activeCornerTriggerMask & triggerBox.maskBit)
          ) {
            return false;
          }

          runCornerTriggerEffects(block, triggerBox);
          return true;
        });

        block.activeCornerTriggerMask = nextActiveTriggerMask;
      });
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
      syncLogoTargets();
      logoLetters.forEach((letter) => {
        letter.bounds = letter.fillElement.getBoundingClientRect();
        rebuildLogoLetterMask(letter);
      });
    }

    function refreshThemeAndLogoMetrics() {
      syncThemeStyles();
      updateLogoLetterBounds();
    }

    function scheduleRefresh(handleKey, callback, frameCount = 1) {
      if (refreshHandles[handleKey]) {
        cancelAnimationFrame(refreshHandles[handleKey]);
      }

      const refresh = (remainingFrames) => {
        if (remainingFrames > 0) {
          refreshHandles[handleKey] = requestAnimationFrame(() => refresh(remainingFrames - 1));
          return;
        }

        refreshHandles[handleKey] = 0;
        callback();
      };

      refresh(frameCount);
    }

    function scheduleLogoBoundsRefresh(frameCount = 2) {
      scheduleRefresh('logoBounds', updateLogoLetterBounds, frameCount);
    }

    function runLogoRefresh() {
      refreshThemeAndLogoMetrics();
      scheduleLogoBoundsRefresh(1);
    }

    function scheduleLogoRefresh(frameCount = 1) {
      scheduleRefresh('logo', runLogoRefresh, frameCount);
    }

    function runLayoutRefresh() {
      refreshThemeAndLogoMetrics();
      placeBlocks();
      scheduleLogoBoundsRefresh(1);
    }

    function scheduleLayoutRefresh(frameCount = 1) {
      scheduleRefresh('layout', runLayoutRefresh, frameCount);
    }

    function cancelKeyboardViewportRestore() {
      if (keyboardViewportState.settleRaf) {
        cancelAnimationFrame(keyboardViewportState.settleRaf);
        keyboardViewportState.settleRaf = 0;
      }
      keyboardViewportState.settling = false;
    }

    function commitSceneViewportChange(snapshot, frameCount = 1) {
      cancelKeyboardViewportRestore();
      viewportState = null;
      stableViewportSnapshot = snapshot;
      keyboardViewportState.locked = false;
      keyboardViewportState.baselineSnapshot = hasFocusedTextEntry() ? snapshot : null;
      scheduleLayoutRefresh(frameCount);
    }

    function scheduleKeyboardViewportRestore(frameCount = 1) {
      keyboardViewportState.settling = true;
      if (keyboardViewportState.settleRaf) {
        cancelAnimationFrame(keyboardViewportState.settleRaf);
      }

      const settle = (remainingFrames) => {
        if (remainingFrames > 0) {
          keyboardViewportState.settleRaf = requestAnimationFrame(() => settle(remainingFrames - 1));
          return;
        }

        keyboardViewportState.settleRaf = 0;
        const snapshot = getViewportSnapshot();
        if (isSoftKeyboardViewportShift(snapshot)) {
          scheduleKeyboardViewportRestore(frameCount);
          return;
        }

        commitSceneViewportChange(snapshot, frameCount);
      };

      settle(softKeyboardConfig.settleFrames);
    }

    function handleSceneViewportChange(frameCount = 1) {
      const snapshot = getViewportSnapshot();
      if (hasFocusedTextEntry() && !keyboardViewportState.baselineSnapshot) {
        keyboardViewportState.baselineSnapshot = snapshot;
      }

      if (isSoftKeyboardViewportShift(snapshot) && (hasFocusedTextEntry() || keyboardViewportState.locked)) {
        cancelKeyboardViewportRestore();
        keyboardViewportState.locked = true;
        scheduleLogoRefresh(1);
        return;
      }

      if (keyboardViewportState.locked && !hasFocusedTextEntry()) {
        scheduleKeyboardViewportRestore(frameCount);
        return;
      }

      commitSceneViewportChange(snapshot, frameCount);
    }

    function updateLogoPaint(now) {
      if (!logoLetters.length) {
        return;
      }

      while (logoPaintScores.length < logoLetters.length) {
        logoPaintScores.push({ score: 0, color: null });
      }
      for (let index = 0; index < logoLetters.length; index += 1) {
        logoPaintScores[index].score = 0;
        logoPaintScores[index].color = null;
      }

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
          if (score > logoPaintScores[index].score) {
            logoPaintScores[index].score = score;
            logoPaintScores[index].color = block.colorRgb;
          }
        });
      });

      logoLetters.forEach((letter, index) => {
        if (logoPaintScores[index].color) {
          letter.lastPaintColor = logoPaintScores[index].color;
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
      const jiggleConfig = getCollisionJiggleSettings(block);
      const jiggleStrength = Math.min(impact * jiggleConfig.speedToStretch, 1);
      const compressionX = Math.abs(normalX) * jiggleConfig.maxStretch * jiggleStrength;
      const compressionY = Math.abs(normalY) * jiggleConfig.maxStretch * jiggleStrength;

      block.jiggleCompressionX = clamp(
        block.jiggleCompressionX + compressionX,
        0,
        jiggleConfig.maxStretch
      );
      block.jiggleCompressionY = clamp(
        block.jiggleCompressionY + compressionY,
        0,
        jiggleConfig.maxStretch
      );
      block.jiggleTiltAmplitude = clamp(
        block.jiggleTiltAmplitude + (normalX * normalY) * jiggleConfig.maxTilt * jiggleStrength,
        -jiggleConfig.maxTilt,
        jiggleConfig.maxTilt
      );
      block.jiggleTime = 0;
      invalidateBlockVisualGeometry(block);
    }

    function updateResponsiveLayout(viewport = getSceneViewport()) {
      syncThemeStyles();

      blocks.forEach((block) => {
        block.width = Math.round(block.baseWidth * viewport.blockScale);
        block.height = Math.round(block.baseHeight * viewport.blockScale);
        const shortestSide = Math.min(block.width, block.height);
        const scaledRadius = block.baseRadius * viewport.radiusScale;
        block.radius = Math.min(
          scaledRadius,
          Math.max(8, shortestSide * sizeRanges.radiusShortSideClamp)
        );
        block.element.style.width = `${block.width}px`;
        block.element.style.height = `${block.height}px`;
        block.element.style.borderRadius = `${block.radius}px`;
        block.vx = Math.sign(block.vx || block.baseVx) * Math.abs(block.baseVx * viewport.speedScale);
        block.vy = Math.sign(block.vy || block.baseVy) * Math.abs(block.baseVy * viewport.speedScale);
        invalidateBlockGeometry(block);
      });

      playerEntities.forEach((entity) => {
        syncPlayerEntityToViewport(entity, viewport);
      });
    }

    function placeBlocks(viewport = getSceneViewport()) {
      updateResponsiveLayout(viewport);
      updateCornerTriggerLayout(viewport);

      getPhysicsEntities().forEach((entity) => {
        positionEntityInViewport(entity, viewport);
      });
      syncCornerTriggerOccupancy();
    }

    function spawnRipple(x, y) {
      const element = acquireRippleElement();
      const color = paletteColors[rippleIndex % paletteColors.length];
      const endRadius = getSceneViewport().rippleEndRadius;
      const diameter = endRadius * 2;
      rippleIndex += 1;

      element.className = 'background-ripple';
      element.style.border = `2px solid ${rgbaString(color, 0.88)}`;
      element.style.boxShadow = `0 0 14px ${rgbaString(color, 0.3)}`;
      element.style.width = `${diameter}px`;
      element.style.height = `${diameter}px`;
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.transform = `translate(-50%, -50%) scale(${interactionConfig.rippleStartRadius / endRadius})`;
      element.style.opacity = '1';

      rippleLayer.appendChild(element);
      ripples.push({
        element,
        bornAt: performance.now(),
        startRadius: interactionConfig.rippleStartRadius,
        endRadius
      });
      perfStats.rippleSpawns += 1;
    }

    function updateRipples(now) {
      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index];
        const progress = clamp((now - ripple.bornAt) / interactionConfig.rippleLifetime, 0, 1);
        const easedProgress = easeOutCubic(progress);
        const radius = lerp(ripple.startRadius, ripple.endRadius, easedProgress);
        const opacity = (1 - progress) ** 1.8;
        const scale = radius / ripple.endRadius;

        ripple.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
        ripple.element.style.opacity = opacity.toFixed(3);

        if (progress >= 1) {
          releaseRippleElement(ripple.element);
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
          invalidateBlockVisualGeometry(block);
          return;
        }

        const progress = block.jiggleTime / collisionJiggleConfig.settleDuration;
        const amount = Math.sin(progress * Math.PI);

        block.jiggleScaleX = 1 - block.jiggleCompressionX * amount + block.jiggleCompressionY * amount;
        block.jiggleScaleY = 1 - block.jiggleCompressionY * amount + block.jiggleCompressionX * amount;
        block.jiggleAngle = block.jiggleTiltAmplitude * Math.sin(progress * Math.PI * 2);
        invalidateBlockVisualGeometry(block);
      });
    }

    function applyImpulse(x, y) {
      const viewport = getSceneViewport();
      const responsiveRadius = viewport.impulseRadius;
      const responsiveStrength = viewport.impulseStrength;

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

    // Perf sampling is kept alongside the frame phases so the hot loop stays
    // easy to profile without scattering timers throughout the file.
    function recordFrameSection(sectionName, sectionStart) {
      const sectionEnd = performance.now();
      perfStats.sections[sectionName] += sectionEnd - sectionStart;
      return sectionEnd;
    }

    function integratePhysicsEntities(physicsEntities, delta) {
      physicsEntities.forEach((block) => {
        block.x += block.vx * delta;
        block.y += block.vy * delta;
        block.angle += block.spin * delta;
        block.spin *= spinConfig.decayPerSecond ** delta;
        invalidateBlockGeometry(block);
      });
    }

    function resolvePhysicsEntityCollisions(physicsEntities) {
      for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < physicsEntities.length; i += 1) {
          for (let j = i + 1; j < physicsEntities.length; j += 1) {
            const entityA = physicsEntities[i];
            const entityB = physicsEntities[j];
            const hitboxA = getHitbox(entityA);
            const hitboxB = getHitbox(entityB);

            perfStats.collisionPairs += 1;
            if (!axisAlignedHitboxesOverlap(hitboxA, hitboxB)) {
              perfStats.broadPhaseRejected += 1;
              continue;
            }

            perfStats.narrowPhaseTests += 1;
            const hit = resolveCollision(entityA, entityB, hitboxA, hitboxB);
            if (!hit || pass !== 0) {
              continue;
            }

            perfStats.collisionHits += 1;
            if (hit.impulse > 0.5) {
              applyCollisionJiggle(entityA, -hit.normalX, -hit.normalY, hit.impulse);
              applyCollisionJiggle(entityB, hit.normalX, hit.normalY, hit.impulse);
            }
          }
        }
      }
    }

    function handlePhysicsEntityWallBounces(physicsEntities, sceneBounds) {
      physicsEntities.forEach((block) => {
        const wallHit = bounceOffWalls(block, sceneBounds);
        if (!wallHit) {
          return;
        }

        const speed = Math.hypot(block.vx, block.vy);
        applyCollisionJiggle(block, wallHit.normalX, wallHit.normalY, speed * 0.4);
      });
      processCornerTriggerEntries();
    }

    function updateAndRenderPhysicsEntities(physicsEntities, delta, now) {
      updateCollisionJiggle(delta);
      updateCornerOverdriveEffects(now);
      physicsEntities.forEach((block) => {
        keepMomentum(block);
        renderBlock(block);
      });
    }

    function recordCompletedFrame(frameStart, physicsEntityCount) {
      perfStats.frames += 1;
      perfStats.lastEntityCount = physicsEntityCount;
      perfStats.lastFrameMs = performance.now() - frameStart;
      perfStats.frameTimeTotal += perfStats.lastFrameMs;
      perfStats.maxFrameMs = Math.max(perfStats.maxFrameMs, perfStats.lastFrameMs);
      animationDebug.frames += 1;
    }

    let lastTime = performance.now();
    let animationFrameId = 0;
    let animationActive = false;
    const animationDebug = {
      starts: 0,
      stops: 0,
      frames: 0,
      lastError: null
    };
    window.backgroundBlocksDebug = animationDebug;

    // Animation startup stays explicit so initial motion is reliable and any
    // runtime failure can stop the loop cleanly.
    function requestNextAnimationFrame() {
      if (!animationActive) {
        return;
      }
      animationFrameId = requestAnimationFrame(animate);
    }

    function stopAnimationLoop() {
      animationActive = false;
      animationDebug.stops += 1;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    }

    function startAnimationLoop() {
      if (animationActive) {
        return;
      }

      animationDebug.starts += 1;
      animationActive = true;
      animationFrameId = requestAnimationFrame((now) => {
        lastTime = now;
        animate(now);
      });
    }

    function animate(now) {
      if (!animationActive) {
        return;
      }

      try {
        const frameStart = performance.now();
        const delta = Math.min((now - lastTime) / 1000, 0.033);
        lastTime = now;

        const viewport = getSceneViewport();
        const sceneBounds = viewport.bounds;
        const physicsEntities = getPhysicsEntities();
        let sectionStart = performance.now();

        integratePhysicsEntities(physicsEntities, delta);
        sectionStart = recordFrameSection('integrate', sectionStart);

        resolvePhysicsEntityCollisions(physicsEntities);
        sectionStart = recordFrameSection('collisions', sectionStart);

        handlePhysicsEntityWallBounces(physicsEntities, sceneBounds);
        sectionStart = recordFrameSection('walls', sectionStart);

        updateAndRenderPhysicsEntities(physicsEntities, delta, now);
        sectionStart = recordFrameSection('jiggleAndRender', sectionStart);

        updateLogoPaint(now);
        sectionStart = recordFrameSection('logo', sectionStart);

        updateRipples(now);
        recordFrameSection('ripples', sectionStart);

        recordCompletedFrame(frameStart, physicsEntities.length);

        requestNextAnimationFrame();
      } catch (error) {
        animationDebug.lastError = error?.stack || error?.message || String(error);
        console.error('[background-blocks] animate failed', error);
        stopAnimationLoop();
        throw error;
      }
    }

    document.addEventListener('focusin', (event) => {
      if (!isTextEntryElement(event.target)) {
        return;
      }

      keyboardViewportState.focusedElement = event.target;
      keyboardViewportState.baselineSnapshot = getViewportSnapshot();
      cancelKeyboardViewportRestore();
    });
    document.addEventListener('focusout', (event) => {
      if (event.target === keyboardViewportState.focusedElement) {
        keyboardViewportState.focusedElement = null;
        if (keyboardViewportState.locked) {
          handleSceneViewportChange(2);
        } else {
          keyboardViewportState.baselineSnapshot = null;
        }
      }
    });

    window.addEventListener('resize', () => {
      handleSceneViewportChange(1);
    });
    window.addEventListener('load', () => {
      handleSceneViewportChange(2);
    }, { once: true });
    window.addEventListener('pageshow', () => {
      handleSceneViewportChange(1);
    });
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        handleSceneViewportChange(1);
      };
      window.visualViewport.addEventListener('resize', handleVisualViewportChange, { passive: true });
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange, { passive: true });
    }
    interactionLayer.addEventListener('pointerdown', handlePointerDown, { passive: true });

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        commitSceneViewportChange(getViewportSnapshot(), 2);
      });
    }

    syncLogoTargets();

    if (typeof ResizeObserver !== 'undefined' && logoTextElements.length) {
      const logoObserver = new ResizeObserver(() => {
        scheduleLogoRefresh(1);
      });
      logoTextElements.forEach((logoTextElement) => {
        logoObserver.observe(logoTextElement);
      });
    }

    stableViewportSnapshot = getViewportSnapshot();
    viewportState = measureSceneViewport(stableViewportSnapshot);
    runLayoutRefresh();
    startAnimationLoop();

    window.addEventListener('background-prototype-player-change', (event) => {
      syncPrototypePlayer(event.detail || {});
    });
    window.setBackgroundMoopMode = setBackgroundMoopMode;
    window.syncPregameLobbyMoops = syncPregameLobbyMoops;
    window.syncBackgroundPlayers = syncBackgroundPlayers;
    window.setBackgroundPrototypePlayer = syncPrototypePlayer;
    window.refreshBackgroundLogoPaint = () => {
      scheduleLogoRefresh(1);
    };
    syncPrototypePlayer(window.backgroundPrototypePlayerData || {});
    container.dataset.initialized = 'true';
  }

  window.initBackgroundBlocks = initBackgroundBlocks;

  function waitForDomReady() {
    if (document.readyState === 'loading') {
      return new Promise((resolve) => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    return Promise.resolve();
  }

  function waitForAppShellReady() {
    if (document.body?.dataset.appShellReady === 'true' || document.readyState === 'complete') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const finish = () => resolve();
      window.addEventListener('morp:app-shell-ready', finish, { once: true });
      window.addEventListener('load', finish, { once: true });
    });
  }

  async function bootstrapBackgroundBlocks() {
    await waitForDomReady();
    await waitForAppShellReady();
    initBackgroundBlocks();
  }

  bootstrapBackgroundBlocks();
})();
