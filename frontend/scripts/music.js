// ─── Music player ─────────────────────────────────────────────────────────────
export function initMusic() {
  const audio = document.getElementById('bg-music');
  const wrap = document.getElementById('volume-wrap');
  const btn = document.getElementById('volume-btn');
  const slider = document.getElementById('volume-slider');
  const waves = document.getElementById('vol-waves');
  const muteLine = document.getElementById('vol-mute-line');
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  let started = false;
  const savedVol = localStorage.getItem('morp_volume');
  const savedMute = localStorage.getItem('morp_muted') === 'true';
  const vol = savedVol !== null ? Number(savedVol) : 30;
  slider.value = vol;
  audio.volume = vol / 100;

  function updateIcon() {
    const muted = audio.muted || audio.volume === 0;
    btn.classList.toggle('muted', muted);
    waves.style.display = muted ? 'none' : '';
    muteLine.style.display = muted ? '' : 'none';
  }

  if (savedMute) { audio.muted = true; }
  updateIcon();

  // Start playback on first user interaction (browser autoplay policy)
  function tryPlay() {
    if (started) return;
    started = true;
    audio.play().catch(() => {});
    document.removeEventListener('click', tryPlay);
    document.removeEventListener('keydown', tryPlay);
    document.removeEventListener('touchstart', tryPlay);
  }
  document.addEventListener('click', tryPlay);
  document.addEventListener('keydown', tryPlay);
  document.addEventListener('touchstart', tryPlay);

  // Tap / click = toggle mute
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.muted = !audio.muted;
    localStorage.setItem('morp_muted', audio.muted);
    updateIcon();
  });

  // Desktop: hover to reveal volume slider
  if (!isTouch) {
    wrap.addEventListener('mouseenter', () => wrap.classList.add('open'));
    wrap.addEventListener('mouseleave', () => wrap.classList.remove('open'));
  }

  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    audio.volume = v / 100;
    audio.muted = false;
    localStorage.setItem('morp_volume', v);
    localStorage.setItem('morp_muted', 'false');
    updateIcon();
  });
}
