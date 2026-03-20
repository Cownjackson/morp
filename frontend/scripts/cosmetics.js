import { COSMETICS } from './constants.js';
import { getMoopLayerFiles } from './moop-sprite.js';

// ─── Cosmetics ─────────────────────────────────────────────────────────────────
const equipped = { colors: 'trumskin', hats: 'none', eyes: 'eyes', face: 'none', accessories: 'none' };
let customizerElements = null;

// Load from localStorage if available
try { Object.assign(equipped, JSON.parse(localStorage.getItem('moop_cosmetics') || '{}')); } catch {}

export function getCosmetics() {
  return { color: equipped.colors, hat: equipped.hats, eyes: equipped.eyes, face: equipped.face, accessory: equipped.accessories };
}

export function renderMoopInto(container, cosmeticsObj) {
  container.innerHTML = '';
  const layers = getMoopLayerFiles(cosmeticsObj);
  layers.forEach(l => {
    if (!l.file) return;
    const img = document.createElement('img');
    img.src = l.file;
    img.className = 'layer ' + l.cls;
    img.alt = '';
    container.appendChild(img);
  });
}

function renderMoopPreviews() {
  const preview = document.getElementById('moop-preview');
  const stage = document.getElementById('moop-stage-modal');
  if (preview) renderMoopInto(preview, equipped);
  if (stage) renderMoopInto(stage, equipped);
}

function getCustomizerElements() {
  if (customizerElements) return customizerElements;

  return {
    panel: document.querySelector('.slot-panel'),
    tabs: Array.from(document.querySelectorAll('.slot-tab')),
    grids: Array.from(document.querySelectorAll('.slot-items'))
  };
}

function getActiveCustomizerTab() {
  return getCustomizerElements().tabs.find(tab => tab.classList.contains('active')) || null;
}

function saveEquippedCosmetics() {
  localStorage.setItem('moop_cosmetics', JSON.stringify(equipped));
}

function persistAndRefreshCosmetics(activeCategory = null) {
  saveEquippedCosmetics();
  renderMoopPreviews();
  window.dispatchEvent(new CustomEvent('moop-cosmetics-changed', {
    detail: getCosmetics()
  }));

  if (!activeCategory) return;

  renderCosmeticGrid(activeCategory);
  const activeTab = getActiveCustomizerTab();
  if (activeTab?.dataset.tab === activeCategory) {
    activateCustomizerTab(activeTab, { preserveScroll: true });
  }
}

function renderCosmeticGrid(category) {
  const grid = document.getElementById(`grid-${category}`);
  if (!grid) return;
  grid.innerHTML = '';
  const items = COSMETICS[category];
  if (items.length <= 1 && items[0]?.type === 'none') {
    const none = document.createElement('div');
    none.className = 'slot-item none-item selected';
    none.textContent = 'x';
    grid.appendChild(none);
    const msg = document.createElement('div');
    msg.className = 'slot-empty-msg';
    msg.textContent = 'more coming soon...';
    grid.appendChild(msg);
    return;
  }
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'slot-item' + (equipped[category] === item.id ? ' selected' : '');
    el.title = item.name;
    if (item.type === 'none') {
      el.classList.add('none-item');
      el.textContent = 'x';
    } else if (item.file) {
      const img = document.createElement('img');
      img.src = item.file;
      img.alt = item.name;
      el.appendChild(img);
    }
    el.onclick = () => {
      equipped[category] = item.id;
      persistAndRefreshCosmetics(category);
    };
    grid.appendChild(el);
  });
}

function updateActiveTabIndicator(panel, activeTab) {
  if (!panel || !activeTab) return;

  const tabsRect = activeTab.parentElement.getBoundingClientRect();
  const activeRect = activeTab.getBoundingClientRect();
  panel.style.setProperty('--slot-tab-indicator-x', `${activeRect.left - tabsRect.left}px`);
  panel.style.setProperty('--slot-tab-indicator-width', `${activeRect.width}px`);
}

function activateCustomizerTab(tab, options = {}) {
  const { preserveScroll = false } = options;
  if (!tab) return;

  const { panel, tabs, grids } = getCustomizerElements();
  const nextGrid = document.getElementById(`grid-${tab.dataset.tab}`);
  if (!nextGrid) return;

  tabs.forEach(t => t.classList.toggle('active', t === tab));
  grids.forEach(grid => {
    const isActive = grid === nextGrid;
    grid.classList.toggle('active', isActive);
    if (isActive && !preserveScroll) {
      grid.scrollTop = 0;
    }
  });

  updateActiveTabIndicator(panel, tab);
}

export function randomizeMoopCosmetics() {
  Object.keys(COSMETICS).forEach(cat => {
    const items = COSMETICS[cat];
    equipped[cat] = items[Math.floor(Math.random() * items.length)].id;
  });

  persistAndRefreshCosmetics(getActiveCustomizerTab()?.dataset.tab ?? null);
}

export function initMoopCustomizer() {
  Object.keys(COSMETICS).forEach(cat => renderCosmeticGrid(cat));
  renderMoopPreviews();

  const modal = document.getElementById('moop-modal');
  customizerElements = {
    panel: document.querySelector('.slot-panel'),
    tabs: Array.from(document.querySelectorAll('.slot-tab')),
    grids: Array.from(document.querySelectorAll('.slot-items')),
    landingRandomizeButton: document.getElementById('moop-random-btn'),
    modalRandomizeButton: document.getElementById('randomize-btn')
  };
  document.getElementById('moop-btn').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('moop-done-btn').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  customizerElements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activateCustomizerTab(tab);
    });
  });

  const activeTab = getActiveCustomizerTab();
  if (activeTab) {
    activateCustomizerTab(activeTab, { preserveScroll: true });
  }

  window.addEventListener('resize', () => {
    updateActiveTabIndicator(
      customizerElements?.panel,
      getActiveCustomizerTab()
    );
  });

  if (customizerElements.landingRandomizeButton) {
    customizerElements.landingRandomizeButton.addEventListener('click', randomizeMoopCosmetics);
  }

  if (customizerElements.modalRandomizeButton) {
    customizerElements.modalRandomizeButton.addEventListener('click', randomizeMoopCosmetics);
  }
}
