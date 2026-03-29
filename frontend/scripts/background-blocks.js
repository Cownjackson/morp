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
    // speedLines: Object.freeze({
    //   spawnIntervalMs: 54,
    //   lifetimeMs: 520,
    //   lineCount: 3,
    //   thickness: Object.freeze({
    //     minPx: 4,
    //     maxPx: 18,
    //     blockRatio: 0.085
    //   }),
    //   length: Object.freeze({
    //     minPx: 32,
    //     maxPx: 350,
    //     blockRatio: 0.62,
    //     speedFactor: 0.04,
    //     multiplier: 1.56
    //   }),
    //   spread: Object.freeze({
    //     minPx: 12,
    //     maxPx: 44,
    //     blockRatio: 0.16
    //   }),
    //   stagger: Object.freeze({
    //     minPx: 8,
    //     maxPx: 30,
    //     blockRatio: 0.09
    //   }),
    //   sourceInset: Object.freeze({
    //     minPx: 12,
    //     blockRatio: 0.18
    //   }),
    //   segments: Object.freeze({
    //     densityMultiplier: 1.3,
    //     diameterRatio: 1.08,
    //     tailFadeStrength: 0.72
    //   }),
    //   color: Object.freeze({
    //     coreOpacity: 0.82,
    //     glowOpacity: 0.4
    //   })
    // })
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
        blockScaleMultiplier: 1.0,
        playerScaleMultiplier: 1.02,
        speedScaleMultiplier: 1.02,
        radiusScaleMultiplier: 1.03,
        spreadScale: 1.08,
        impulseRadiusMultiplier: 1.08,
        impulseStrengthMultiplier: 1.04,
        rippleRadiusMultiplier: 1.05
      },
      {
        classMetric: 2800,
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
    detectionInsetRatio: 0.215,
    alphaThreshold: 108,
    maskSampleDivisions: 8
  };
  const blockFaceShadowConfig = {
    opacity: 0.9,
    offsetPx: 2.6,
    colorLiftRatio: 0.2,
    outlineRatio: 0.005,
    minOutlinePx: 1,
    maxOutlinePx: 3
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

  // function scaleCornerSpeedLineDimension(blockSize, dimensionConfig) {
  //   return clamp(
  //     blockSize * dimensionConfig.blockRatio,
  //     dimensionConfig.minPx,
  //     dimensionConfig.maxPx
  //   );
  // }

  // function getCornerSpeedLineMetrics(block) {
  //   const speedLineConfig = cornerOverdriveConfig.speedLines;
  //   const lengthConfig = speedLineConfig.length;
  //   const blockSize = Math.min(block.width, block.height);
  //   const speed = Math.hypot(block.vx, block.vy);
  //   const lineThickness = scaleCornerSpeedLineDimension(blockSize, speedLineConfig.thickness);
  //   const lineLength = clamp(
  //     (
  //       blockSize * lengthConfig.blockRatio
  //       + speed * lengthConfig.speedFactor
  //     ) * lengthConfig.multiplier,
  //     lengthConfig.minPx,
  //     lengthConfig.maxPx
  //   );

  //   return {
  //     speed,
  //     lineThickness,
  //     lineLength,
  //     lineSpread: scaleCornerSpeedLineDimension(blockSize, speedLineConfig.spread),
  //     lineStagger: scaleCornerSpeedLineDimension(blockSize, speedLineConfig.stagger),
  //     sourceInset: Math.max(
  //       blockSize * speedLineConfig.sourceInset.blockRatio,
  //       speedLineConfig.sourceInset.minPx
  //     )
  //   };
  // }

  // function getCornerSpeedLineSegmentCount(lineLength, lineThickness) {
  //   const segmentConfig = cornerOverdriveConfig.speedLines.segments;
  //   const segmentDiameter = lineThickness * segmentConfig.diameterRatio;

  //   return {
  //     segmentDiameter,
  //     segmentCount: Math.max(
  //       4,
  //       Math.round(
  //         (lineLength / Math.max(segmentDiameter, 1)) * segmentConfig.densityMultiplier
  //       )
  //     )
  //   };
  // }

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

    return {
      centerX: block.x + block.width / 2 + (offsetX * cos) - (offsetY * sin),
      centerY: block.y + block.height / 2 + (offsetX * sin) + (offsetY * cos),
      halfWidth: (block.width * scaleX * collisionBounds.width * collisionBounds.scale) / 2,
      halfHeight: (block.height * scaleY * collisionBounds.height * collisionBounds.scale) / 2,
      angle: angleRadians
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

  function createAxisAlignedHitbox(left, top, width, height) {
    return {
      centerX: left + width / 2,
      centerY: top + height / 2,
      halfWidth: width / 2,
      halfHeight: height / 2,
      angle: 0
    };
  }

  function hitboxesOverlap(hitboxA, hitboxB) {
    const axes = [...getAxes(hitboxA), ...getAxes(hitboxB)];

    for (const axis of axes) {
      const projectionA = projectHitbox(hitboxA, axis);
      const projectionB = projectHitbox(hitboxB, axis);
      const overlap = Math.min(projectionA.max, projectionB.max) - Math.max(projectionA.min, projectionB.min);

      if (overlap <= 0) {
        return false;
      }
    }

    return true;
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

    return { normalX, normalY, impulse };
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
      yRatio: prototypePlayerConfig.yRatio
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

  function getBlockShadowColor(color) {
    return mixColor(
      darkenColor(color, logoPaintConfig.shadowDarkness),
      color,
      blockFaceShadowConfig.colorLiftRatio
    );
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

    // let speedLineLayer = container.querySelector('.background-speed-line-layer');
    // if (!speedLineLayer) {
    //   speedLineLayer = document.createElement('div');
    //   speedLineLayer.className = 'background-speed-line-layer';
    //   container.insertBefore(speedLineLayer, container.firstChild);
    // }

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
    let rippleIndex = 0;
    const logoTargetIds = ['landing-logo-text', 'pregame-logo-text'];
    let logoTextElements = [];
    let logoLetters = [];
    let defaultLogoFill = getThemeColorRgb('--punch');
    const refreshHandles = {
      logoBounds: 0,
      layout: 0,
      logo: 0
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

      blocks.forEach((block) => {
        applyBlockThemeStyles(block);
      });
    }

    function applyBlockThemeStyles(block) {
      block.colorRgb = getThemeColorRgb(block.colorVariable);
      block.element.style.setProperty(
        '--swatch-fill',
        rgbaString(block.colorRgb, 1)
      );
      block.element.style.setProperty(
        '--swatch-shadow-fill',
        rgbaString(getBlockShadowColor(block.colorRgb), blockFaceShadowConfig.opacity)
      );
    }

    // Logo paint flow:
    // 1. Build one set of block hit candidates for this animation frame.
    // 2. Resolve the strongest overlap per letter.
    // 3. Persist that color on the letter until a later block replaces it.
    function createNoLogoPaintHit() {
      return { score: 0, color: null };
    }

    function getBlockBounds(hitbox) {
      const extents = getRotatedExtents(hitbox);
      return {
        left: hitbox.centerX - extents.x,
        right: hitbox.centerX + extents.x,
        top: hitbox.centerY - extents.y,
        bottom: hitbox.centerY + extents.y
      };
    }

    function getLetterDetectionBounds(letter) {
      const bounds = letter.bounds;
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        return null;
      }

      const insetX = bounds.width * logoPaintConfig.detectionInsetRatio;
      const insetY = bounds.height * logoPaintConfig.detectionInsetRatio;
      return {
        left: bounds.left + insetX,
        right: bounds.right - insetX,
        top: bounds.top + insetY,
        bottom: bounds.bottom - insetY
      };
    }

    function getBoundsOverlap(boundsA, boundsB) {
      const left = Math.max(boundsA.left, boundsB.left);
      const right = Math.min(boundsA.right, boundsB.right);
      const top = Math.max(boundsA.top, boundsB.top);
      const bottom = Math.min(boundsA.bottom, boundsB.bottom);
      const width = right - left;
      const height = bottom - top;

      if (width <= 0 || height <= 0) {
        return null;
      }

      return { left, right, top, bottom, width, height };
    }

    function getLogoPaintCandidates() {
      return blocks.map((block) => {
        const hitbox = getHitbox(block, true);
        return {
          color: block.colorRgb,
          hitbox,
          bounds: getBlockBounds(hitbox)
        };
      });
    }

    function getBestPaintMatchForLetter(letter, paintCandidates) {
      const detectionBounds = getLetterDetectionBounds(letter);
      if (!detectionBounds) {
        return createNoLogoPaintHit();
      }

      return paintCandidates.reduce((bestMatch, candidate) => {
        const overlap = getBoundsOverlap(candidate.bounds, detectionBounds);
        if (!overlap) {
          return bestMatch;
        }

        if (!letterHasShapeOverlap(
          letter,
          candidate.hitbox,
          overlap.left,
          overlap.top,
          overlap.right,
          overlap.bottom
        )) {
          return bestMatch;
        }

        const score = overlap.width * overlap.height;
        if (score <= bestMatch.score) {
          return bestMatch;
        }

        return { score, color: candidate.color };
      }, createNoLogoPaintHit());
    }

    function updateStoredLogoLetterPaint(letter, paintMatch) {
      if (paintMatch.color) {
        letter.lastPaintColor = paintMatch.color;
      }
    }

    function applyLogoLetterPaint(letter, color) {
      const activeColor = color ?? defaultLogoFill;
      const shadowColor = darkenColor(activeColor, logoPaintConfig.shadowDarkness);

      letter.element.style.setProperty('--logo-fill', rgbaString(activeColor, 1));
      letter.element.style.setProperty(
        '--logo-shadow',
        rgbaString(shadowColor, logoPaintConfig.shadowOpacity)
      );
    }

    const shapeModes = shuffle([
      'square', 'square', 'square', 'square',
      'rectangle', 'rectangle', 'rectangle', 'rectangle'
    ]);

    const blocks = swatchConfigs.map((config) => {
      const element = container.querySelector(config.selector);
      const { width, height } = generateBlockSize(shapeModes.pop());
      const baseRadius = config.baseRadius;

      element.innerHTML = '';
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;

      const shadowFace = document.createElement('div');
      shadowFace.className = 'swatch-shadow-face';

      const face = document.createElement('div');
      face.className = 'swatch-face';

      const dvdImg = document.createElement('img');
      dvdImg.src = 'assets/dvd_logo.png';
      dvdImg.className = 'swatch-dvd-logo';
      dvdImg.setAttribute('aria-hidden', 'true');
      dvdImg.setAttribute('draggable', 'false');
      dvdImg.style.opacity = '0';
      face.appendChild(dvdImg);
      element.append(shadowFace, face);

      return {
        element,
        width,
        height,
        baseWidth: width,
        baseHeight: height,
        colorVariable: config.colorVariable,
        colorRgb: getThemeColorRgb(config.colorVariable),
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
        activeCornerTriggerIds: new Set(),
        cornerOverdriveUntil: 0,
        cornerOverdriveTargetSpeed: 0,
        // cornerSpeedLinesLastAt: 0,
        dvdImg,
        dvdTimeout: null
      };
    });

    function applyBlockVisualLayout(block, shortestSide) {
      block.element.style.width = `${block.width}px`;
      block.element.style.height = `${block.height}px`;
      block.element.style.borderRadius = `${block.radius}px`;
      block.element.style.setProperty('--swatch-shadow-offset', `${blockFaceShadowConfig.offsetPx}px`);
      block.element.style.setProperty(
        '--swatch-outline-width',
        `${clamp(
          Math.round(shortestSide * blockFaceShadowConfig.outlineRatio),
          blockFaceShadowConfig.minOutlinePx,
          blockFaceShadowConfig.maxOutlinePx
        )}px`
      );
    }

    const cornerTriggerBoxes = [
      { id: 'top-left' },
      { id: 'top-right' },
      { id: 'bottom-left' },
      { id: 'bottom-right' }
    ].map((triggerBox) => {
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
        element,
        hitbox: null,
        cornerX: 0,
        cornerY: 0
      };
    });
    const playerEntities = [];
    const playerEntitiesById = new Map();

    // function spawnCornerSpeedLines(block, now = performance.now()) {
    //   if (!isCornerOverdriveActive(block, now)) {
    //     return;
    //   }

    //   const speedLineConfig = cornerOverdriveConfig.speedLines;
    //   const lifetime = Math.min(
    //     speedLineConfig.lifetimeMs,
    //     block.cornerOverdriveUntil - now
    //   );
    //   if (lifetime < 110) {
    //     return;
    //   }

    //   const {
    //     speed,
    //     lineThickness,
    //     lineLength,
    //     lineSpread,
    //     lineStagger,
    //     sourceInset
    //   } = getCornerSpeedLineMetrics(block);
    //   const dirX = speed > 0 ? block.vx / speed : 0;
    //   const dirY = speed > 0 ? block.vy / speed : 0;
    //   const centerX = block.x + block.width / 2;
    //   const centerY = block.y + block.height / 2;
    //   const anchorX = centerX - dirX * sourceInset;
    //   const anchorY = centerY - dirY * sourceInset;
    //   const group = document.createElement('div');
    //   const angle = Math.atan2(dirY, dirX) * (180 / Math.PI);

    //   group.className = 'background-speed-line-group';
    //   group.style.setProperty(
    //     '--background-speed-line-transform',
    //     `translate(${anchorX}px, ${anchorY}px) rotate(${angle}deg)`
    //   );
    //   group.style.setProperty('--background-speed-line-lifetime', `${lifetime}ms`);
    //   group.style.setProperty(
    //     '--background-speed-line-core',
    //     rgbaString(block.colorRgb, speedLineConfig.color.coreOpacity)
    //   );
    //   group.style.setProperty(
    //     '--background-speed-line-glow',
    //     rgbaString(block.colorRgb, speedLineConfig.color.glowOpacity)
    //   );

    //   for (let index = 0; index < speedLineConfig.lineCount; index += 1) {
    //     const line = document.createElement('div');
    //     const yOffset =
    //       (index - ((speedLineConfig.lineCount - 1) / 2)) * lineSpread;
    //     const xOffset = -index * lineStagger;
    //     const individualLength = Math.max(
    //       speedLineConfig.length.minPx * 0.72,
    //       lineLength - index * lineStagger
    //     );

    //     line.className = 'background-speed-line';
    //     line.style.width = `${individualLength}px`;
    //     line.style.height = `${lineThickness}px`;
    //     line.style.left = `${xOffset - individualLength}px`;
    //     line.style.top = `${yOffset - (lineThickness * 0.5)}px`;

    //     const { segmentDiameter, segmentCount } = getCornerSpeedLineSegmentCount(
    //       individualLength,
    //       lineThickness
    //     );
    //     const segmentTravel = Math.max(individualLength - segmentDiameter, 0);

    //     for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    //       const segment = document.createElement('div');
    //       const progress = segmentCount === 1 ? 0 : segmentIndex / (segmentCount - 1);
    //       const fadeAmount = 1 - progress * speedLineConfig.segments.tailFadeStrength;

    //       segment.className = 'background-speed-line-segment';
    //       segment.style.width = `${segmentDiameter}px`;
    //       segment.style.height = `${segmentDiameter}px`;
    //       segment.style.left = `${progress * segmentTravel}px`;
    //       segment.style.top = `${(lineThickness - segmentDiameter) * 0.5}px`;
    //       segment.style.opacity = fadeAmount.toFixed(3);
    //       line.appendChild(segment);
    //     }

    //     group.appendChild(line);
    //   }

    //   speedLineLayer.appendChild(group);
    //   group.addEventListener('animationend', () => group.remove(), { once: true });
    // }

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
      // const speedLineConfig = cornerOverdriveConfig.speedLines;
      blocks.forEach((block) => {
        if (!isCornerOverdriveActive(block, now)) {
          block.cornerOverdriveTargetSpeed = 0;
          return;
        }

        applyCornerOverdriveVelocity(block, now);

        // if (now - block.cornerSpeedLinesLastAt >= speedLineConfig.spawnIntervalMs) {
        //   spawnCornerSpeedLines(block, now);
        //   block.cornerSpeedLinesLastAt = now;
        // }
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
      // block.cornerSpeedLinesLastAt = now - cornerOverdriveConfig.speedLines.spawnIntervalMs;
      block.vx = (direction.x / directionLength) * targetSpeed;
      block.vy = (direction.y / directionLength) * targetSpeed;

      const { normalX, normalY } = getCornerTriggerNormal(triggerBox.id);
      applyCollisionJiggle(
        block,
        normalX,
        normalY,
        targetSpeed * cornerOverdriveConfig.bounce.activationJiggleImpactMultiplier
      );
      // spawnCornerSpeedLines(block, now);
    }

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
      bounceOffWalls(entity, sceneBounds);
      renderBlock(entity);
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

    function getActiveCornerTriggerIds(block) {
      const activeTriggerIds = new Set();
      const blockHitbox = getHitbox(block);

      cornerTriggerBoxes.forEach((triggerBox) => {
        if (triggerBox.hitbox && hitboxesOverlap(blockHitbox, triggerBox.hitbox)) {
          activeTriggerIds.add(triggerBox.id);
        }
      });

      return activeTriggerIds;
    }

    function syncCornerTriggerOccupancy() {
      blocks.forEach((block) => {
        block.activeCornerTriggerIds = getActiveCornerTriggerIds(block);
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
        const nextActiveTriggerIds = getActiveCornerTriggerIds(block);

        cornerTriggerBoxes.some((triggerBox) => {
          if (
            !nextActiveTriggerIds.has(triggerBox.id) ||
            block.activeCornerTriggerIds.has(triggerBox.id)
          ) {
            return false;
          }

          runCornerTriggerEffects(block, triggerBox);
          return true;
        });

        block.activeCornerTriggerIds = nextActiveTriggerIds;
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

    function updateLogoPaint() {
      if (!logoLetters.length) {
        return;
      }

      const paintCandidates = getLogoPaintCandidates();
      logoLetters.forEach((letter) => {
        const paintMatch = getBestPaintMatchForLetter(letter, paintCandidates);
        updateStoredLogoLetterPaint(letter, paintMatch);
        applyLogoLetterPaint(letter, letter.lastPaintColor);
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
        applyBlockVisualLayout(block, shortestSide);
        block.vx = Math.sign(block.vx || block.baseVx) * Math.abs(block.baseVx * viewport.speedScale);
        block.vy = Math.sign(block.vy || block.baseVy) * Math.abs(block.baseVy * viewport.speedScale);
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
        endRadius: getSceneViewport().rippleEndRadius
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

    let lastTime = performance.now();

    function animate(now) {
      const delta = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      const viewport = getSceneViewport();
      const sceneBounds = viewport.bounds;
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
        const wallHit = bounceOffWalls(block, sceneBounds);
        if (wallHit) {
          const speed = Math.hypot(block.vx, block.vy);
          applyCollisionJiggle(block, wallHit.normalX, wallHit.normalY, speed * 0.4);
        }
      });
      processCornerTriggerEntries();

      // Update jiggle animation, clamp speeds, render
      updateCollisionJiggle(delta);
      updateCornerOverdriveEffects(now);
      physicsEntities.forEach((block) => {
        keepMomentum(block);
        renderBlock(block);
      });

      updateLogoPaint(now);
      updateRipples(now);

      requestAnimationFrame(animate);
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
