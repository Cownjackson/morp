import { COSMETICS } from './constants.js';

const DEFAULT_CANVAS_SIZE = 256;
const imageCache = new Map();
const spriteCache = new Map();

function normalizeCosmetics(cosmeticsObj = {}) {
  return {
    color: cosmeticsObj.color || cosmeticsObj.colors || 'trumskin',
    hat: cosmeticsObj.hat || cosmeticsObj.hats || 'none',
    eyes: cosmeticsObj.eyes || 'eyes',
    face: cosmeticsObj.face || 'none',
    accessory: cosmeticsObj.accessory || cosmeticsObj.accessories || 'none'
  };
}

function getCosmeticFile(category, id) {
  const item = COSMETICS[category]?.find((entry) => entry.id === id);
  return item?.file || null;
}

export function getMoopLayerFiles(cosmeticsObj = {}) {
  const cosmetics = normalizeCosmetics(cosmeticsObj);
  return [
    { cls: 'layer-color', file: getCosmeticFile('colors', cosmetics.color) },
    { cls: 'layer-base', file: 'cosmetics/moop.png' },
    { cls: 'layer-eyes', file: getCosmeticFile('eyes', cosmetics.eyes) },
    { cls: 'layer-face', file: getCosmeticFile('face', cosmetics.face) },
    { cls: 'layer-acc', file: getCosmeticFile('accessories', cosmetics.accessory) },
    { cls: 'layer-hat', file: getCosmeticFile('hats', cosmetics.hat) }
  ].filter((layer) => !!layer.file);
}

function getSpriteCacheKey(cosmeticsObj = {}) {
  const cosmetics = normalizeCosmetics(cosmeticsObj);
  return JSON.stringify(cosmetics);
}

function loadImage(src) {
  if (imageCache.has(src)) {
    return imageCache.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

function getOpaqueBounds(context, width, height) {
  const { data } = context.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      left: 0,
      top: 0,
      width: 1,
      height: 1
    };
  }

  return {
    left: minX / width,
    top: minY / height,
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height
  };
}

export async function buildMoopSprite(cosmeticsObj = {}) {
  const cacheKey = getSpriteCacheKey(cosmeticsObj);
  if (spriteCache.has(cacheKey)) {
    return spriteCache.get(cacheKey);
  }

  const spritePromise = (async () => {
    const layers = getMoopLayerFiles(cosmeticsObj);
    const images = await Promise.all(layers.map((layer) => loadImage(layer.file)));
    const reference = images[0];
    const width = reference?.naturalWidth || DEFAULT_CANVAS_SIZE;
    const height = reference?.naturalHeight || DEFAULT_CANVAS_SIZE;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to create moop sprite canvas context.');
    }

    images.forEach((image) => {
      context.drawImage(image, 0, 0, width, height);
    });

    return {
      src: canvas.toDataURL('image/png'),
      width,
      height,
      bounds: getOpaqueBounds(context, width, height),
      cosmetics: normalizeCosmetics(cosmeticsObj)
    };
  })();

  spriteCache.set(cacheKey, spritePromise);
  return spritePromise;
}
