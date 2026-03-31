import * as THREE from './vendor/three.module.js';

const TEMP_VECTOR = new THREE.Vector3();
const TEMP_TARGET = new THREE.Vector3();
const TEMP_SPHERICAL = new THREE.Spherical();

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}


function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function regionRevealProgress(elapsed, delay, duration) {
  return easeOutCubic((elapsed - delay) / duration);
}

function withReveal(ctx, progress, offsetY, draw) {
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.translate(0, (1 - progress) * offsetY);
  draw();
  ctx.restore();
}

function drawScreenHud(ctx, canvas, product, scene, elapsed = 99) {
  const hud = buildSceneHudContent(scene, product);
  const chips = hud.chips.slice(0, 4).map((item) => truncateLabel(item, 24));
  const details = hud.details.slice(0, 5).map((item) => truncateLabel(item, 40));
  const chipY = 28;
  const chipHeight = 54;
  let chipX = 28;

  const headerProgress = regionRevealProgress(elapsed, 0.08, 0.9);
  const chipsProgress = chips.map((_, index) => regionRevealProgress(elapsed, 0.78 + index * 0.24, 0.58));
  const panelProgress = regionRevealProgress(elapsed, 1.72, 0.82);
  const detailProgress = details.map((_, index) => regionRevealProgress(elapsed, 2.12 + index * 0.2, 0.46));
  const footerProgress = regionRevealProgress(elapsed, 3.18, 0.72);

  withReveal(ctx, headerProgress, 26, () => {
    fillRoundedRect(ctx, 24, 18, 520, 100, 22, 'rgba(7, 14, 24, 0.46)');
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '700 34px sans-serif';
    ctx.fillText(hud.title, 44, 58);
    ctx.fillStyle = 'rgba(255,255,255,0.76)';
    ctx.font = '500 21px sans-serif';
    ctx.fillText(truncateLabel(hud.subtitle, 50), 44, 92);
  });

  ctx.font = '700 23px sans-serif';
  chips.forEach((spec, index) => {
    const progress = chipsProgress[index];
    const width = Math.max(112, Math.min(230, 34 + spec.length * 11));
    withReveal(ctx, progress, 20, () => {
      fillRoundedRect(ctx, chipX, chipY + 108, width, chipHeight, 22, 'rgba(255,255,255,0.18)');
      ctx.fillStyle = '#f4fbff';
      ctx.fillText(spec, chipX + 20, chipY + 143);
    });
    chipX += width + 12;
  });

  const panelX = canvas.width - 430;
  withReveal(ctx, panelProgress, 28, () => {
    fillRoundedRect(ctx, panelX, 20, 390, 248, 24, 'rgba(7, 14, 24, 0.38)');
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '700 22px sans-serif';
    ctx.fillText(hud.panelTitle, panelX + 22, 58);
  });

  ctx.font = '500 20px sans-serif';
  details.forEach((spec, index) => {
    withReveal(ctx, detailProgress[index], 16, () => {
      fillRoundedRect(ctx, panelX + 20, 78 + index * 34, 346, 26, 12, index % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)');
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillText(spec, panelX + 34, 98 + index * 34);
    });
  });

  withReveal(ctx, footerProgress, 18, () => {
    fillRoundedRect(ctx, 24, canvas.height - 86, 760, 58, 20, 'rgba(7, 14, 24, 0.38)');
    ctx.fillStyle = 'rgba(255,255,255,0.84)';
    ctx.font = '500 22px sans-serif';
    ctx.fillText(truncateLabel(hud.footer, 66), 44, canvas.height - 50);
  });
}

function buildSceneHudContent(scene, product) {
  const refreshOrTouch = product.screen.touch ? 'Touch Enabled' : product.screen.refreshRate;
  const sceneHighlights = [
    ...(scene.callouts || []),
    ...((scene.override && Array.isArray(scene.override.copyHighlights)) ? scene.override.copyHighlights : []),
  ].filter(Boolean);

  const base = {
    footer: `${product.branding?.brandName || 'LuminaDisplay'} • ${buildSceneFooterLabel(scene)}`,
    panelTitle: 'Scene Specs',
    subtitle: scene.subheadline || `${product.sizeLabel} ${product.screen.panelType || 'Display'}`,
    title: scene.headline || product.branding?.brandName || 'LuminaDisplay',
  };

  switch (scene.id) {
    case 'hero-main':
      return {
        ...base,
        chips: [product.sizeLabel, product.screen.resolution, refreshOrTouch, product.screen.panelType],
        details: [
          `${product.screen.aspectRatio} panel ratio`,
          `${product.screen.brightnessNits} nits brightness`,
          `${product.screen.colorGamut} color gamut`,
          `${product.physical.thicknessMm} mm slim profile`,
          `${product.physical.weightG} g portable body`,
        ],
        panelTitle: 'Hero Specs',
        subtitle: `${product.branding?.brandName || 'LuminaDisplay'} hero configuration`,
        title: `${product.branding?.brandName || 'LuminaDisplay'} ${product.sizeLabel}`,
      };
    case 'material-stand':
    case 'compact-build':
      return {
        ...base,
        chips: ['Metal Body', `${product.physical.thicknessMm} mm`, `${product.physical.weightG} g`, product.sizeLabel],
        details: [
          ...sceneHighlights,
          `${product.physical.widthMm} x ${product.physical.heightMm} mm footprint`,
          product.physical.bodyMaterial,
        ],
        panelTitle: 'Build Details',
      };
    case 'office-productivity':
    case 'embedded-control':
      return {
        ...base,
        chips: [product.screen.aspectRatio, product.screen.resolution, product.screen.touch ? 'Touch UI' : 'USB-C workflow', product.sizeLabel],
        details: sceneHighlights.length ? sceneHighlights : [`${product.screen.resolution} workspace`, `${product.screen.aspectRatio} canvas`, 'Productivity-ready scene'],
        panelTitle: scene.id === 'embedded-control' ? 'Embedded Fit' : 'Workflow Fit',
      };
    case 'gaming-144hz':
      return {
        ...base,
        chips: [product.screen.refreshRate, `${product.screen.brightnessNits} nits`, product.screen.panelType, 'Console Ready'],
        details: sceneHighlights,
        panelTitle: 'Gaming Specs',
      };
    case 'gaming-compact':
      return {
        ...base,
        chips: ['Mini HDMI', `${product.screen.brightnessNits} nits`, product.screen.panelType, 'Portable Play'],
        details: sceneHighlights,
        panelTitle: 'Compact Play',
      };
    case 'travel-portable':
      return {
        ...base,
        chips: [`${product.physical.weightG} g`, `${product.physical.thicknessMm} mm`, product.sizeLabel, 'Travel Ready'],
        details: sceneHighlights,
        panelTitle: 'Travel Fit',
      };
    case 'touch-lamination':
      return {
        ...base,
        chips: ['Touch Enabled', product.screen.resolution, product.screen.panelType, `${product.screen.brightnessNits} nits`],
        details: sceneHighlights,
        panelTitle: 'Touch Specs',
        subtitle: product.screen.touchType || base.subtitle,
      };
    case 'ports-connectivity':
      return {
        ...base,
        chips: ['Mini HDMI', 'USB-C', 'Power USB-C', 'Audio'],
        details: product.connectivity,
        panelTitle: 'Port Layout',
        subtitle: 'Connection map and port-ready workflow',
        title: 'Connectivity Matrix',
      };
    case 'vesa-speakers':
      return {
        ...base,
        chips: ['75 x 75 VESA', 'Dual Speakers', product.sizeLabel, product.screen.panelType],
        details: sceneHighlights,
        panelTitle: 'Rear Features',
      };
    default:
      return {
        ...base,
        chips: [product.sizeLabel, product.screen.resolution, refreshOrTouch, product.screen.panelType],
        details: buildScreenSpecList(product),
      };
  }
}

function buildSceneFooterLabel(scene) {
  const footerMap = {
    'compact-build': 'Build Showcase',
    'embedded-control': 'Control Panel Workflow',
    'gaming-144hz': 'Gaming Performance',
    'gaming-compact': 'Compact Entertainment',
    'hero-main': 'Hero Composition',
    'material-stand': 'Premium Build Showcase',
    'office-productivity': 'Productivity Workflow',
    'ports-connectivity': 'Port Breakdown',
    'touch-lamination': 'Touch Interaction Demo',
    'travel-portable': 'Travel Setup',
    'vesa-speakers': 'Rear Mount Features',
  };
  return footerMap[scene.id] || scene.headline || 'Scene Preview';
}

function buildScreenSpecList(product) {
  return [
    `${product.screen.aspectRatio} panel ratio`,
    `${product.screen.brightnessNits || ''} nits brightness`.trim(),
    `${product.screen.colorGamut || ''} color gamut`.trim(),
    `${product.physical.thicknessMm || ''} mm slim body`.trim(),
    `${product.physical.weightG || ''} g total weight`.trim(),
  ].filter(Boolean);
}

function truncateLabel(value, maxChars = 32) {
  const text = String(value || '').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

function drawScreenBase(ctx, canvas, scene, product) {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#09131f');
  gradient.addColorStop(0.45, scene.appearance.accent);
  gradient.addColorStop(1, '#f6efe2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  switch (scene.screenTemplate) {
    case 'hero-glow':
      drawHeroGlow(ctx, canvas);
      break;
    case 'material-sheen':
      drawMaterialSheen(ctx, canvas);
      break;
    case 'office-workflow':
      drawOfficeWorkflow(ctx, canvas);
      break;
    case 'gaming-racer':
      drawGamingScene(ctx, canvas);
      break;
    case 'travel-desk':
      drawTravelCards(ctx, canvas);
      break;
    case 'ports-diagram':
      drawPortsBlueprint(ctx, canvas);
      break;
    case 'touch-interface':
      drawTouchUi(ctx, canvas);
      break;
    case 'embedded-dashboard':
      drawEmbeddedUi(ctx, canvas);
      break;
    case 'retro-console':
      drawRetroUi(ctx, canvas);
      break;
    default:
      drawInfoCard(ctx, canvas, product.screen.resolution || product.sizeLabel);
      break;
  }
}

function redrawScreenTexture(state, scene, product, elapsed = 99) {
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  drawScreenBase(state.ctx, state.canvas, scene, product);
  drawScreenHud(state.ctx, state.canvas, product, scene, elapsed);
  state.texture.needsUpdate = true;
}

function createScreenTextureState(scene, product) {
  const canvas = createCanvas(1280, 800);
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const state = { canvas, ctx, texture };
  redrawScreenTexture(state, scene, product, 99);
  return state;
}function drawHeroGlow(ctx, canvas) {
  const glow = ctx.createRadialGradient(canvas.width * 0.68, canvas.height * 0.42, 30, canvas.width * 0.68, canvas.height * 0.42, canvas.width * 0.44);
  glow.addColorStop(0, 'rgba(255,255,255,0.78)');
  glow.addColorStop(0.45, 'rgba(125, 211, 252, 0.42)');
  glow.addColorStop(1, 'rgba(10, 22, 36, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.22, canvas.height * 0.24, canvas.width * 0.2, canvas.height * 0.28, Math.PI / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.58, canvas.height * 0.88, canvas.width * 0.52, canvas.height * 0.18, -0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawMaterialSheen(ctx, canvas) {
  ctx.fillStyle = '#0f1720';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const stripe of [
    { x: -120, y: 40, w: 680, h: 120, color: 'rgba(255,255,255,0.12)', angle: -0.18 },
    { x: 420, y: 180, w: 760, h: 110, color: 'rgba(255, 217, 163, 0.22)', angle: 0.22 },
    { x: 140, y: 520, w: 820, h: 110, color: 'rgba(125, 211, 252, 0.16)', angle: 0.14 },
  ]) {
    ctx.save();
    ctx.translate(stripe.x + stripe.w / 2, stripe.y + stripe.h / 2);
    ctx.rotate(stripe.angle);
    fillRoundedRect(ctx, -stripe.w / 2, -stripe.h / 2, stripe.w, stripe.h, 60, stripe.color);
    ctx.restore();
  }
}

function drawOfficeWorkflow(ctx, canvas) {
  fillRoundedRect(ctx, 40, 30, canvas.width - 80, 32, 16, 'rgba(255,255,255,0.09)');
  fillRoundedRect(ctx, 40, 86, 680, canvas.height - 130, 26, 'rgba(255,255,255,0.08)');
  fillRoundedRect(ctx, 758, 86, 482, 250, 26, 'rgba(255,255,255,0.08)');
  fillRoundedRect(ctx, 758, 366, 482, 290, 26, 'rgba(255,255,255,0.08)');
  for (let i = 0; i < 10; i += 1) {
    fillRoundedRect(ctx, 86, 136 + i * 52, 500 - i * 22, 14, 8, i % 3 === 0 ? '#7dd3fc' : '#c4b5fd');
  }
  for (let i = 0; i < 4; i += 1) {
    fillRoundedRect(ctx, 798, 126 + i * 44, 360 - i * 34, 18, 9, '#9ee7cf');
  }
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      fillRoundedRect(ctx, 798 + col * 138, 408 + row * 34, 110, 12, 6, 'rgba(255,255,255,0.2)');
    }
  }
}

function drawGamingScene(ctx, canvas) {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#09101a');
  sky.addColorStop(0.52, '#173b67');
  sky.addColorStop(1, '#ff5a3d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255, 201, 93, 0.92)';
  ctx.beginPath();
  ctx.arc(canvas.width * 0.5, canvas.height * 0.26, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.44, canvas.height * 0.36);
  ctx.lineTo(canvas.width * 0.56, canvas.height * 0.36);
  ctx.lineTo(canvas.width * 0.86, canvas.height);
  ctx.lineTo(canvas.width * 0.14, canvas.height);
  ctx.closePath();
  ctx.fill();
  for (const offset of [-60, 0, 60]) {
    ctx.fillStyle = `rgba(255,255,255,${offset === 0 ? 0.92 : 0.28})`;
    fillRoundedRect(ctx, -120, canvas.height * 0.58 + offset, canvas.width + 240, 5, 3, ctx.fillStyle);
  }
}

function drawTravelCards(ctx, canvas) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  fillRoundedRect(ctx, 42, 42, 330, 250, 32, ctx.fillStyle);
  fillRoundedRect(ctx, 848, 42, 372, 340, 32, ctx.fillStyle);
  fillRoundedRect(ctx, 42, 560, canvas.width - 84, 168, 32, 'rgba(255,255,255,0.2)');
}
function drawPortsBlueprint(ctx, canvas) {
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.32)';
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, canvas.width - 84, canvas.height - 84);
  const labels = ['Mini HDMI', 'USB-C', 'Power USB-C', 'Audio'];
  labels.forEach((label, index) => {
    fillRoundedRect(ctx, 68, 76 + index * 86, 260, 42, 21, 'rgba(125, 211, 252, 0.16)');
    ctx.fillStyle = '#e2f8ff';
    ctx.font = '600 24px sans-serif';
    ctx.fillText(label, 92, 104 + index * 86);
  });
}

function drawTouchUi(ctx, canvas) {
  ctx.fillStyle = '#061723';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  fillRoundedRect(ctx, 132, 104, 430, 92, 24, 'rgba(255,255,255,0.16)');
  fillRoundedRect(ctx, 132, 234, 430, 92, 24, 'rgba(255,255,255,0.16)');
  fillRoundedRect(ctx, 132, 364, 430, 92, 24, 'rgba(255,255,255,0.16)');
  fillRoundedRect(ctx, 132, 586, 940, 78, 39, 'rgba(255,255,255,0.2)');
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(920, 270, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(920, 270, 118, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(920, 270, 18, 0, Math.PI * 2);
  ctx.fill();
}

function drawEmbeddedUi(ctx, canvas) {
  ctx.fillStyle = '#071017';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  fillRoundedRect(ctx, 0, 0, 220, canvas.height, 0, 'rgba(0,0,0,0.2)');
  fillRoundedRect(ctx, 300, 100, 790, 104, 26, 'rgba(255,255,255,0.16)');
  fillRoundedRect(ctx, 300, 256, 790, 104, 26, 'rgba(255,255,255,0.16)');
  fillRoundedRect(ctx, 300, 412, 790, 104, 26, 'rgba(255,255,255,0.16)');
  fillRoundedRect(ctx, 360, 600, 520, 72, 36, '#86efac');
}

function drawRetroUi(ctx, canvas) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#060b13');
  gradient.addColorStop(0.4, '#1f2860');
  gradient.addColorStop(1, '#ff8a5b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,205,84,0.92)';
  ctx.beginPath();
  ctx.arc(canvas.width * 0.52, canvas.height * 0.28, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(-120, canvas.height * 0.68);
  ctx.lineTo(canvas.width + 120, canvas.height * 0.68);
  ctx.lineTo(canvas.width + 120, canvas.height);
  ctx.lineTo(-120, canvas.height);
  ctx.closePath();
  ctx.fill();
  fillRoundedRect(ctx, 48, 48, 360, 18, 9, 'rgba(255,255,255,0.26)');
  fillRoundedRect(ctx, 48, 92, 520, 18, 9, 'rgba(255,255,255,0.26)');
  fillRoundedRect(ctx, 48, 136, 420, 18, 9, 'rgba(255,255,255,0.26)');
}

function drawInfoCard(ctx, canvas, label) {
  fillRoundedRect(ctx, 64, 64, canvas.width - 128, canvas.height - 128, 40, 'rgba(255,255,255,0.18)');
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 46px sans-serif';
  ctx.fillText(label, 124, canvas.height * 0.56);
}

function drawLabelTexture(label, width = 512, height = 128, options = {}) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.font = `${options.fontWeight || 600} ${options.fontSize || 56}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = options.color || 'rgba(255,255,255,0.88)';
  ctx.fillText(label, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildMetrics(product) {
  const referenceWidth = product.sizeInch >= 15 ? 2.6 : 2.1;
  const scale = referenceWidth / Math.max(product.physical.widthMm || 300, 200);
  const width = (product.physical.widthMm || 300) * scale;
  const height = (product.physical.heightMm || 190) * scale;
  const depth = Math.max((product.physical.thicknessMm || 12) * scale, 0.06);

  return {
    scale,
    width,
    height,
    depth,
    screenWidth: width * 0.88,
    screenHeight: height * 0.82,
    standHeight: product.sizeInch >= 15 ? height * 0.36 : height * 0.26,
    footWidth: product.sizeInch >= 15 ? width * 0.38 : width * 0.34,
  };
}

function createStandardMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extra.roughness ?? 0.34,
    metalness: extra.metalness ?? 0.78,
    ...extra,
  });
}

function setShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function createGroup() {
  const group = new THREE.Group();
  group.matrixAutoUpdate = true;
  return group;
}

export class PortableMonitorScene {
  constructor() {
    this.container = null;
    this.frameHandle = 0;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    this.renderer.domElement.className = 'three-stage__canvas-surface';
    this.renderer.domElement.style.touchAction = 'none';

    this.settings = {
      autoRotate: true,
      fov: 32,
      lightBoost: 1,
      metalness: 0.82,
      propsVisible: true,
      roughness: 0.32,
      screenExposure: 1,
    };

    this.resources = [];
    this.monitorMaterials = [];
    this.scenePropObjects = [];
    this.screenMaterial = null;

    this.root = createGroup();
    this.monitorGroup = createGroup();
    this.propsGroup = createGroup();
    this.scene.add(this.root);
    this.root.add(this.monitorGroup);
    this.root.add(this.propsGroup);

    this.ambientLight = new THREE.HemisphereLight('#f2f7ff', '#18202c', 1.4);
    this.keyLight = new THREE.DirectionalLight('#ffffff', 1.35);
    this.keyLight.position.set(2.8, 4.8, 4.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.2;
    this.keyLight.shadow.camera.far = 20;
    this.keyLight.shadow.camera.left = -4;
    this.keyLight.shadow.camera.right = 4;
    this.keyLight.shadow.camera.top = 4;
    this.keyLight.shadow.camera.bottom = -4;
    this.rimLight = new THREE.DirectionalLight('#7dd3fc', 0.72);
    this.rimLight.position.set(-3.6, 2.2, -2.8);
    this.fillLight = new THREE.PointLight('#ffd9a3', 0.55, 14, 2);
    this.fillLight.position.set(-2.4, 1.8, 3.2);
    this.scene.add(this.ambientLight, this.keyLight, this.rimLight, this.fillLight);

    this.cameraTarget = new THREE.Vector3(0, 0.02, 0.12);
    this.defaultOrbit = { theta: 0, phi: 0, radius: 0 };
    this.orbit = {
      theta: 0,
      phi: 0,
      radius: 0,
      currentTheta: 0,
      currentPhi: 0,
      currentRadius: 0,
      minRadius: 2.4,
      maxRadius: 6.8,
      dragging: false,
      pointerX: 0,
      pointerY: 0,
    };

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.animate = this.animate.bind(this);
    this.bindInteraction();
    this.frameHandle = requestAnimationFrame(this.animate);
  }

  mount(container) {
    if (this.container === container) {
      this.resize();
      return;
    }

    if (this.container) {
      this.resizeObserver.unobserve(this.container);
    }

    this.container = container;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  bindInteraction() {
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  unbindInteraction() {
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
  }

  handlePointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;
    this.orbit.dragging = true;
    this.orbit.mode = event.button === 2 ? 'pan' : 'orbit';
    this.orbit.pointerX = event.clientX;
    this.orbit.pointerY = event.clientY;
    this.renderer.domElement.classList.add('is-dragging');
  }

  handleContextMenu(event) {
    event.preventDefault();
  }

  handlePointerMove(event) {
    if (!this.orbit.dragging) return;
    const deltaX = event.clientX - this.orbit.pointerX;
    const deltaY = event.clientY - this.orbit.pointerY;
    this.orbit.pointerX = event.clientX;
    this.orbit.pointerY = event.clientY;

    if (this.orbit.mode === 'pan') {
      const panScale = this.orbit.currentRadius * 0.0009;
      const forward = TEMP_TARGET.copy(this.camera.position).sub(this.cameraTarget).normalize();
      const right = TEMP_VECTOR.crossVectors(this.camera.up, forward).normalize();
      const up = TEMP_VECTOR.clone().crossVectors(forward, right).normalize();
      this.cameraTarget.addScaledVector(right, -deltaX * panScale);
      this.cameraTarget.addScaledVector(up, deltaY * panScale);
      return;
    }

    this.orbit.theta -= deltaX * 0.008;
    this.orbit.phi = THREE.MathUtils.clamp(this.orbit.phi - deltaY * 0.008, 0.42, Math.PI - 0.42);
  }

  handlePointerUp() {
    this.orbit.dragging = false;
    this.orbit.mode = '';
    this.renderer.domElement.classList.remove('is-dragging');
  }

  handleWheel(event) {
    event.preventDefault();
    const zoomFactor = 1 + event.deltaY * 0.0012;
    this.orbit.radius = THREE.MathUtils.clamp(this.orbit.radius * zoomFactor, this.orbit.minRadius, this.orbit.maxRadius);
  }

  resetView() {
    this.orbit.theta = this.defaultOrbit.theta;
    this.orbit.phi = this.defaultOrbit.phi;
    this.orbit.radius = this.defaultOrbit.radius;
  }

  exportPng(filename = 'scene.png') {
    this.renderer.render(this.scene, this.camera);
    const link = document.createElement('a');
    link.href = this.renderer.domElement.toDataURL('image/png');
    link.download = filename;
    link.click();
  }

  captureStream(fps = 30) {
    if (typeof this.renderer?.domElement?.captureStream !== 'function') {
      return null;
    }
    return this.renderer.domElement.captureStream(fps);
  }

  setSettings(partial = {}) {
    this.settings = { ...this.settings, ...partial };
    this.applySettings();
  }

  render(product, scene) {
    this.currentProduct = product;
    this.currentScene = scene;
    this.sceneStartTime = this.clock.getElapsedTime();
    this.monitorMaterials = [];
    this.scenePropObjects = [];
    this.screenMaterial = null;
    this.screenTextureState = null;
    this.disposeSceneResources();
    this.monitorGroup.clear();
    this.propsGroup.clear();
    this.buildEnvironment(product, scene);
    this.buildMonitor(product, scene);
    this.buildProps(product, scene);
    this.positionCamera(product, scene);
    this.applySettings(true);
  }

  applySettings(immediate = false) {
    if (this.baseLight) {
      this.ambientLight.intensity = this.baseLight.ambient * this.settings.lightBoost;
      this.keyLight.intensity = this.baseLight.key * this.settings.lightBoost;
      this.rimLight.intensity = this.baseLight.rim * this.settings.lightBoost;
      this.fillLight.intensity = this.baseLight.fill * this.settings.lightBoost;
    }

    this.monitorMaterials.forEach((material) => {
      if ('metalness' in material) material.metalness = this.settings.metalness;
      if ('roughness' in material) material.roughness = this.settings.roughness;
      material.needsUpdate = true;
    });

    if (this.screenMaterial) {
      this.screenMaterial.color.setScalar(this.settings.screenExposure);
    }

    this.scenePropObjects.forEach((object) => {
      object.visible = this.settings.propsVisible;
    });

    if (Math.abs(this.camera.fov - this.settings.fov) > 0.001) {
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
    }

    if (immediate) this.updateCameraPose(true);
  }

  addSceneProp(object) {
    this.scenePropObjects.push(object);
    this.propsGroup.add(object);
    return object;
  }

  buildEnvironment(product, scene) {
    const accent = new THREE.Color(scene.appearance.accent || '#7dd3fc');
    this.scene.fog = new THREE.FogExp2(accent.clone().multiplyScalar(0.12), 0.065);
    this.rimLight.color.copy(accent);
    this.fillLight.color.set(product.sizeInch <= 7 ? '#86efac' : '#ffd9a3');
    this.baseLight = {
      ambient: scene.id === 'ports-connectivity' ? 1.18 : 1.4,
      fill: scene.id === 'touch-lamination' ? 0.72 : 0.55,
      key: scene.id === 'hero-main' ? 1.42 : 1.35,
      rim: scene.id === 'gaming-144hz' || scene.id === 'gaming-compact' ? 0.94 : 0.72,
    };
    this.ambientLight.intensity = this.baseLight.ambient;
    this.keyLight.intensity = this.baseLight.key;
    this.rimLight.intensity = this.baseLight.rim;
    this.fillLight.intensity = this.baseLight.fill;

    const floor = setShadow(
      new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(14, 14)),
        this.track(new THREE.MeshStandardMaterial({ color: 0xe6ded1, roughness: 0.92, metalness: 0.02, transparent: true, opacity: 0.72 })),
      ),
      false,
      true,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.18, 0.4);
    this.propsGroup.add(floor);

    const backplane = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(18, 11)),
      this.track(new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(0.2), transparent: true, opacity: 0.12 })),
    );
    backplane.position.set(0, 1.1, -3.4);
    this.propsGroup.add(backplane);
  }

  buildMonitor(product, scene) {
    const metrics = buildMetrics(product);
    const body = setShadow(
      new THREE.Mesh(
        this.track(new THREE.BoxGeometry(metrics.width, metrics.height, metrics.depth)),
        this.track(createStandardMaterial('#20262f', { roughness: 0.32, metalness: 0.82 })),
      ),
    );
    body.position.y = 0.12;
    this.monitorMaterials.push(body.material);
    this.monitorGroup.add(body);

    this.screenTextureState = createScreenTextureState(scene, product);
    const screen = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(metrics.screenWidth, metrics.screenHeight)),
      this.track(new THREE.MeshBasicMaterial({ map: this.track(this.screenTextureState.texture) })),
    );
    screen.position.set(0, 0.16, metrics.depth / 2 + 0.002);
    this.screenMaterial = screen.material;
    this.monitorGroup.add(screen);

    const glass = setShadow(
      new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(metrics.screenWidth * 1.01, metrics.screenHeight * 1.01)),
        this.track(new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.08, transparent: true, opacity: 0.12, roughness: 0.18, metalness: 0, clearcoat: 1 })),
      ),
      false,
      false,
    );
    glass.position.set(0, 0.16, metrics.depth / 2 + 0.006);
    this.monitorGroup.add(glass);

    const logoTexture = this.track(drawLabelTexture(product.branding?.brandName || 'LuminaDisplay', 640, 140, { fontSize: product.sizeInch <= 7 ? 40 : 54 }));
    const logoPlane = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(metrics.width * 0.26, metrics.height * 0.05)),
      this.track(new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true })),
    );
    logoPlane.position.set(0, -metrics.height * 0.42, metrics.depth / 2 + 0.004);
    this.monitorGroup.add(logoPlane);

    const rearBrandTexture = this.track(drawLabelTexture(product.branding?.brandName || 'LuminaDisplay', 520, 120, { fontSize: product.sizeInch <= 7 ? 34 : 44, color: 'rgba(255,255,255,0.72)' }));
    const rearBrand = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(metrics.width * 0.24, metrics.height * 0.045)),
      this.track(new THREE.MeshBasicMaterial({ map: rearBrandTexture, transparent: true })),
    );
    rearBrand.rotation.y = Math.PI;
    rearBrand.position.set(-metrics.width * 0.24, metrics.height * 0.38, -metrics.depth / 2 - 0.004);
    this.monitorGroup.add(rearBrand);

    const rearPlate = setShadow(
      new THREE.Mesh(
        this.track(new THREE.BoxGeometry(metrics.width * 0.22, metrics.height * 0.18, metrics.depth * 0.3)),
        this.track(createStandardMaterial('#2c3440', { roughness: 0.4 })),
      ),
    );
    rearPlate.position.set(0, 0.04, -metrics.depth / 2 - metrics.depth * 0.04);
    this.monitorMaterials.push(rearPlate.material);
    this.monitorGroup.add(rearPlate);

    for (const hole of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) {
      const cap = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(metrics.depth * 0.14, metrics.depth * 0.14, metrics.depth * 0.12, 22)),
        this.track(new THREE.MeshStandardMaterial({ color: '#d7e0ea', roughness: 0.5, metalness: 0.38 })),
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.set(hole[0] * metrics.width, hole[1] * metrics.height, -metrics.depth / 2 - metrics.depth * 0.12);
      this.monitorMaterials.push(cap.material);
      this.monitorGroup.add(cap);
    }

    this.buildPorts(metrics, scene);
    this.buildStand(metrics, product);
    this.applySceneOrientation(scene, product, metrics);
  }

  buildPorts(metrics, scene) {
    const ports = [
      { y: 0.16, width: metrics.depth * 0.42 },
      { y: 0.04, width: metrics.depth * 0.32 },
      { y: -0.08, width: metrics.depth * 0.32 },
      { y: -0.2, width: metrics.depth * 0.18 },
    ];

    ports.forEach((port, index) => {
      const mesh = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(metrics.depth * 0.14, metrics.height * 0.03, port.width)),
        this.track(new THREE.MeshStandardMaterial({ color: index === 0 ? '#0b1118' : '#111827', roughness: 0.72, metalness: 0.05 })),
      );
      mesh.position.set(metrics.width / 2 + metrics.depth * 0.045, port.y * metrics.height, 0.14 - index * metrics.depth * 0.4);
      this.monitorMaterials.push(mesh.material);
      this.monitorGroup.add(mesh);
    });

    if (scene.id === 'ports-connectivity') {
      const edgeHighlight = setShadow(
        new THREE.Mesh(
          this.track(new THREE.BoxGeometry(metrics.width * 0.02, metrics.height * 0.46, metrics.depth * 0.9)),
          this.track(new THREE.MeshStandardMaterial({ color: '#67e8f9', emissive: '#67e8f9', emissiveIntensity: 0.18, transparent: true, opacity: 0.22 })),
        ),
        false,
        false,
      );
      edgeHighlight.position.set(metrics.width / 2 + metrics.depth * 0.08, 0.02, 0);
      this.monitorMaterials.push(edgeHighlight.material);
      this.monitorGroup.add(edgeHighlight);
    }
  }

  buildStand(metrics, product) {
    const arm = setShadow(
      new THREE.Mesh(
        this.track(new THREE.BoxGeometry(metrics.width * 0.14, metrics.standHeight, metrics.depth * 1.3)),
        this.track(createStandardMaterial('#323b47', { roughness: 0.38 })),
      ),
    );
    arm.position.set(0, -metrics.height * 0.44, -metrics.depth * 0.5);
    arm.rotation.x = THREE.MathUtils.degToRad(24);
    this.monitorMaterials.push(arm.material);
    this.monitorGroup.add(arm);

    const foot = setShadow(
      new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(metrics.depth * 0.24, metrics.depth * 0.3, metrics.footWidth, 28)),
        this.track(createStandardMaterial('#3a4450', { roughness: 0.42 })),
      ),
    );
    foot.rotation.z = Math.PI / 2;
    foot.position.set(0, -metrics.height * 0.76, metrics.depth * 0.1);
    this.monitorMaterials.push(foot.material);
    this.monitorGroup.add(foot);

    if (product.sizeInch <= 7) {
      foot.scale.set(0.85, 0.85, 0.85);
      arm.scale.set(0.84, 0.82, 0.84);
    }
  }

  applySceneOrientation(scene, product, metrics) {
    const rotationY = THREE.MathUtils.degToRad(scene.camera?.rotateY || -22);
    const rotationX = THREE.MathUtils.degToRad(scene.camera?.rotateX || 10);
    const rotationZ = THREE.MathUtils.degToRad(scene.camera?.rotateZ || 0);
    const scale = scene.camera?.scale || 1;
    const hasDeskSurface = ['office-productivity', 'travel-portable', 'gaming-144hz', 'embedded-control'].includes(scene.id);
    const supportSurfaceY = hasDeskSurface ? (-1.08 + 0.09) : -1.18;
    const footRadius = metrics.depth * 0.24;
    const currentFootCenterY = -metrics.height * 0.76;
    const groundingOffsetY = supportSurfaceY + footRadius - currentFootCenterY;
    const baseOffsetY = (product.sizeInch <= 7 ? -0.06 : 0) + groundingOffsetY;

    this.monitorGroup.rotation.set(rotationX, rotationY, rotationZ);
    this.monitorGroup.scale.setScalar(scale * (product.sizeInch <= 7 ? 1.02 : 1));
    this.monitorGroup.position.set(0, baseOffsetY, 0);

    if (scene.id === 'vesa-speakers') {
      this.monitorGroup.rotation.y = Math.PI + THREE.MathUtils.degToRad(-28);
    }

    if (scene.id === 'ports-connectivity') {
      this.monitorGroup.rotation.y = -Math.PI / 2.6;
      this.monitorGroup.rotation.x = THREE.MathUtils.degToRad(8);
      this.monitorGroup.position.x = -0.18;
    }

    if (scene.id === 'touch-lamination') {
      this.monitorGroup.rotation.y = THREE.MathUtils.degToRad(-10);
    }

    this.monitorBaseOffsetY = baseOffsetY;
    this.monitorSpinBase = this.monitorGroup.rotation.y;
    this.monitorFloatAmount = product.sizeInch <= 7 ? 0.028 : 0.04;
  }

  buildProps(product, scene) {
    const deskNeeded = ['office-productivity', 'travel-portable', 'gaming-144hz', 'embedded-control'].includes(scene.id);
    if (deskNeeded) {
      const desk = setShadow(
        new THREE.Mesh(
          this.track(new THREE.BoxGeometry(6.8, 0.18, 3.4)),
          this.track(new THREE.MeshStandardMaterial({ color: scene.id === 'gaming-144hz' ? '#31261f' : '#7d5230', roughness: 0.82, metalness: 0.04 })),
        ),
        false,
        true,
      );
      desk.position.set(0.1, -1.08, 0.54);
      this.addSceneProp(desk);
    }

    switch (scene.id) {
      case 'office-productivity':
        this.addSceneProp(this.createLaptop(new THREE.Vector3(-1.9, -0.68, 0.9), 1.05));
        this.addSceneProp(this.createKeyboard(new THREE.Vector3(-1.65, -1.0, 1.25), 0.9));
        this.addSceneProp(this.createMouse(new THREE.Vector3(-0.7, -0.98, 1.18), 0.9));
        break;
      case 'gaming-144hz':
      case 'gaming-compact':
        this.addSceneProp(this.createConsole(new THREE.Vector3(scene.id === 'gaming-compact' ? 1.3 : 1.7, -0.88, 1.22), scene.id === 'gaming-compact' ? 0.9 : 1.04));
        break;
      case 'travel-portable':
        this.addSceneProp(this.createBackpack(new THREE.Vector3(-1.9, -0.72, 1.08), 0.92));
        this.addSceneProp(this.createPhone(new THREE.Vector3(-0.82, -0.98, 1.22), 0.82));
        this.addSceneProp(this.createPassport(new THREE.Vector3(-1.26, -0.98, 1.18), 0.84));
        this.addSceneProp(this.createCableCurve(new THREE.Vector3(-0.1, -0.9, 1.0), new THREE.Vector3(1.0, -0.82, 0.86)));
        break;
      case 'embedded-control':
        this.addSceneProp(this.createDevBoard(new THREE.Vector3(-1.55, -0.88, 1.02), 1));
        this.addSceneProp(this.createCableCurve(new THREE.Vector3(-1.0, -0.82, 0.84), new THREE.Vector3(-0.28, -0.36, 0.4)));
        break;
      case 'touch-lamination':
        this.addSceneProp(this.createFinger(new THREE.Vector3(0.95, 0.1, 0.96), 0.92));
        break;
      default:
        break;
    }
  }

  createLaptop(position, scale) {
    const group = createGroup();
    const base = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(1.3, 0.08, 0.92)), this.track(createStandardMaterial('#c8d0db', { roughness: 0.58, metalness: 0.24 }))));
    const screen = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(1.24, 0.78, 0.06)), this.track(new THREE.MeshStandardMaterial({ color: '#9db7d3', roughness: 0.28, metalness: 0.12 }))));
    group.add(base, screen);
    screen.position.set(0, 0.42, -0.32);
    screen.rotation.x = THREE.MathUtils.degToRad(-108);
    group.position.copy(position);
    group.rotation.y = THREE.MathUtils.degToRad(14);
    group.scale.setScalar(scale);
    return group;
  }

  createKeyboard(position, scale) {
    const mesh = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(0.94, 0.04, 0.28)), this.track(new THREE.MeshStandardMaterial({ color: '#d6dbe2', roughness: 0.72, metalness: 0.08 }))));
    mesh.position.copy(position);
    mesh.rotation.y = THREE.MathUtils.degToRad(-10);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  createMouse(position, scale) {
    const mesh = setShadow(new THREE.Mesh(this.track(new THREE.SphereGeometry(0.12, 28, 20)), this.track(new THREE.MeshStandardMaterial({ color: '#d6dbe2', roughness: 0.62, metalness: 0.06 }))));
    mesh.position.copy(position);
    mesh.scale.set(scale * 0.76, scale, scale * 1.16);
    return mesh;
  }

  createConsole(position, scale) {
    const group = createGroup();
    const body = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(0.82, 0.22, 0.34)), this.track(new THREE.MeshStandardMaterial({ color: '#10243f', roughness: 0.3, metalness: 0.12 }))));
    const leftGrip = setShadow(new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.1, 0.24, 6, 12)), this.track(new THREE.MeshStandardMaterial({ color: '#cfd6df', roughness: 0.52 }))));
    leftGrip.rotation.z = Math.PI / 2;
    leftGrip.position.x = -0.52;
    const rightGrip = leftGrip.clone();
    rightGrip.position.x = 0.52;
    group.add(body, leftGrip, rightGrip);
    group.position.copy(position);
    group.rotation.y = THREE.MathUtils.degToRad(-22);
    group.scale.setScalar(scale);
    return group;
  }

  createBackpack(position, scale) {
    const mesh = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(0.68, 0.9, 0.34)), this.track(new THREE.MeshStandardMaterial({ color: '#775236', roughness: 0.86, metalness: 0.02 }))));
    mesh.position.copy(position);
    mesh.rotation.y = THREE.MathUtils.degToRad(18);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  createPhone(position, scale) {
    const mesh = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(0.22, 0.4, 0.05)), this.track(new THREE.MeshStandardMaterial({ color: '#18202a', roughness: 0.34, metalness: 0.18 }))));
    mesh.position.copy(position);
    mesh.rotation.z = THREE.MathUtils.degToRad(-12);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  createPassport(position, scale) {
    const mesh = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(0.28, 0.38, 0.04)), this.track(new THREE.MeshStandardMaterial({ color: '#7b2f22', roughness: 0.82, metalness: 0.04 }))));
    mesh.position.copy(position);
    mesh.rotation.z = THREE.MathUtils.degToRad(-18);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  createDevBoard(position, scale) {
    const group = createGroup();
    const board = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(0.7, 0.04, 0.46)), this.track(new THREE.MeshStandardMaterial({ color: '#2f7a4e', roughness: 0.74, metalness: 0.08 }))));
    group.add(board);
    for (const chip of [{ x: -0.18, z: -0.06, w: 0.18, d: 0.16 }, { x: 0.06, z: -0.04, w: 0.13, d: 0.12 }, { x: 0.22, z: 0.08, w: 0.12, d: 0.24 }]) {
      const mesh = setShadow(new THREE.Mesh(this.track(new THREE.BoxGeometry(chip.w, 0.06, chip.d)), this.track(new THREE.MeshStandardMaterial({ color: '#dce7de', roughness: 0.52, metalness: 0.08 }))));
      mesh.position.set(chip.x, 0.04, chip.z);
      group.add(mesh);
    }
    group.position.copy(position);
    group.rotation.y = THREE.MathUtils.degToRad(12);
    group.scale.setScalar(scale);
    return group;
  }

  createFinger(position, scale) {
    const finger = setShadow(new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.12, 0.58, 8, 16)), this.track(new THREE.MeshStandardMaterial({ color: '#d3a181', roughness: 0.9, metalness: 0 }))));
    finger.position.copy(position);
    finger.rotation.z = THREE.MathUtils.degToRad(22);
    finger.rotation.x = THREE.MathUtils.degToRad(-20);
    finger.scale.setScalar(scale);
    return finger;
  }

  createCableCurve(from, to) {
    const curve = new THREE.CatmullRomCurve3([
      from.clone(),
      from.clone().lerp(to, 0.35).add(new THREE.Vector3(0.2, 0.12, -0.1)),
      from.clone().lerp(to, 0.72).add(new THREE.Vector3(-0.12, 0.18, 0.08)),
      to.clone(),
    ]);
    return setShadow(
      new THREE.Mesh(
        this.track(new THREE.TubeGeometry(curve, 40, 0.014, 10, false)),
        this.track(new THREE.MeshStandardMaterial({ color: '#f2f4f8', roughness: 0.52, metalness: 0.14 })),
      ),
      false,
      true,
    );
  }

  positionCamera(product, scene) {
    const distance = product.sizeInch >= 15 ? 4.2 : 3.2;
    this.camera.position.set(scene.id === 'ports-connectivity' ? 2.2 : 0.22, product.sizeInch <= 7 ? 0.58 : 0.76, distance);
    if (scene.id === 'vesa-speakers') this.camera.position.set(0.18, 0.72, product.sizeInch <= 7 ? 3.05 : 4.0);
    if (scene.id === 'touch-lamination') this.camera.position.set(0.34, 0.52, 2.8);
    if (scene.id === 'embedded-control') this.camera.position.set(0.08, 0.6, 3.25);

    this.cameraTarget.set(0, 0.02, 0.12);
    if (scene.id === 'ports-connectivity') this.cameraTarget.set(0.18, 0.03, 0.02);
    if (scene.id === 'vesa-speakers') this.cameraTarget.set(0, 0.04, -0.02);
    if (scene.id === 'touch-lamination') this.cameraTarget.set(0.14, 0.1, 0.24);

    TEMP_SPHERICAL.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));
    this.orbit.theta = TEMP_SPHERICAL.theta;
    this.orbit.phi = TEMP_SPHERICAL.phi;
    this.orbit.radius = TEMP_SPHERICAL.radius;
    this.orbit.currentTheta = TEMP_SPHERICAL.theta;
    this.orbit.currentPhi = TEMP_SPHERICAL.phi;
    this.orbit.currentRadius = TEMP_SPHERICAL.radius;
    this.orbit.minRadius = product.sizeInch <= 7 ? 2.1 : 3.2;
    this.orbit.maxRadius = product.sizeInch <= 7 ? 5.0 : 6.8;
    this.defaultOrbit = { theta: this.orbit.theta, phi: this.orbit.phi, radius: this.orbit.radius };
    this.updateCameraPose(true);
  }

  updateCameraPose(immediate = false) {
    const lerp = immediate ? 1 : 0.12;
    this.orbit.currentTheta = THREE.MathUtils.lerp(this.orbit.currentTheta, this.orbit.theta, lerp);
    this.orbit.currentPhi = THREE.MathUtils.lerp(this.orbit.currentPhi, this.orbit.phi, lerp);
    this.orbit.currentRadius = THREE.MathUtils.lerp(this.orbit.currentRadius, this.orbit.radius, lerp);
    TEMP_SPHERICAL.set(this.orbit.currentRadius, this.orbit.currentPhi, this.orbit.currentTheta);
    TEMP_VECTOR.setFromSpherical(TEMP_SPHERICAL).add(this.cameraTarget);
    this.camera.position.copy(TEMP_VECTOR);
    this.camera.lookAt(this.cameraTarget);
  }

  animate() {
    this.frameHandle = requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();

    if (this.monitorGroup) {
      this.monitorGroup.position.y = (this.monitorBaseOffsetY || 0) + Math.sin(elapsed * 0.9) * this.monitorFloatAmount;
      if (this.settings.autoRotate && this.currentScene?.id !== 'ports-connectivity') {
        this.monitorGroup.rotation.y = this.monitorSpinBase + Math.sin(elapsed * 0.42) * 0.045;
      } else {
        this.monitorGroup.rotation.y = this.monitorSpinBase;
      }
    }

    if (this.screenTextureState && this.currentScene && this.currentProduct) {
      redrawScreenTexture(this.screenTextureState, this.currentScene, this.currentProduct, elapsed - this.sceneStartTime);
    }

    if (this.container) {
      this.resize();
      this.updateCameraPose();
      this.renderer.render(this.scene, this.camera);
    }
  }

  resize() {
    if (!this.container) return;
    const { clientWidth, clientHeight } = this.container;
    if (!clientWidth || !clientHeight) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    const targetWidth = Math.floor(clientWidth * pixelRatio);
    const targetHeight = Math.floor(clientHeight * pixelRatio);

    if (this.renderer.domElement.width !== targetWidth || this.renderer.domElement.height !== targetHeight) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(clientWidth, clientHeight, false);
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
    }
  }

  track(resource) {
    this.resources.push(resource);
    return resource;
  }

  disposeSceneResources() {
    while (this.resources.length) {
      const resource = this.resources.pop();
      if (resource && typeof resource.dispose === 'function') {
        resource.dispose();
      }
    }
  }

  dispose() {
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.unbindInteraction();
    this.disposeSceneResources();
    this.renderer.dispose();
  }
}

















