import { PortableMonitorScene } from './three-scene.mjs';

const refs = {};
const DEFAULT_RENDER_SETTINGS = {
  autoRotate: true,
  fov: 32,
  lightBoost: 1,
  metalness: 0.82,
  propsVisible: true,
  roughness: 0.32,
  screenExposure: 1,
};

const state = {
  data: null,
  manifest: null,
  packId: null,
  preview: {
    currentTime: 0,
    duration: 30,
    frameHandle: 0,
    lastFrameAt: 0,
    playing: false,
    segments: [],
  },
  reduceMotion: false,
  renderSettings: { ...DEFAULT_RENDER_SETTINGS },
  renderer: null,
  sceneIndex: 0,
};

const overrideLabels = {
  cameraDistance: 'Camera distance',
  screenUiScale: 'Screen UI scale',
  pairedDevice: 'Paired device',
  propsLayout: 'Props layout',
  screenContent: 'Screen content',
  copyHighlights: 'Copy highlights',
  branding: 'Branding',
};

document.addEventListener('DOMContentLoaded', boot);
window.addEventListener('beforeunload', () => {
  stopPreviewPlayback();
  state.renderer?.dispose();
});

async function boot() {
  cacheRefs();
  bindEvents();
  bindRenderControls();
  state.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.renderer = new PortableMonitorScene();

  try {
    const manifestResponse = await fetch('./generated/manifest.json', { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
    state.manifest = await manifestResponse.json();
    renderPackTabs();

    const requestedPackId = new URLSearchParams(window.location.search).get('product');
    const initialPack = getPackById(requestedPackId) || getPackById(state.manifest.defaultPackId) || state.manifest.packs[0];
    await loadPack(initialPack.id);
  } catch (error) {
    refs.sceneStage.innerHTML = `<div class="error-state"><h2>Scene pack failed to load</h2><p>${escapeHtml(error.message)}</p><p>Run <code>npm run sync:scenes</code> in <code>apps/studio-web</code> and refresh.</p></div>`;
    refs.sceneLabel.textContent = 'Data load failed';
    refs.sceneHeadline.textContent = 'No scene data';
    refs.sceneObjective.textContent = 'The preview app needs generated scene JSON before it can render.';
  }
}

function cacheRefs() {
  refs.appTitle = document.getElementById('appTitle');
  refs.autoRotateInput = document.getElementById('autoRotateInput');
  refs.copyPromptBtn = document.getElementById('copyPromptBtn');
  refs.downloadPackLink = document.getElementById('downloadPackLink');
  refs.downloadSceneBtn = document.getElementById('downloadSceneBtn');
  refs.exportPngBtn = document.getElementById('exportPngBtn');
  refs.focusChips = document.getElementById('focusChips');
  refs.fovInput = document.getElementById('fovInput');
  refs.fovValue = document.getElementById('fovValue');
  refs.lightBoostInput = document.getElementById('lightBoostInput');
  refs.lightBoostValue = document.getElementById('lightBoostValue');
  refs.metricGrid = document.getElementById('metricGrid');
  refs.metalnessInput = document.getElementById('metalnessInput');
  refs.metalnessValue = document.getElementById('metalnessValue');
  refs.nextSceneBtn = document.getElementById('nextSceneBtn');
  refs.packTabs = document.getElementById('packTabs');
  refs.previewProgressInput = document.getElementById('previewProgressInput');
  refs.previewStatusLabel = document.getElementById('previewStatusLabel');
  refs.previewTimeLabel = document.getElementById('previewTimeLabel');
  refs.prevSceneBtn = document.getElementById('prevSceneBtn');
  refs.productSubtitle = document.getElementById('productSubtitle');
  refs.productSummary = document.getElementById('productSummary');
  refs.productTitle = document.getElementById('productTitle');
  refs.promptStatus = document.getElementById('promptStatus');
  refs.propsVisibleInput = document.getElementById('propsVisibleInput');
  refs.resetControlsBtn = document.getElementById('resetControlsBtn');
  refs.resetViewBtn = document.getElementById('resetViewBtn');
  refs.roughnessInput = document.getElementById('roughnessInput');
  refs.roughnessValue = document.getElementById('roughnessValue');
  refs.sceneCategory = document.getElementById('sceneCategory');
  refs.sceneComplianceList = document.getElementById('sceneComplianceList');
  refs.sceneCopyList = document.getElementById('sceneCopyList');
  refs.sceneHeadline = document.getElementById('sceneHeadline');
  refs.sceneHintsList = document.getElementById('sceneHintsList');
  refs.sceneIndexBadge = document.getElementById('sceneIndexBadge');
  refs.sceneLabel = document.getElementById('sceneLabel');
  refs.sceneObjective = document.getElementById('sceneObjective');
  refs.sceneOverrideList = document.getElementById('sceneOverrideList');
  refs.scenePrompt = document.getElementById('scenePrompt');
  refs.sceneStage = document.getElementById('sceneStage');
  refs.sceneTabs = document.getElementById('sceneTabs');
  refs.screenExposureInput = document.getElementById('screenExposureInput');
  refs.screenExposureValue = document.getElementById('screenExposureValue');
  refs.toggleAutoplayBtn = document.getElementById('toggleAutoplayBtn');
  refs.videoTimeline = document.getElementById('videoTimeline');
}

function bindEvents() {
  refs.prevSceneBtn.addEventListener('click', () => selectScene(state.sceneIndex - 1, { syncPreview: true }));
  refs.nextSceneBtn.addEventListener('click', () => selectScene(state.sceneIndex + 1, { syncPreview: true }));
  refs.toggleAutoplayBtn.addEventListener('click', togglePreviewPlayback);
  refs.copyPromptBtn.addEventListener('click', copyPrompt);
  refs.downloadSceneBtn.addEventListener('click', downloadCurrentScene);
  refs.exportPngBtn.addEventListener('click', exportCurrentPng);
  refs.resetViewBtn.addEventListener('click', resetCurrentView);
  refs.previewProgressInput.addEventListener('input', () => {
    const duration = Math.max(state.preview.duration, 1);
    const nextTime = Number(refs.previewProgressInput.value) / 1000 * duration;
    setPreviewTime(nextTime, { syncScene: true });
  });

  refs.videoTimeline.addEventListener('click', (event) => {
    const button = event.target.closest('[data-segment-index]');
    if (!button) return;
    const segmentIndex = Number(button.dataset.segmentIndex);
    jumpToSegment(segmentIndex);
  });

  window.addEventListener('keydown', (event) => {
    if (!state.data) return;
    if (event.key === 'ArrowLeft') selectScene(state.sceneIndex - 1, { syncPreview: true });
    if (event.key === 'ArrowRight') selectScene(state.sceneIndex + 1, { syncPreview: true });
    if (event.key.toLowerCase() === 'r') resetCurrentView();
    if (event.code === 'Space') {
      event.preventDefault();
      togglePreviewPlayback();
    }
  });
}

function bindRenderControls() {
  const ranged = [
    ['lightBoostInput', 'lightBoostValue', 2],
    ['screenExposureInput', 'screenExposureValue', 2],
    ['metalnessInput', 'metalnessValue', 2],
    ['roughnessInput', 'roughnessValue', 2],
    ['fovInput', 'fovValue', 0],
  ];

  ranged.forEach(([inputKey, valueKey, decimals]) => {
    refs[inputKey].addEventListener('input', () => {
      refs[valueKey].textContent = Number(refs[inputKey].value).toFixed(decimals);
      applyRenderSettings();
    });
  });

  refs.autoRotateInput.addEventListener('change', applyRenderSettings);
  refs.propsVisibleInput.addEventListener('change', applyRenderSettings);
  refs.resetControlsBtn.addEventListener('click', resetRenderSettings);
  syncRenderControls(state.renderSettings);
}

function syncRenderControls(settings) {
  refs.lightBoostInput.value = String(settings.lightBoost);
  refs.lightBoostValue.textContent = Number(settings.lightBoost).toFixed(2);
  refs.screenExposureInput.value = String(settings.screenExposure);
  refs.screenExposureValue.textContent = Number(settings.screenExposure).toFixed(2);
  refs.metalnessInput.value = String(settings.metalness);
  refs.metalnessValue.textContent = Number(settings.metalness).toFixed(2);
  refs.roughnessInput.value = String(settings.roughness);
  refs.roughnessValue.textContent = Number(settings.roughness).toFixed(2);
  refs.fovInput.value = String(settings.fov);
  refs.fovValue.textContent = String(Math.round(settings.fov));
  refs.autoRotateInput.checked = settings.autoRotate;
  refs.propsVisibleInput.checked = settings.propsVisible;
}

function readRenderSettingsFromUi() {
  return {
    autoRotate: refs.autoRotateInput.checked,
    fov: Number(refs.fovInput.value),
    lightBoost: Number(refs.lightBoostInput.value),
    metalness: Number(refs.metalnessInput.value),
    propsVisible: refs.propsVisibleInput.checked,
    roughness: Number(refs.roughnessInput.value),
    screenExposure: Number(refs.screenExposureInput.value),
  };
}

function applyRenderSettings() {
  state.renderSettings = readRenderSettingsFromUi();
  if (state.renderer) state.renderer.setSettings(state.renderSettings);
}

function resetRenderSettings() {
  state.renderSettings = { ...DEFAULT_RENDER_SETTINGS };
  syncRenderControls(state.renderSettings);
  if (state.renderer) state.renderer.setSettings(state.renderSettings);
  setTransientStatus('Renderer controls reset');
}

function getPackById(packId) {
  if (!state.manifest || !packId) return null;
  return state.manifest.packs.find((pack) => pack.id === packId) || null;
}

async function loadPack(packId) {
  const pack = getPackById(packId);
  if (!pack) throw new Error(`Unknown pack: ${packId}`);

  stopPreviewPlayback();
  refs.sceneStage.classList.add('is-loading');
  refs.sceneStage.innerHTML = '<p class="loading-copy">Loading Three.js scene pack...</p>';

  const response = await fetch(`./generated/${pack.file}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load scene data: ${response.status}`);

  state.data = await response.json();
  state.packId = pack.id;
  state.sceneIndex = 0;
  buildPreviewSegments();
  renderPackTabs();
  renderStaticSections(pack);

  const hashSceneId = window.location.hash.replace(/^#/, '');
  const nextIndex = state.data.scenes.findIndex((scene) => scene.id === hashSceneId);
  selectScene(nextIndex >= 0 ? nextIndex : 0, { syncPreview: true });
}

function buildPreviewSegments() {
  const fallbackDuration = 30;
  const storyboards = state.data?.videoStoryboard || [];
  const scenes = state.data?.scenes || [];
  const segments = [];

  for (let i = 0; i < scenes.length; i += 1) {
    const rawLine = storyboards[i] || '';
    const matched = rawLine.match(/^(\d+)-(\d+)s:\s*(.+)$/i);
    const start = matched ? Number(matched[1]) : Math.round((fallbackDuration / scenes.length) * i);
    const end = matched ? Number(matched[2]) : Math.round((fallbackDuration / scenes.length) * (i + 1));
    const label = matched ? matched[3] : scenes[i].headline;
    segments.push({ end, index: i, label, start });
  }

  state.preview.segments = segments;
  state.preview.duration = Math.max(segments.at(-1)?.end || fallbackDuration, 1);
  state.preview.currentTime = 0;
  state.preview.lastFrameAt = 0;
}

function renderPackTabs() {
  if (!state.manifest) return;
  refs.packTabs.innerHTML = state.manifest.packs
    .map((pack) => {
      const active = pack.id === state.packId ? ' is-active' : '';
      return `<button class="pack-tab${active}" data-pack-id="${escapeHtml(pack.id)}" type="button"><strong>${escapeHtml(pack.label)}</strong><span>${escapeHtml(pack.sizeDirectory)}</span></button>`;
    })
    .join('');

  refs.packTabs.querySelectorAll('.pack-tab').forEach((button) => {
    button.addEventListener('click', async () => {
      const nextPackId = button.dataset.packId;
      if (!nextPackId || nextPackId === state.packId) return;
      await loadPack(nextPackId);
    });
  });
}

function renderStaticSections(pack) {
  const { summary } = state.data;
  refs.appTitle.textContent = 'Three.js Portable Monitor Scene Preview';
  refs.productTitle.textContent = summary.title;
  refs.productSubtitle.textContent = summary.subtitle;
  refs.productSummary.textContent = summary.description || 'Three.js custom geometry scene preview driven by product config and scenario overrides.';
  refs.downloadPackLink.href = `./generated/${pack.file}`;
  refs.downloadPackLink.download = pack.file;
  refs.downloadPackLink.textContent = `Download ${pack.label} JSON`;
  document.title = summary.title;

  refs.focusChips.innerHTML = summary.focus.map((item) => `<span class="focus-chip">${escapeHtml(item)}</span>`).join('');
  refs.metricGrid.innerHTML = summary.metrics.map((metric) => `<article class="metric-card"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></article>`).join('');
  renderPreviewTimeline();
  updatePreviewUi();
  applyRenderSettings();
}

function renderPreviewTimeline() {
  refs.videoTimeline.innerHTML = state.preview.segments
    .map((segment) => {
      const active = segment.index === state.sceneIndex ? ' is-active' : '';
      return `<li class="timeline-step${active}"><button class="timeline-step__button" data-segment-index="${segment.index}" type="button"><span class="timeline-step__time">${formatTimestamp(segment.start)} - ${formatTimestamp(segment.end)}</span><span class="timeline-step__text">${escapeHtml(segment.label)}</span></button></li>`;
    })
    .join('');
}

function updatePreviewUi() {
  const duration = Math.max(state.preview.duration, 1);
  const progress = Math.round((state.preview.currentTime / duration) * 1000);
  refs.previewProgressInput.value = String(progress);
  refs.previewTimeLabel.textContent = `${formatTimestamp(state.preview.currentTime)} / ${formatTimestamp(duration)}`;
  refs.previewStatusLabel.textContent = state.preview.playing ? 'Playing' : 'Stopped';
  refs.toggleAutoplayBtn.textContent = state.preview.playing ? 'Pause Preview' : 'Play Preview';
  renderPreviewTimeline();
}

function selectScene(nextIndex, options = {}) {
  if (!state.data) return;
  const { syncPreview = false } = options;
  const { scenes } = state.data;
  state.sceneIndex = (nextIndex + scenes.length) % scenes.length;
  const scene = scenes[state.sceneIndex];
  renderSceneTabs();
  renderScene(scene);
  updateUrl(scene.id);
  if (syncPreview) syncPreviewToScene(state.sceneIndex);
}

function syncPreviewToScene(sceneIndex) {
  const segment = state.preview.segments[sceneIndex];
  if (!segment) return;
  state.preview.currentTime = segment.start;
  updatePreviewUi();
}

function setPreviewTime(nextTime, options = {}) {
  const duration = Math.max(state.preview.duration, 1);
  const clamped = Math.min(Math.max(nextTime, 0), duration);
  state.preview.currentTime = clamped;
  const segmentIndex = getPreviewSegmentIndex(clamped);
  if (segmentIndex !== state.sceneIndex) {
    selectScene(segmentIndex, { syncPreview: false });
  }
  updatePreviewUi();
  if (options.stopAtEnd && clamped >= duration) {
    stopPreviewPlayback();
  }
}

function getPreviewSegmentIndex(time) {
  const segments = state.preview.segments;
  for (let i = 0; i < segments.length; i += 1) {
    if (time >= segments[i].start && time < segments[i].end) return segments[i].index;
  }
  return segments.at(-1)?.index ?? 0;
}

function jumpToSegment(index) {
  const segment = state.preview.segments[index];
  if (!segment) return;
  setPreviewTime(segment.start, { stopAtEnd: false });
}

function startPreviewPlayback() {
  if (state.reduceMotion) {
    refs.promptStatus.textContent = 'Reduced motion is enabled';
    return;
  }
  if (state.preview.playing) return;
  if (state.preview.currentTime >= state.preview.duration) {
    state.preview.currentTime = 0;
  }
  state.preview.playing = true;
  state.preview.lastFrameAt = 0;
  updatePreviewUi();
  state.preview.frameHandle = requestAnimationFrame(stepPreviewPlayback);
}

function stopPreviewPlayback() {
  state.preview.playing = false;
  state.preview.lastFrameAt = 0;
  if (state.preview.frameHandle) cancelAnimationFrame(state.preview.frameHandle);
  state.preview.frameHandle = 0;
  updatePreviewUi();
}

function stepPreviewPlayback(timestamp) {
  if (!state.preview.playing) return;
  if (!state.preview.lastFrameAt) state.preview.lastFrameAt = timestamp;
  const delta = Math.min(timestamp - state.preview.lastFrameAt, 120) / 1000;
  state.preview.lastFrameAt = timestamp;
  setPreviewTime(state.preview.currentTime + delta, { stopAtEnd: true });
  if (state.preview.playing) {
    state.preview.frameHandle = requestAnimationFrame(stepPreviewPlayback);
  }
}

function togglePreviewPlayback() {
  if (state.preview.playing) {
    stopPreviewPlayback();
  } else {
    startPreviewPlayback();
  }
}

function renderSceneTabs() {
  refs.sceneTabs.innerHTML = state.data.scenes
    .map((scene, index) => {
      const isActive = index === state.sceneIndex;
      return `<button class="scene-tab ${isActive ? 'is-active' : ''}" data-index="${index}" type="button"><span class="scene-tab__eyebrow">${escapeHtml(scene.category)}</span><strong>${escapeHtml(scene.label)}</strong><span class="scene-tab__meta">${escapeHtml(scene.headline)}</span></button>`;
    })
    .join('');

  refs.sceneTabs.querySelectorAll('.scene-tab').forEach((button) => {
    button.addEventListener('click', () => selectScene(Number(button.dataset.index), { syncPreview: true }));
  });
}

function renderScene(scene) {
  refs.sceneStage.classList.remove('is-loading');
  refs.sceneStage.innerHTML = buildStageShell(scene, state.data.product);
  refs.sceneCategory.textContent = scene.category;
  refs.sceneLabel.textContent = scene.label;
  refs.sceneIndexBadge.textContent = `${state.sceneIndex + 1} / ${state.data.scenes.length}`;
  refs.sceneHeadline.textContent = scene.headline;
  refs.sceneObjective.textContent = scene.objective;
  refs.scenePrompt.textContent = scene.prompt;
  refs.sceneCopyList.innerHTML = buildList([scene.subheadline, ...scene.copyLines]);
  refs.sceneComplianceList.innerHTML = buildList(scene.compliance);
  refs.sceneHintsList.innerHTML = buildList(scene.renderHints);
  refs.sceneOverrideList.innerHTML = buildList(buildOverrideEntries(scene.override));
  refs.promptStatus.textContent = scene.override ? `Preset: ${scene.override.presetId}` : 'Direct scene spec';

  const mount = refs.sceneStage.querySelector('[data-three-mount]');
  state.renderer.mount(mount);
  state.renderer.render(state.data.product, scene);
  state.renderer.setSettings(state.renderSettings);
}

function buildStageShell(scene, product) {
  return `
    <div class="three-stage" style="--stage-backdrop:${scene.appearance.backdrop}; --stage-panel:${scene.appearance.panel}; --stage-text:${scene.appearance.text}; --stage-accent:${scene.appearance.accent};">
      <div class="three-stage__canvas" data-three-mount></div>
      <div class="stage-topline">
        <span class="stage-topline__badge">Three.js Custom Model</span>
        <span class="stage-topline__badge">${escapeHtml(product.sizeLabel)}</span>
        <span class="stage-topline__badge">${escapeHtml(product.screen.resolution || 'Scene Pack')}</span>
        <span class="stage-topline__badge">${escapeHtml(product.physical.thicknessMm ? `${product.physical.thicknessMm} mm` : 'Portable')}</span>
      </div>
      ${renderStageOverlay(scene, product)}
      ${renderStageCallouts(scene, product)}
      <div class="stage-bottom-note">Left drag to orbit. Right drag to pan. Wheel to zoom. Press R to reset. Use Play Preview for the 30-second sequence and Export PNG for snapshot output.</div>
    </div>
  `;
}

function renderStageOverlay(scene) {
  if (scene.id === 'hero-main') return '';
  const sideClass = scene.id === 'gaming-144hz' || scene.id === 'gaming-compact' ? 'overlay-copy is-left' : 'overlay-copy';
  return `<div class="${sideClass} is-stage"><span class="overlay-eyebrow">${escapeHtml(scene.category)}</span><h3>${escapeHtml(scene.headline)}</h3><p>${escapeHtml(scene.subheadline)}</p><div class="overlay-badges">${scene.badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}</div></div>`;
}

function renderStageCallouts(scene, product) {
  const callouts = scene.id === 'ports-connectivity' ? product.connectivity : scene.callouts;
  const classes = ['callout-stack', 'is-stage'];
  if (scene.id === 'ports-connectivity') classes.push('is-ports');
  if (scene.id === 'vesa-speakers') classes.push('is-compact');
  return `<div class="${classes.join(' ')}">${callouts.map((callout) => `<div class="callout-card">${escapeHtml(callout)}</div>`).join('')}</div>`;
}

function updateUrl(sceneId) {
  const query = new URLSearchParams(window.location.search);
  query.set('product', state.packId);
  window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}#${sceneId}`);
}

function buildOverrideEntries(override) {
  if (!override) return ['This scene is defined directly in the generated scene pack.'];
  const entries = Object.entries(override)
    .filter(([key]) => key !== 'presetId' && key !== 'productId')
    .map(([key, value]) => `${overrideLabels[key] || key}: ${formatValue(value)}`);
  return [`Preset ID: ${override.presetId}`, ...entries];
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(' / ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, inner]) => `${key}=${inner}`).join(', ');
  return String(value);
}

function buildList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

async function copyPrompt() {
  if (!state.data) return;
  const scene = state.data.scenes[state.sceneIndex];
  try {
    await navigator.clipboard.writeText(scene.prompt);
    setTransientStatus('Prompt copied');
  } catch {
    refs.promptStatus.textContent = 'Copy failed';
  }
}

function downloadCurrentScene() {
  if (!state.data) return;
  const scene = state.data.scenes[state.sceneIndex];
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${state.packId}-${scene.id}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCurrentPng() {
  if (!state.data || !state.renderer) return;
  const scene = state.data.scenes[state.sceneIndex];
  state.renderer.exportPng(`${state.packId}-${scene.id}.png`);
  setTransientStatus('PNG exported');
}

function resetCurrentView() {
  if (!state.renderer) return;
  state.renderer.resetView();
  setTransientStatus('View reset');
}

function setTransientStatus(message) {
  const scene = state.data?.scenes?.[state.sceneIndex];
  refs.promptStatus.textContent = message;
  window.setTimeout(() => {
    refs.promptStatus.textContent = scene?.override ? `Preset: ${scene.override.presetId}` : 'Direct scene spec';
  }, 1600);
}

function formatTimestamp(value) {
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

