// ─── Constants ────────────────────────────────────────────────────────────────
export const AVATAR_COLORS = [
  '#c0392b','#2980b9','#27ae60','#d4ac0d',
  '#8e44ad','#16a085','#ca6f1e','#b03a7a',
  '#17a589','#5d6d7e',
];

export const ACTIONS = [
  'hint','vote','morp-guess',
  'damage','endgame','round-end','game-over',
];

// ─── Cosmetics ─────────────────────────────────────────────────────────────────
export const COSMETIC_STORAGE_KEY = 'moop_cosmetics';

// Add or reorder customizer categories and items here. The modal UI and saved payload
// are generated from this config.
export const COSMETIC_CATEGORIES = [
  {
    id: 'colors',
    label: 'colors',
    outputKey: 'color',
    spriteLayerClass: 'layer-color',
    renderBeforeBase: true,
    items: [
      { id: 'trumskin', name: 'Trumskin', file: 'cosmetics/colors/trumskin.png', default: true },
      { id: 'punch', name: 'Punch', file: 'cosmetics/colors/punch.png' },
      { id: 'eggplant', name: 'Eggplant', file: 'cosmetics/colors/eggplant.png' },
      { id: 'grape', name: 'Grape', file: 'cosmetics/colors/grape.png' },
      { id: 'mint', name: 'Mint', file: 'cosmetics/colors/mint.png' },
      { id: 'mustard', name: 'Mustard', file: 'cosmetics/colors/mustard.png' },
      { id: 'pinky', name: 'Pinky', file: 'cosmetics/colors/pinky.png' },
      { id: 'raspberry_wine', name: 'Raspberry Wine', file: 'cosmetics/colors/raspberry_wine.png' },
      { id: 'shreks_toe', name: "Shrek's Toe", file: 'cosmetics/colors/shreks_toe.png' },
    ]
  },
  {
    id: 'hats',
    label: 'hats',
    outputKey: 'hat',
    spriteLayerClass: 'layer-hat',
    items: [
      { id: 'none', name: 'None', type: 'none' },
      { id: 'babushka', name: 'Babushka', file: 'cosmetics/hats/babushka.png' },
      { id: 'baby_bottle_beanie', name: 'Baby Bottle Beanie', file: 'cosmetics/hats/baby_bottle_beanie.png' },
      { id: 'beanie', name: 'Beanie', file: 'cosmetics/hats/beanie.png' },
      { id: 'bow', name: 'Bow', file: 'cosmetics/hats/bow.png' },
      { id: 'cap', name: 'Cap', file: 'cosmetics/hats/cap.png' },
      { id: 'clover', name: 'Clover', file: 'cosmetics/hats/clover.png' },
      { id: 'cowgirl', name: 'Cowgirl', file: 'cosmetics/hats/cowgirl.png' },
      { id: 'crooner', name: 'Crooner', file: 'cosmetics/hats/crooner.png' },
      { id: 'dunce', name: 'Dunce', file: 'cosmetics/hats/dunce.png' },
      { id: 'flower', name: 'Flower', file: 'cosmetics/hats/flower.png' },
      { id: 'halo', name: 'Halo', file: 'cosmetics/hats/halo.png' },
      { id: 'hat_flaps', name: 'Hat Flaps', file: 'cosmetics/hats/hat_flaps.png' },
      { id: 'princess', name: 'Princess', file: 'cosmetics/hats/princess.png' },
      { id: 'propeller', name: 'Propeller', file: 'cosmetics/hats/propeller.png' },
      { id: 'sprout', name: 'Sprout', file: 'cosmetics/hats/sprout.png' },
      { id: 'trucker', name: 'Trucker', file: 'cosmetics/hats/trucker.png' },
      { id: 'crown2', name: 'Crown2', file: 'cosmetics/hats/crown2.png' },
      { id: 'notawig', name: 'Not a Wig', file: 'cosmetics/hats/notawig.png' },
    ]
  },
  {
    id: 'eyes',
    label: 'eyes',
    outputKey: 'eyes',
    spriteLayerClass: 'layer-eyes',
    items: [
      { id: 'eyes', name: 'Default', file: 'cosmetics/eyes/eyes.png', default: true },
      { id: 'drama', name: 'Drama', file: 'cosmetics/eyes/drama.png' },
      { id: 'drama2', name: 'Drama 2', file: 'cosmetics/eyes/drama2.png' },
      { id: 'gleam', name: 'Gleam', file: 'cosmetics/eyes/gleam.png' },
      { id: 'lashes', name: 'Lashes', file: 'cosmetics/eyes/lashes.png' },
      { id: 'sparkle', name: 'Sparkle', file: 'cosmetics/eyes/sparkle.png' },
      { id: 'tear', name: 'Tear', file: 'cosmetics/eyes/tear.png' },
      { id: 'winged', name: 'Winged', file: 'cosmetics/eyes/winged.png' },
      { id: 'kitty', name: 'Kitty', file: 'cosmetics/eyes/kitty.png' },
      { id: 'slayclops', name: 'Slayclops', file: 'cosmetics/eyes/slayclops.png' },
    ]
  },
  {
    id: 'face',
    label: 'face',
    outputKey: 'face',
    spriteLayerClass: 'layer-face',
    items: [
      { id: 'none', name: 'None', type: 'none' },
      { id: 'blush', name: 'Blush', file: 'cosmetics/face/blush.png' },
      { id: 'shiny', name: 'Shiny', file: 'cosmetics/face/shiny.png' },
    ]
  },
  {
    id: 'accessories',
    label: 'acc',
    outputKey: 'accessory',
    spriteLayerClass: 'layer-acc',
    items: [
      { id: 'none', name: 'None', type: 'none' },
      { id: 'scarf', name: 'Scarf', file: 'cosmetics/accessories/scarf.png' },
      { id: 'blanket', name: 'Blanket', file: 'cosmetics/accessories/blanket.png' },
      { id: 'stinky', name: 'Stinky', file: 'cosmetics/accessories/stinky.png' },
      { id: 'baby', name: 'Baby', file: 'cosmetics/accessories/baby.png' },
      { id: 'bolo-tie', name: 'Bolo Tie', file: 'cosmetics/accessories/bolo_tie.png' },
      { id: 'belt', name: 'Choker', file: 'cosmetics/accessories/belt.png' },
      { id: 'dafish', name: 'Da Fish', file: 'cosmetics/accessories/dafish.png' },
      { id: 'ducky', name: 'Ducky', file: 'cosmetics/accessories/ducky.png' },
      { id: 'green-bow', name: 'Green Bow', file: 'cosmetics/accessories/green_bow.png' },
      { id: 'necklace', name: 'Locket', file: 'cosmetics/accessories/necklace.png' },
    ]
  },
];

export const COSMETIC_CATEGORIES_BY_ID = new Map(
  COSMETIC_CATEGORIES.map((category) => [category.id, category])
);

export const DEFAULT_EQUIPPED_COSMETICS = Object.fromEntries(
  COSMETIC_CATEGORIES.map(({ id, items }) => {
    const fallbackItem = items.find((item) => item.default)
      || items.find((item) => item.type === 'none')
      || items[0];
    return [id, fallbackItem?.id ?? null];
  })
);

const COSMETIC_ITEM_IDS = Object.fromEntries(
  COSMETIC_CATEGORIES.map(({ id, items }) => [id, new Set(items.map((item) => item.id))])
);

export function getCosmeticCategory(categoryId) {
  return COSMETIC_CATEGORIES_BY_ID.get(categoryId) || null;
}

export function getCosmeticItems(categoryId) {
  return getCosmeticCategory(categoryId)?.items || [];
}

export function getCosmeticItem(categoryId, itemId) {
  return getCosmeticItems(categoryId).find((item) => item.id === itemId) || null;
}

export function normalizeEquippedCosmetics(rawCosmetics = {}) {
  const normalized = { ...DEFAULT_EQUIPPED_COSMETICS };

  COSMETIC_CATEGORIES.forEach(({ id, outputKey }) => {
    const nextValue = rawCosmetics[id] ?? rawCosmetics[outputKey];
    if (COSMETIC_ITEM_IDS[id]?.has(nextValue)) {
      normalized[id] = nextValue;
    }
  });

  return normalized;
}

export function toCosmeticsPayload(equippedByCategory = {}) {
  const normalized = normalizeEquippedCosmetics(equippedByCategory);
  return Object.fromEntries(
    COSMETIC_CATEGORIES.map(({ id, outputKey }) => [outputKey, normalized[id]])
  );
}
