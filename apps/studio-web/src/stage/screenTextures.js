import * as THREE from 'three';

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

function truncateLabel(value, maxChars = 32) {
  const text = String(value || '').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
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

function buildSceneHudContent(scene, product) {
  const refreshOrTouch = product.screen.touch ? 'Touch Enabled' : product.screen.refreshRate;
  const sceneHighlights = [
    ...(scene.callouts || []),
    ...(Array.isArray(scene.override?.copyHighlights) ? scene.override.copyHighlights : []),
  ].filter(Boolean);

  const base = {
    footer: `${product.branding?.brandName || 'LuminaDisplay'} - ${buildSceneFooterLabel(scene)}`,
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
        details: sceneHighlights.length
          ? sceneHighlights
          : [`${product.screen.resolution} workspace`, `${product.screen.aspectRatio} canvas`, 'Productivity-ready scene'],
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
      fillRoundedRect(
        ctx,
        panelX + 20,
        78 + index * 34,
        346,
        26,
        12,
        index % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
      );
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

function drawHeroGlow(ctx, canvas) {
  const glow = ctx.createRadialGradient(
    canvas.width * 0.68,
    canvas.height * 0.42,
    30,
    canvas.width * 0.68,
    canvas.height * 0.42,
    canvas.width * 0.44,
  );
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
  for (let index = 0; index < 10; index += 1) {
    fillRoundedRect(ctx, 86, 136 + index * 52, 500 - index * 22, 14, 8, index % 3 === 0 ? '#7dd3fc' : '#c4b5fd');
  }
  for (let index = 0; index < 4; index += 1) {
    fillRoundedRect(ctx, 798, 126 + index * 44, 360 - index * 34, 18, 9, '#9ee7cf');
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

export function redrawScreenTexture(state, scene, product, elapsed = 99) {
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  drawScreenBase(state.ctx, state.canvas, scene, product);
  drawScreenHud(state.ctx, state.canvas, product, scene, elapsed);
  state.texture.needsUpdate = true;
}

export function createScreenTextureState(scene, product) {
  const canvas = createCanvas(1280, 800);
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const state = { canvas, ctx, texture };
  redrawScreenTexture(state, scene, product, 99);
  return state;
}

export function createLabelTexture(label, width = 512, height = 128, options = {}) {
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

export function buildMetrics(product) {
  const referenceWidth = product.sizeInch >= 15 ? 2.6 : 2.1;
  const scale = referenceWidth / Math.max(product.physical.widthMm || 300, 200);
  const width = (product.physical.widthMm || 300) * scale;
  const height = (product.physical.heightMm || 190) * scale;
  const depth = Math.max((product.physical.thicknessMm || 12) * scale, 0.06);

  return {
    depth,
    footWidth: product.sizeInch >= 15 ? width * 0.38 : width * 0.34,
    height,
    scale,
    screenHeight: height * 0.82,
    screenWidth: width * 0.88,
    standHeight: product.sizeInch >= 15 ? height * 0.36 : height * 0.26,
    width,
  };
}
