import {
  COSMETIC_CATEGORIES,
  COSMETIC_STORAGE_KEY,
  getCosmeticCategory,
  normalizeEquippedCosmetics,
  toCosmeticsPayload
} from './constants.js?v=draw-hint-footer-3';
import { getMoopLayerFiles } from './moop-sprite.js?v=draw-hint-footer-3';

const FIRST_CATEGORY_ID = COSMETIC_CATEGORIES[0]?.id ?? null;
const equipped = normalizeEquippedCosmetics(loadStoredCosmetics());

let customizerElements = null;

function loadStoredCosmetics() {
  try {
    return JSON.parse(localStorage.getItem(COSMETIC_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function getGridId(categoryId) {
  return `grid-${categoryId}`;
}

function getActiveCustomizerTab() {
  return customizerElements?.tabs.find((tab) => tab.classList.contains('active')) || null;
}

function getGridByCategory(categoryId) {
  return customizerElements?.grids.find((grid) => grid.id === getGridId(categoryId)) || null;
}

function saveEquippedCosmetics() {
  localStorage.setItem(COSMETIC_STORAGE_KEY, JSON.stringify(equipped));
}

export function getCosmetics() {
  return toCosmeticsPayload(equipped);
}

export function renderMoopInto(container, cosmeticsObj) {
  container.innerHTML = '';
  const layers = getMoopLayerFiles(cosmeticsObj);

  layers.forEach((layer) => {
    if (!layer.file) return;

    const img = document.createElement('img');
    img.src = layer.file;
    img.className = `layer ${layer.cls}`;
    img.alt = '';
    container.appendChild(img);
  });
}

function renderMoopPreviews() {
  if (customizerElements?.preview) renderMoopInto(customizerElements.preview, equipped);
  if (customizerElements?.stage) renderMoopInto(customizerElements.stage, equipped);
}

function cacheCustomizerElements() {
  customizerElements = {
    modal: document.getElementById('moop-modal'),
    panel: document.querySelector('.slot-panel'),
    tabsContainer: document.querySelector('.slot-tabs'),
    gridsContainer: document.querySelector('.slot-grid-stage'),
    preview: document.getElementById('moop-preview'),
    stage: document.getElementById('moop-stage-modal'),
    openButton: document.getElementById('moop-btn'),
    closeButton: document.getElementById('moop-done-btn'),
    landingRandomizeButton: document.getElementById('moop-random-btn'),
    modalRandomizeButton: document.getElementById('randomize-btn'),
    tabs: [],
    grids: []
  };
}

function syncCustomizerCollections() {
  customizerElements.tabs = Array.from(customizerElements.tabsContainer.querySelectorAll('.slot-tab'));
  customizerElements.grids = Array.from(customizerElements.gridsContainer.querySelectorAll('.slot-items'));
}

function ensureCustomizerTab(category, index) {
  let tab = customizerElements.tabsContainer.querySelector(`.slot-tab[data-tab="${category.id}"]`);
  if (!tab) {
    tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'slot-tab';
  }

  tab.type = 'button';
  tab.dataset.tab = category.id;
  tab.textContent = category.label;
  tab.classList.toggle('active', index === 0);
  customizerElements.tabsContainer.appendChild(tab);
}

function ensureCustomizerGrid(category, index) {
  let grid = customizerElements.gridsContainer.querySelector(`#${getGridId(category.id)}`);
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'slot-items';
  }

  grid.id = getGridId(category.id);
  grid.classList.toggle('active', index === 0);
  customizerElements.gridsContainer.appendChild(grid);
}

function removeStaleCustomizerChildren(container, selector, validIds, getChildId) {
  Array.from(container.querySelectorAll(selector)).forEach((child) => {
    if (!validIds.has(getChildId(child))) {
      child.remove();
    }
  });
}

function ensureCustomizerPanel() {
  if (!customizerElements?.tabsContainer || !customizerElements?.gridsContainer) return;

  const validCategoryIds = new Set(COSMETIC_CATEGORIES.map(({ id }) => id));
  removeStaleCustomizerChildren(
    customizerElements.tabsContainer,
    '.slot-tab',
    validCategoryIds,
    (tab) => tab.dataset.tab
  );
  removeStaleCustomizerChildren(
    customizerElements.gridsContainer,
    '.slot-items',
    validCategoryIds,
    (grid) => grid.id.replace(/^grid-/, '')
  );

  COSMETIC_CATEGORIES.forEach((category, index) => {
    ensureCustomizerTab(category, index);
    ensureCustomizerGrid(category, index);
  });

  syncCustomizerCollections();
}

function renderEmptyGrid(grid) {
  const none = document.createElement('div');
  none.className = 'slot-item none-item selected';
  none.textContent = 'x';
  grid.appendChild(none);

  const msg = document.createElement('div');
  msg.className = 'slot-empty-msg';
  msg.textContent = 'more coming soon...';
  grid.appendChild(msg);
}

function renderCosmeticGrid(categoryId) {
  const category = getCosmeticCategory(categoryId);
  const grid = getGridByCategory(categoryId);
  if (!category || !grid) return;

  grid.innerHTML = '';

  if (category.items.length <= 1 && category.items[0]?.type === 'none') {
    renderEmptyGrid(grid);
    return;
  }

  category.items.forEach((item) => {
    const tile = document.createElement('div');
    tile.className = `slot-item${equipped[categoryId] === item.id ? ' selected' : ''}`;
    tile.title = item.name;
    tile.dataset.category = categoryId;
    tile.dataset.itemId = item.id;

    if (item.type === 'none') {
      tile.classList.add('none-item');
      tile.textContent = 'x';
    } else if (item.file) {
      const img = document.createElement('img');
      img.src = item.file;
      img.alt = item.name;
      tile.appendChild(img);
    }

    grid.appendChild(tile);
  });
}

function renderAllCosmeticGrids() {
  COSMETIC_CATEGORIES.forEach(({ id }) => renderCosmeticGrid(id));
}

function updateActiveTabIndicator(activeTab = getActiveCustomizerTab()) {
  if (!customizerElements?.panel || !activeTab) return;

  const tabsRect = activeTab.parentElement.getBoundingClientRect();
  const activeRect = activeTab.getBoundingClientRect();
  customizerElements.panel.style.setProperty('--slot-tab-indicator-x', `${activeRect.left - tabsRect.left}px`);
  customizerElements.panel.style.setProperty('--slot-tab-indicator-width', `${activeRect.width}px`);
}

function activateCustomizerTab(tab, { preserveScroll = false } = {}) {
  if (!tab) return;

  const nextGrid = getGridByCategory(tab.dataset.tab);
  if (!nextGrid) return;

  customizerElements.tabs.forEach((candidate) => {
    candidate.classList.toggle('active', candidate === tab);
  });

  customizerElements.grids.forEach((grid) => {
    const isActive = grid === nextGrid;
    grid.classList.toggle('active', isActive);
    if (isActive && !preserveScroll) {
      grid.scrollTop = 0;
    }
  });

  updateActiveTabIndicator(tab);
}

function persistAndRefreshCosmetics({ preserveActiveScroll = false } = {}) {
  const activeCategoryId = getActiveCustomizerTab()?.dataset.tab ?? FIRST_CATEGORY_ID;
  const activeScrollTop = preserveActiveScroll
    ? getGridByCategory(activeCategoryId)?.scrollTop ?? 0
    : 0;

  saveEquippedCosmetics();
  renderMoopPreviews();
  renderAllCosmeticGrids();

  const activeTab = customizerElements.tabs.find((tab) => tab.dataset.tab === activeCategoryId) || customizerElements.tabs[0];
  if (activeTab) {
    activateCustomizerTab(activeTab, { preserveScroll: true });

    if (preserveActiveScroll) {
      const activeGrid = getGridByCategory(activeCategoryId);
      if (activeGrid) activeGrid.scrollTop = activeScrollTop;
    }
  }

  window.dispatchEvent(new CustomEvent('moop-cosmetics-changed', {
    detail: getCosmetics()
  }));
}

function handleCustomizerTabClick(event) {
  const tab = event.target.closest('.slot-tab');
  if (!tab) return;
  activateCustomizerTab(tab);
}

function handleCustomizerGridClick(event) {
  const tile = event.target.closest('.slot-item[data-category][data-item-id]');
  if (!tile) return;

  equipped[tile.dataset.category] = tile.dataset.itemId;
  persistAndRefreshCosmetics({ preserveActiveScroll: true });
}

export function randomizeMoopCosmetics() {
  COSMETIC_CATEGORIES.forEach(({ id, items }) => {
    equipped[id] = items[Math.floor(Math.random() * items.length)].id;
  });

  persistAndRefreshCosmetics({ preserveActiveScroll: true });
}

export function initMoopCustomizer() {
  cacheCustomizerElements();
  ensureCustomizerPanel();
  renderAllCosmeticGrids();
  renderMoopPreviews();

  customizerElements.openButton?.addEventListener('click', () => {
    customizerElements.modal?.classList.add('open');
  });

  customizerElements.closeButton?.addEventListener('click', () => {
    customizerElements.modal?.classList.remove('open');
  });

  customizerElements.modal?.addEventListener('click', (event) => {
    if (event.target === customizerElements.modal) {
      customizerElements.modal.classList.remove('open');
    }
  });

  customizerElements.tabsContainer?.addEventListener('click', handleCustomizerTabClick);
  customizerElements.gridsContainer?.addEventListener('click', handleCustomizerGridClick);

  const initialTab = getActiveCustomizerTab() || customizerElements.tabs[0];
  if (initialTab) {
    activateCustomizerTab(initialTab, { preserveScroll: true });
  }

  window.addEventListener('resize', () => {
    updateActiveTabIndicator();
  });

  customizerElements.landingRandomizeButton?.addEventListener('click', randomizeMoopCosmetics);
  customizerElements.modalRandomizeButton?.addEventListener('click', randomizeMoopCosmetics);
}
