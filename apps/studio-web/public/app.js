const refs = {};
const state = {
  autoplayHandle: null,
  data: null,
  manifest: null,
  packId: null,
  reduceMotion: false,
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

async function boot() {
  cacheRefs();
  bindEvents();
  state.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    const manifestResponse = await fetch('./generated/manifest.json', { cache: 'no-store' });
    if (!manifestResponse.ok) {
      throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
    }

    state.manifest = await manifestResponse.json();
    renderPackTabs();

    const requestedPackId = new URLSearchParams(window.location.search).get('product');
    const initialPack = getPackById(requestedPackId) || getPackById(state.manifest.defaultPackId) || state.manifest.packs[0];
    await loadPack(initialPack.id);
  } catch (error) {
    refs.sceneStage.innerHTML = `
      <div class="error-state">
        <h2>Scene pack failed to load</h2>
        <p>${escapeHtml(error.message)}</p>
        <p>Run <code>npm run sync:scenes</code> in <code>apps/studio-web</code> and refresh.</p>
      </div>
    `;
    refs.sceneLabel.textContent = 'Data load failed';
    refs.sceneHeadline.textContent = 'No scene data';
    refs.sceneObjective.textContent = 'The preview app needs generated scene JSON before it can render.';
  }
}

function cacheRefs() {
  refs.appTitle = document.getElementById('appTitle');
  refs.copyPromptBtn = document.getElementById('copyPromptBtn');
  refs.downloadPackLink = document.getElementById('downloadPackLink');
  refs.downloadSceneBtn = document.getElementById('downloadSceneBtn');
  refs.focusChips = document.getElementById('focusChips');
  refs.metricGrid = document.getElementById('metricGrid');
  refs.nextSceneBtn = document.getElementById('nextSceneBtn');
  refs.packTabs = document.getElementById('packTabs');
  refs.prevSceneBtn = document.getElementById('prevSceneBtn');
  refs.productSubtitle = document.getElementById('productSubtitle');
  refs.productSummary = document.getElementById('productSummary');
  refs.productTitle = document.getElementById('productTitle');
  refs.promptStatus = document.getElementById('promptStatus');
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
  refs.toggleAutoplayBtn = document.getElementById('toggleAutoplayBtn');
  refs.videoTimeline = document.getElementById('videoTimeline');
}

function bindEvents() {
  refs.prevSceneBtn.addEventListener('click', () => selectScene(state.sceneIndex - 1));
  refs.nextSceneBtn.addEventListener('click', () => selectScene(state.sceneIndex + 1));
  refs.toggleAutoplayBtn.addEventListener('click', toggleAutoplay);
  refs.copyPromptBtn.addEventListener('click', copyPrompt);
  refs.downloadSceneBtn.addEventListener('click', downloadCurrentScene);

  window.addEventListener('keydown', (event) => {
    if (!state.data) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      selectScene(state.sceneIndex - 1);
    }

    if (event.key === 'ArrowRight') {
      selectScene(state.sceneIndex + 1);
    }
  });
}

function getPackById(packId) {
  if (!state.manifest || !packId) {
    return null;
  }

  return state.manifest.packs.find((pack) => pack.id === packId) || null;
}

async function loadPack(packId) {
  const pack = getPackById(packId);
  if (!pack) {
    throw new Error(`Unknown pack: ${packId}`);
  }

  stopAutoplay();
  refs.sceneStage.classList.add('is-loading');
  refs.sceneStage.innerHTML = '<p class="loading-copy">Loading scene pack...</p>';

  const response = await fetch(`./generated/${pack.file}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load scene data: ${response.status}`);
  }

  state.data = await response.json();
  state.packId = pack.id;
  state.sceneIndex = 0;

  renderPackTabs();
  renderStaticSections(pack);

  const hashSceneId = window.location.hash.replace(/^#/, '');
  const nextIndex = state.data.scenes.findIndex((scene) => scene.id === hashSceneId);
  selectScene(nextIndex >= 0 ? nextIndex : 0);
}

function renderPackTabs() {
  if (!state.manifest) {
    return;
  }

  refs.packTabs.innerHTML = state.manifest.packs
    .map((pack) => {
      const active = pack.id === state.packId ? ' is-active' : '';
      return `<button class="pack-tab${active}" data-pack-id="${escapeHtml(pack.id)}" type="button"><strong>${escapeHtml(pack.label)}</strong><span>${escapeHtml(pack.sizeDirectory)}</span></button>`;
    })
    .join('');

  refs.packTabs.querySelectorAll('.pack-tab').forEach((button) => {
    button.addEventListener('click', async () => {
      const nextPackId = button.dataset.packId;
      if (!nextPackId || nextPackId === state.packId) {
        return;
      }
      await loadPack(nextPackId);
    });
  });
}

function renderStaticSections(pack) {
  const { summary } = state.data;
  refs.appTitle.textContent = 'Portable Monitor Amazon Scene Preview';
  refs.productTitle.textContent = summary.title;
  refs.productSubtitle.textContent = summary.subtitle;
  refs.productSummary.textContent = summary.description || 'Zero-dependency preview app. Product config and scene overrides are pulled from the repo and merged into this generated pack.';
  refs.downloadPackLink.href = `./generated/${pack.file}`;
  refs.downloadPackLink.download = pack.file;
  refs.downloadPackLink.textContent = `Download ${pack.label} JSON`;
  document.title = summary.title;

  refs.focusChips.innerHTML = summary.focus.map((item) => `<span class="focus-chip">${escapeHtml(item)}</span>`).join('');
  refs.metricGrid.innerHTML = summary.metrics.map((metric) => `<article class="metric-card"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></article>`).join('');
  refs.videoTimeline.innerHTML = state.data.videoStoryboard.map((step) => `<li><span>${escapeHtml(step)}</span></li>`).join('');
}

function selectScene(nextIndex) {
  if (!state.data) {
    return;
  }

  const { scenes } = state.data;
  state.sceneIndex = (nextIndex + scenes.length) % scenes.length;
  const scene = scenes[state.sceneIndex];
  renderSceneTabs();
  renderScene(scene);
  updateUrl(scene.id);
}
function updateUrl(sceneId) {
  const query = new URLSearchParams(window.location.search);
  query.set('product', state.packId);
  window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}#${sceneId}`);
}

function renderSceneTabs() {
  refs.sceneTabs.innerHTML = state.data.scenes
    .map((scene, index) => {
      const isActive = index === state.sceneIndex;
      return `<button class="scene-tab ${isActive ? 'is-active' : ''}" data-index="${index}" type="button"><span class="scene-tab__eyebrow">${escapeHtml(scene.category)}</span><strong>${escapeHtml(scene.label)}</strong><span class="scene-tab__meta">${escapeHtml(scene.headline)}</span></button>`;
    })
    .join('');

  refs.sceneTabs.querySelectorAll('.scene-tab').forEach((button) => {
    button.addEventListener('click', () => selectScene(Number(button.dataset.index)));
  });
}

function renderScene(scene) {
  refs.sceneStage.classList.remove('is-loading');
  refs.sceneStage.innerHTML = buildStage(scene, state.data.product);
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
}

function buildStage(scene, product) {
  const compactClass = product.sizeInch <= 7 ? ' is-compact-pack' : '';
  return `
    <div class="scene-world scene-world--${scene.id}${compactClass}" style="${buildWorldStyle(scene)}">
      <div class="scene-backdrop"></div>
      <div class="scene-flare scene-flare--a"></div>
      <div class="scene-flare scene-flare--b"></div>
      <div class="scene-floor"></div>
      ${renderProps(scene)}
      <div class="monitor-rig">
        <div class="device-shadow"></div>
        ${scene.screenTemplate === 'rear-shell' ? renderRearMonitor(scene, product) : renderFrontMonitor(scene, product)}
      </div>
      ${renderOverlayCopy(scene)}
      ${renderCallouts(scene, product)}
    </div>
  `;
}

function buildWorldStyle(scene) {
  return [`--scene-accent:${scene.appearance.accent}`, `--scene-backdrop:${scene.appearance.backdrop}`, `--scene-floor:${scene.appearance.floor}`, `--scene-panel:${scene.appearance.panel}`, `--scene-text:${scene.appearance.text}`, `--device-rotate-x:${scene.camera.rotateX}deg`, `--device-rotate-y:${scene.camera.rotateY}deg`, `--device-rotate-z:${scene.camera.rotateZ}deg`, `--device-scale:${scene.camera.scale}`].join(';');
}

function renderFrontMonitor(scene, product) {
  const brand = product.branding && product.branding.visible ? product.branding.brandName : '';
  const classes = ['monitor-shell'];
  if (scene.id === 'ports-connectivity') classes.push('is-port-focus');
  if (product.sizeInch <= 7) classes.push('is-compact-device');
  return `
    <div class="${classes.join(' ')}">
      <div class="monitor-frame">
        <div class="screen-surface screen-surface--${scene.screenTemplate}">${renderScreenTemplate(scene, product)}</div>
        <div class="bezel-brand">${escapeHtml(brand)}</div>
      </div>
      <div class="stand-arm"></div>
      <div class="stand-foot"></div>
    </div>
  `;
}

function renderRearMonitor(scene, product) {
  const compactClass = product.sizeInch <= 7 ? ' is-compact-device' : '';
  return `
    <div class="monitor-shell is-rear${compactClass}">
      <div class="rear-panel">
        <div class="rear-brand">${escapeHtml(product.branding.brandName)}</div>
        <div class="rear-stand-plate"></div>
        <div class="vesa-grid"><span></span><span></span><span></span><span></span></div>
        <div class="speaker-slot speaker-slot--left"></div>
        <div class="speaker-slot speaker-slot--right"></div>
        <div class="rear-copy-stack">${scene.callouts.map((callout) => `<span>${escapeHtml(callout)}</span>`).join('')}</div>
      </div>
      <div class="stand-arm"></div>
      <div class="stand-foot"></div>
    </div>
  `;
}

function renderScreenTemplate(scene, product) {
  switch (scene.screenTemplate) {
    case 'hero-glow':
      return `<div class="screen-hero"><div class="screen-orb screen-orb--a"></div><div class="screen-orb screen-orb--b"></div><div class="screen-wave"></div></div>`;
    case 'material-sheen':
      return `<div class="screen-material"><div class="material-ribbon material-ribbon--a"></div><div class="material-ribbon material-ribbon--b"></div><div class="material-ribbon material-ribbon--c"></div></div>`;
    case 'office-workflow':
      return `<div class="screen-office"><div class="office-topbar"></div><div class="office-grid"><section class="office-editor">${Array.from({ length: 9 }, (_, index) => `<span style="--w:${78 - index * 5}%"></span>`).join('')}</section><section class="office-pane office-pane--chart"><div class="mini-chart"></div><div class="mini-chart mini-chart--wide"></div><div class="mini-chart mini-chart--short"></div></section><section class="office-pane office-pane--sheet">${Array.from({ length: 6 }, () => `<div class="sheet-row"><span></span><span></span><span></span></div>`).join('')}</section></div></div>`;
    case 'gaming-racer':
      return `<div class="screen-gaming"><div class="gaming-sun"></div><div class="gaming-track"></div><div class="gaming-hud gaming-hud--left"></div><div class="gaming-hud gaming-hud--right"></div><div class="gaming-speed"></div></div>`;
    case 'travel-desk':
      return `<div class="screen-travel"><div class="travel-card travel-card--calendar"></div><div class="travel-card travel-card--map"></div><div class="travel-card travel-card--plan"></div></div>`;
    case 'ports-diagram':
      return `<div class="screen-ports"><div class="ports-blueprint"></div><div class="ports-chip">Mini HDMI</div><div class="ports-chip">USB-C</div><div class="ports-chip">Power USB-C</div></div>`;
    case 'touch-interface':
      return `<div class="screen-touch"><div class="touch-ripple"></div><div class="touch-dot"></div><div class="touch-card touch-card--a"></div><div class="touch-card touch-card--b"></div><div class="touch-card touch-card--c"></div><div class="touch-pill"></div></div>`;
    case 'embedded-dashboard':
      return `<div class="screen-embedded"><div class="embedded-sidebar"></div><div class="embedded-panel embedded-panel--a"></div><div class="embedded-panel embedded-panel--b"></div><div class="embedded-panel embedded-panel--c"></div><div class="embedded-gauge"></div></div>`;
    case 'retro-console':
      return `<div class="screen-retro"><div class="retro-sun"></div><div class="retro-grid"></div><div class="retro-ui retro-ui--a"></div><div class="retro-ui retro-ui--b"></div><div class="retro-ui retro-ui--c"></div></div>`;
    default:
      return `<div class="screen-generic"><strong>${escapeHtml(product.screen.resolution)}</strong></div>`;
  }
}

function renderProps(scene) {
  const chunks = [];
  if (scene.props.includes('desk')) chunks.push('<div class="prop prop-desk"></div>');
  if (scene.props.includes('laptop')) chunks.push('<div class="prop prop-laptop"><div class="prop-laptop__screen"></div><div class="prop-laptop__base"></div></div>');
  if (scene.props.includes('keyboard')) chunks.push('<div class="prop prop-keyboard"></div>');
  if (scene.props.includes('mouse')) chunks.push('<div class="prop prop-mouse"></div>');
  if (scene.props.includes('console')) chunks.push('<div class="prop prop-console"><div class="console-grip console-grip--left"></div><div class="console-display"></div><div class="console-grip console-grip--right"></div></div>');
  if (scene.props.includes('backpack')) chunks.push('<div class="prop prop-backpack"></div>');
  if (scene.props.includes('passport')) chunks.push('<div class="prop prop-passport"></div>');
  if (scene.props.includes('phone')) chunks.push('<div class="prop prop-phone"></div>');
  if (scene.props.includes('cable')) chunks.push('<div class="prop prop-cable"></div>');
  if (scene.props.includes('copy-column')) chunks.push('<div class="prop prop-copy-column"><span></span><span class="wide"></span><span></span></div>');
  if (scene.props.includes('ports')) chunks.push('<div class="prop prop-tech-grid"></div>');
  if (scene.props.includes('finger-touch')) chunks.push('<div class="prop prop-finger-touch"></div>');
  if (scene.props.includes('dev-board')) chunks.push('<div class="prop prop-dev-board"><span></span><span></span><span></span><span></span></div>');
  return chunks.join('');
}
function renderOverlayCopy(scene) {
  if (scene.id === 'hero-main') {
    return '';
  }

  const sideClass = scene.id === 'gaming-144hz' || scene.id === 'gaming-compact' ? 'overlay-copy is-left' : 'overlay-copy';
  return `<div class="${sideClass}"><span class="overlay-eyebrow">${escapeHtml(scene.category)}</span><h3>${escapeHtml(scene.headline)}</h3><p>${escapeHtml(scene.subheadline)}</p><div class="overlay-badges">${scene.badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}</div></div>`;
}

function renderCallouts(scene, product) {
  if (scene.id === 'ports-connectivity') {
    return `<div class="callout-stack is-ports">${product.connectivity.map((item, index) => `<div class="callout-card port-card port-card--${index + 1}">${escapeHtml(item)}</div>`).join('')}</div>`;
  }
  return `<div class="callout-stack ${scene.id === 'vesa-speakers' ? 'is-compact' : ''}">${scene.callouts.map((callout) => `<div class="callout-card">${escapeHtml(callout)}</div>`).join('')}</div>`;
}

function buildOverrideEntries(override) {
  if (!override) {
    return ['This scene is defined directly in the generated scene pack.'];
  }
  const entries = Object.entries(override).filter(([key]) => key !== 'presetId' && key !== 'productId').map(([key, value]) => `${overrideLabels[key] || key}: ${formatValue(value)}`);
  return [`Preset ID: ${override.presetId}`, ...entries];
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(' / ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, innerValue]) => `${key}=${innerValue}`).join(', ');
  return String(value);
}

function buildList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

async function copyPrompt() {
  if (!state.data) return;
  const scene = state.data.scenes[state.sceneIndex];
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(scene.prompt);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = scene.prompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    refs.promptStatus.textContent = 'Prompt copied';
    window.setTimeout(() => {
      refs.promptStatus.textContent = scene.override ? `Preset: ${scene.override.presetId}` : 'Direct scene spec';
    }, 1600);
  } catch (error) {
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

function stopAutoplay() {
  if (!state.autoplayHandle) return;
  window.clearInterval(state.autoplayHandle);
  state.autoplayHandle = null;
  refs.toggleAutoplayBtn.textContent = 'Autoplay Off';
  refs.toggleAutoplayBtn.classList.remove('is-live');
}

function toggleAutoplay() {
  if (state.reduceMotion) {
    refs.promptStatus.textContent = 'Reduced motion is enabled';
    return;
  }
  if (state.autoplayHandle) {
    stopAutoplay();
    return;
  }
  state.autoplayHandle = window.setInterval(() => selectScene(state.sceneIndex + 1), 5200);
  refs.toggleAutoplayBtn.textContent = 'Autoplay On';
  refs.toggleAutoplayBtn.classList.add('is-live');
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
