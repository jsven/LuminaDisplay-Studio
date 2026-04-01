import React, { useEffect, useRef, useState, useTransition } from 'react';
import { PortableMonitorStage } from './stage/PortableMonitorStage.jsx';
import { getSceneLayout } from './stage/scene-layout.config.js';

const DEFAULT_RENDER_SETTINGS = {
  autoRotate: true,
  companionDevice: 'auto',
  fov: 28,
  lightBoost: 1,
  metalness: 0.82,
  propsVisible: true,
  roughness: 0.32,
  screenExposure: 1,
};

const overrideLabels = {
  branding: 'Branding',
  cameraDistance: 'Camera distance',
  copyHighlights: 'Copy highlights',
  pairedDevice: 'Paired device',
  propsLayout: 'Props layout',
  screenContent: 'Screen content',
  screenUiScale: 'Screen UI scale',
};

function getPackById(manifest, packId) {
  if (!manifest || !packId) return null;
  return manifest.packs.find((pack) => pack.id === packId) || null;
}

function getPreviewSegmentIndex(segments, time) {
  for (let index = 0; index < segments.length; index += 1) {
    if (time >= segments[index].start && time < segments[index].end) {
      return segments[index].index;
    }
  }
  return segments.at(-1)?.index ?? 0;
}

function buildPreviewSegments(payload) {
  const fallbackDuration = 30;
  const storyboards = payload?.videoStoryboard || [];
  const scenes = payload?.scenes || [];
  const segments = [];

  for (let index = 0; index < scenes.length; index += 1) {
    const rawLine = storyboards[index] || '';
    const matched = rawLine.match(/^(\d+)-(\d+)s:\s*(.+)$/i);
    const start = matched ? Number(matched[1]) : Math.round((fallbackDuration / scenes.length) * index);
    const end = matched ? Number(matched[2]) : Math.round((fallbackDuration / scenes.length) * (index + 1));
    const label = matched ? matched[3] : scenes[index].headline;
    segments.push({ end, index, label, start });
  }

  return segments;
}

function formatTimestamp(value) {
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(' / ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, inner]) => `${key}=${inner}`)
      .join(', ');
  }
  return String(value);
}

function buildOverrideEntries(override) {
  if (!override) return ['This scene is defined directly in the generated scene pack.'];

  const entries = Object.entries(override)
    .filter(([key]) => key !== 'presetId' && key !== 'productId')
    .map(([key, value]) => `${overrideLabels[key] || key}: ${formatValue(value)}`);

  return [`Preset ID: ${override.presetId}`, ...entries];
}

function getSceneStatus(scene) {
  if (!scene) return 'Ready';
  return scene.override ? `Preset: ${scene.override.presetId}` : 'Direct scene spec';
}

function pickSupportedVideoMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

function waitForCondition(predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();

    function check() {
      if (predicate()) {
        resolve();
        return;
      }

      if (performance.now() - startedAt >= timeoutMs) {
        reject(new Error('Timed out waiting for preview state to settle.'));
        return;
      }

      window.requestAnimationFrame(check);
    }

    check();
  });
}

export default function App() {
  const stageRef = useRef(null);
  const stagePanelRef = useRef(null);
  const previewFrameRef = useRef(0);
  const previewCompletionRef = useRef(null);
  const statusTimerRef = useRef(0);
  const manifestRef = useRef(null);
  const dataRef = useRef(null);
  const packIdRef = useRef('');
  const previewRef = useRef({
    currentTime: 0,
    duration: 30,
    exporting: false,
    playing: false,
    segments: [],
  });
  const sceneIndexRef = useRef(0);

  const [manifest, setManifest] = useState(null);
  const [data, setData] = useState(null);
  const [packId, setPackId] = useState('');
  const [sceneIndex, setSceneIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [renderSettings, setRenderSettings] = useState(DEFAULT_RENDER_SETTINGS);
  const [preview, setPreview] = useState(previewRef.current);
  const [, startUiTransition] = useTransition();

  const currentPack = getPackById(manifest, packId);
  const currentScene = data?.scenes?.[sceneIndex] || null;

  useEffect(() => {
    manifestRef.current = manifest;
  }, [manifest]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    packIdRef.current = packId;
  }, [packId]);

  useEffect(() => {
    sceneIndexRef.current = sceneIndex;
  }, [sceneIndex]);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReduceMotion = (event) => {
      setReduceMotion(event.matches);
    };

    setReduceMotion(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', updateReduceMotion);
    mediaQuery.addListener?.(updateReduceMotion);

    return () => {
      mediaQuery.removeEventListener?.('change', updateReduceMotion);
      mediaQuery.removeListener?.(updateReduceMotion);
    };
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const response = await fetch('/generated/manifest.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load manifest: ${response.status}`);
        }

        const nextManifest = await response.json();
        setManifest(nextManifest);

        const requestedPackId = new URLSearchParams(window.location.search).get('product');
        const initialPack =
          getPackById(nextManifest, requestedPackId) ||
          getPackById(nextManifest, nextManifest.defaultPackId) ||
          nextManifest.packs[0];

        await loadPack(initialPack.id, nextManifest);
      } catch (loadError) {
        setError(loadError.message);
        setLoading(false);
      }
    }

    boot();

    return () => {
      if (previewFrameRef.current) {
        window.cancelAnimationFrame(previewFrameRef.current);
      }
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentScene) return;

    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = 0;
    }

    setStatusMessage(getSceneStatus(currentScene));
  }, [currentScene]);

  useEffect(() => {
    if (!currentScene) return;
    const layout = getSceneLayout(currentScene.id);
    const nextFov = layout.camera?.fov ?? DEFAULT_RENDER_SETTINGS.fov;

    setRenderSettings((currentSettings) => {
      if (currentSettings.fov === nextFov) return currentSettings;
      return {
        ...currentSettings,
        fov: nextFov,
      };
    });
  }, [currentScene?.id]);

  useEffect(() => {
    if (!data || !currentScene || !packId) return;

    const query = new URLSearchParams(window.location.search);
    query.set('product', packId);
    window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}#${currentScene.id}`);
    document.title = data.summary?.title || 'LuminaDisplay Portable Monitor Scene Preview';
  }, [currentScene, data, packId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!dataRef.current) return;

      if (event.key === 'ArrowLeft') {
        selectScene(sceneIndexRef.current - 1, { syncPreview: true });
      }

      if (event.key === 'ArrowRight') {
        selectScene(sceneIndexRef.current + 1, { syncPreview: true });
      }

      if (event.key.toLowerCase() === 'r') {
        resetCurrentView();
      }

      if (event.code === 'Space') {
        event.preventDefault();
        togglePreviewPlayback();
      }
    }

    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === stagePanelRef.current);
    }

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    window.__studioPreview = {
      exportPreviewVideo,
      getPreferredVideoExtension() {
        const mimeType = pickSupportedVideoMimeType();
        return mimeType.includes('mp4') ? 'mp4' : 'webm';
      },
      getState() {
        return {
          currentSceneId: dataRef.current?.scenes?.[sceneIndexRef.current]?.id || '',
          duration: previewRef.current.duration,
          packId: packIdRef.current,
          ready: Boolean(dataRef.current && stageRef.current?.isReady?.()),
        };
      },
      isReady() {
        return Boolean(dataRef.current && stageRef.current?.isReady?.());
      },
      jumpToScene(index) {
        selectScene(index, { syncPreview: true });
      },
      loadPack(nextPackId) {
        return loadPack(nextPackId);
      },
      stopPreviewPlayback,
      togglePreviewPlayback,
    };

    window.dispatchEvent(new Event('studio-api-ready'));

    return () => {
      delete window.__studioPreview;
    };
  });

  async function loadPack(nextPackId, sourceManifest = manifestRef.current) {
    const nextManifest = sourceManifest || manifestRef.current;
    const pack = getPackById(nextManifest, nextPackId);

    if (!pack) {
      throw new Error(`Unknown pack: ${nextPackId}`);
    }

    stopPreviewPlayback();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/generated/${pack.file}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load scene data: ${response.status}`);
      }

      const payload = await response.json();
      const hashSceneId = window.location.hash.replace(/^#/, '');
      const foundIndex = payload.scenes.findIndex((scene) => scene.id === hashSceneId);
      const resolvedSceneIndex = foundIndex >= 0 ? foundIndex : 0;
      const segments = buildPreviewSegments(payload);
      const duration = Math.max(segments.at(-1)?.end || 30, 1);

      startUiTransition(() => {
        setManifest(nextManifest);
        setData(payload);
        setPackId(pack.id);
        setSceneIndex(resolvedSceneIndex);
        setPreview({
          currentTime: segments[resolvedSceneIndex]?.start || 0,
          duration,
          exporting: false,
          playing: false,
          segments,
        });
      });

      await waitForCondition(
        () =>
          dataRef.current?.product?.id === payload.product.id &&
          sceneIndexRef.current === resolvedSceneIndex &&
          Boolean(stageRef.current?.isReady?.()),
        6000,
      );
    } catch (loadError) {
      setError(loadError.message);
      throw loadError;
    } finally {
      setLoading(false);
    }
  }

  function setTransientStatus(message) {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }

    setStatusMessage(message);
    statusTimerRef.current = window.setTimeout(() => {
      statusTimerRef.current = 0;
      setStatusMessage(getSceneStatus(dataRef.current?.scenes?.[sceneIndexRef.current]));
    }, 1600);
  }

  function selectScene(nextIndex, options = {}) {
    const payload = dataRef.current;
    if (!payload?.scenes?.length) return;

    const { syncPreview = false } = options;
    const resolvedIndex = (nextIndex + payload.scenes.length) % payload.scenes.length;
    setSceneIndex(resolvedIndex);

    if (syncPreview) {
      const segment = previewRef.current.segments[resolvedIndex];
      if (segment) {
        setPreview((currentPreview) => ({
          ...currentPreview,
          currentTime: segment.start,
        }));
      }
    }
  }

  function stopPreviewPlayback(completed = false) {
    if (previewFrameRef.current) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = 0;
    }

    const onComplete = completed ? previewCompletionRef.current : null;
    previewCompletionRef.current = null;

    setPreview((currentPreview) => ({
      ...currentPreview,
      playing: false,
    }));

    if (onComplete) {
      onComplete();
    }
  }

  function setPreviewTime(nextTime, options = {}) {
    const { stopAtEnd = false } = options;
    const previewState = previewRef.current;
    const duration = Math.max(previewState.duration, 1);
    const clampedTime = Math.min(Math.max(nextTime, 0), duration);
    const nextSceneIndex = getPreviewSegmentIndex(previewState.segments, clampedTime);

    if (nextSceneIndex !== sceneIndexRef.current) {
      setSceneIndex(nextSceneIndex);
    }

    setPreview((currentPreview) => ({
      ...currentPreview,
      currentTime: clampedTime,
    }));

    if (stopAtEnd && clampedTime >= duration) {
      stopPreviewPlayback(true);
    }
  }

  function stepPreviewPlayback(timestamp) {
    if (!previewRef.current.playing) return;

    if (!stepPreviewPlayback.lastFrameAt) {
      stepPreviewPlayback.lastFrameAt = timestamp;
    }

    const delta = Math.min(timestamp - stepPreviewPlayback.lastFrameAt, 120) / 1000;
    stepPreviewPlayback.lastFrameAt = timestamp;
    setPreviewTime(previewRef.current.currentTime + delta, { stopAtEnd: true });

    if (previewRef.current.playing) {
      previewFrameRef.current = window.requestAnimationFrame(stepPreviewPlayback);
    }
  }

  function startPreviewPlayback(options = {}) {
    const { fromStart = false, onComplete = null } = options;
    if (reduceMotion) {
      setTransientStatus('Reduced motion is enabled');
      return;
    }

    if (previewRef.current.playing) return;

    setPreview((currentPreview) => ({
      ...currentPreview,
      currentTime: fromStart || currentPreview.currentTime >= currentPreview.duration ? 0 : currentPreview.currentTime,
      playing: true,
    }));

    previewCompletionRef.current = onComplete;
    stepPreviewPlayback.lastFrameAt = 0;
    previewFrameRef.current = window.requestAnimationFrame(stepPreviewPlayback);
  }

  function togglePreviewPlayback() {
    if (previewRef.current.exporting) return;
    if (previewRef.current.playing) {
      stopPreviewPlayback();
      return;
    }
    startPreviewPlayback();
  }

  function jumpToSegment(index) {
    const segment = previewRef.current.segments[index];
    if (!segment) return;
    setPreviewTime(segment.start);
  }

  async function exportPreviewVideo() {
    if (!stageRef.current || !window.MediaRecorder || previewRef.current.exporting) return;

    const mimeType = pickSupportedVideoMimeType();
    if (!mimeType) {
      setTransientStatus('Video export is not supported in this browser');
      return;
    }

    stopPreviewPlayback();
    setPreview((currentPreview) => ({
      ...currentPreview,
      currentTime: 0,
      exporting: true,
    }));

    const stream = stageRef.current.captureStream(30);
    if (!stream) {
      setPreview((currentPreview) => ({
        ...currentPreview,
        exporting: false,
      }));
      setTransientStatus('Video capture is not available in this browser');
      return;
    }

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 16_000_000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    recorder.start();
    startPreviewPlayback({
      fromStart: true,
      onComplete: () => recorder.stop(),
    });

    await stopped;

    const blob = new Blob(chunks, { type: mimeType });
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${packIdRef.current}-preview.${extension}`;
    link.click();
    URL.revokeObjectURL(url);

    setPreview((currentPreview) => ({
      ...currentPreview,
      exporting: false,
    }));
    setTransientStatus('Video exported');
  }

  async function copyPrompt() {
    if (!currentScene) return;

    try {
      await navigator.clipboard.writeText(currentScene.prompt);
      setTransientStatus('Prompt copied');
    } catch {
      setTransientStatus('Copy failed');
    }
  }

  function downloadCurrentScene() {
    if (!currentScene) return;
    const blob = new Blob([JSON.stringify(currentScene, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${packIdRef.current}-${currentScene.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCurrentPng() {
    if (!currentScene) return;
    stageRef.current?.exportPng(`${packIdRef.current}-${currentScene.id}.png`);
    setTransientStatus('PNG exported');
  }

  function resetCurrentView() {
    stageRef.current?.resetView();
    setTransientStatus('View reset');
  }

  function resetRenderSettings() {
    const nextFov = currentScene ? getSceneLayout(currentScene.id).camera?.fov ?? DEFAULT_RENDER_SETTINGS.fov : DEFAULT_RENDER_SETTINGS.fov;
    setRenderSettings({
      ...DEFAULT_RENDER_SETTINGS,
      fov: nextFov,
    });
    setTransientStatus('Renderer controls reset');
  }

  function updateRangeSetting(key) {
    return (event) => {
      const nextValue = Number(event.target.value);
      setRenderSettings((currentSettings) => ({
        ...currentSettings,
        [key]: nextValue,
      }));
    };
  }

  function updateToggleSetting(key) {
    return (event) => {
      const nextValue = event.target.checked;
      setRenderSettings((currentSettings) => ({
        ...currentSettings,
        [key]: nextValue,
      }));
    };
  }

  function toggleStageFullscreen() {
    if (!stagePanelRef.current || !document.fullscreenEnabled) {
      setTransientStatus('Fullscreen is not available in this browser');
      return;
    }

    if (document.fullscreenElement === stagePanelRef.current) {
      document.exitFullscreen();
      return;
    }

    stagePanelRef.current.requestFullscreen().catch(() => {
      setTransientStatus('Unable to enter fullscreen');
    });
  }

  const previewStatusLabel = preview.exporting ? 'Exporting' : preview.playing ? 'Playing' : 'Stopped';
  const productSummary =
    data?.summary?.description ||
    'React + React Three Fiber scene preview driven by product config and scenario overrides.';

  return (
    <div className="app-shell">
      <header className="topbar panel">
        <div className="brand-block">
          <span className="eyebrow">LuminaDisplay Studio</span>
          <h1>React Three Fiber Portable Monitor Scene Preview</h1>
          <p>{data?.summary?.subtitle || 'Loading listing scene packs...'}</p>
        </div>

        <div className="product-switcher">
          <span className="eyebrow">Product Packs</span>
          <div className="pack-tabs">
            {(manifest?.packs || []).map((pack) => (
              <button
                key={pack.id}
                className={`pack-tab${pack.id === packId ? ' is-active' : ''}`}
                onClick={() => {
                  if (pack.id !== packId) {
                    loadPack(pack.id).catch(() => {});
                  }
                }}
                type="button"
              >
                <strong>{pack.label}</strong>
                <span>{pack.sizeDirectory}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="header-actions">
          <button className="secondary-button" onClick={() => selectScene(sceneIndex - 1, { syncPreview: true })} type="button">
            Prev
          </button>
          <button className="primary-button" disabled={preview.exporting} onClick={togglePreviewPlayback} type="button">
            {preview.playing ? 'Pause Preview' : 'Play Preview'}
          </button>
          <button className="secondary-button" onClick={() => selectScene(sceneIndex + 1, { syncPreview: true })} type="button">
            Next
          </button>
          <a
            className="ghost-link"
            download={currentPack?.file}
            href={currentPack ? `/generated/${currentPack.file}` : '#'}
          >
            {currentPack ? `Download ${currentPack.label} JSON` : 'Download JSON'}
          </a>
        </div>
      </header>

      <main className="workspace">
        <section className="preview-column">
          <div className="panel stage-panel" ref={stagePanelRef}>
            <div className="panel-toolbar">
              <div>
                <span className="eyebrow">{currentScene?.category || 'Scene'}</span>
                <h2>{currentScene?.label || 'Loading...'}</h2>
              </div>
              <div className="panel-toolbar__actions">
                <div className="scene-index-badge">
                  {data?.scenes?.length ? `${sceneIndex + 1} / ${data.scenes.length}` : '0 / 0'}
                </div>
                <button className="secondary-button" onClick={toggleStageFullscreen} type="button">
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
              </div>
            </div>

            <div className={`scene-stage${loading ? ' is-loading' : ''}`}>
              {error ? (
                <div className="error-state">
                  <h2>Scene pack failed to load</h2>
                  <p>{error}</p>
                  <p>
                    Run <code>npm run sync:scenes</code> at the repository root and refresh.
                  </p>
                </div>
              ) : currentScene && data ? (
                <PortableMonitorStage
                  companionDevice={renderSettings.companionDevice}
                  ref={stageRef}
                  product={data.product}
                  scene={currentScene}
                  settings={renderSettings}
                />
              ) : (
                <div className="stage-empty">
                  <p className="loading-copy">Loading React Three Fiber scene pack...</p>
                </div>
              )}
            </div>
          </div>

          <div className="panel strip-panel">
            <div className="panel-toolbar compact">
              <div>
                <span className="eyebrow">Scene Map</span>
                <h2>Amazon Image Sequence</h2>
              </div>
            </div>
            <div className="scene-tabs">
              {(data?.scenes || []).map((scene, index) => (
                <button
                  key={scene.id}
                  className={`scene-tab${index === sceneIndex ? ' is-active' : ''}`}
                  onClick={() => selectScene(index, { syncPreview: true })}
                  type="button"
                >
                  <span className="scene-tab__eyebrow">{scene.category}</span>
                  <strong>{scene.label}</strong>
                  <span className="scene-tab__meta">{scene.headline}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="detail-column">
          <section className="panel info-panel">
            <span className="eyebrow">Product Focus</span>
            <h2>{data?.summary?.title || 'Loading...'}</h2>
            <p>{productSummary}</p>
            <div className="focus-chips">
              {(data?.summary?.focus || []).map((item) => (
                <span className="focus-chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
            <div className="metric-grid">
              {(data?.summary?.metrics || []).map((metric) => (
                <article className="metric-card" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="panel control-panel">
            <span className="eyebrow">Renderer Controls</span>
            <h2>Scene Tuning</h2>
            <div className="control-grid">
              <label className="control-field">
                <span>
                  Light Boost <strong>{renderSettings.lightBoost.toFixed(2)}</strong>
                </span>
                <input max="2.2" min="0.6" onChange={updateRangeSetting('lightBoost')} step="0.05" type="range" value={renderSettings.lightBoost} />
              </label>
              <label className="control-field">
                <span>
                  Screen Brightness <strong>{renderSettings.screenExposure.toFixed(2)}</strong>
                </span>
                <input max="1.8" min="0.5" onChange={updateRangeSetting('screenExposure')} step="0.05" type="range" value={renderSettings.screenExposure} />
              </label>
              <label className="control-field">
                <span>
                  Metalness <strong>{renderSettings.metalness.toFixed(2)}</strong>
                </span>
                <input max="1" min="0.2" onChange={updateRangeSetting('metalness')} step="0.02" type="range" value={renderSettings.metalness} />
              </label>
              <label className="control-field">
                <span>
                  Roughness <strong>{renderSettings.roughness.toFixed(2)}</strong>
                </span>
                <input max="0.9" min="0.1" onChange={updateRangeSetting('roughness')} step="0.02" type="range" value={renderSettings.roughness} />
              </label>
              <label className="control-field">
                <span>
                  Camera FOV <strong>{Math.round(renderSettings.fov)}</strong>
                </span>
                <input max="52" min="24" onChange={updateRangeSetting('fov')} step="1" type="range" value={renderSettings.fov} />
              </label>
              <label className="control-field">
                <span>
                  Host Device <strong>{renderSettings.companionDevice === 'auto' ? 'Auto' : renderSettings.companionDevice}</strong>
                </span>
                <select
                  className="control-select"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setRenderSettings((currentSettings) => ({
                      ...currentSettings,
                      companionDevice: nextValue,
                    }));
                  }}
                  value={renderSettings.companionDevice}
                >
                  <option value="auto">Auto</option>
                  <option value="laptop">Laptop</option>
                  <option value="phone">Phone</option>
                  <option value="desktop">Desktop</option>
                </select>
              </label>
              <div className="toggle-grid">
                <label className="toggle-field">
                  <input checked={renderSettings.autoRotate} onChange={updateToggleSetting('autoRotate')} type="checkbox" />
                  <span>Auto Rotate</span>
                </label>
                <label className="toggle-field">
                  <input checked={renderSettings.propsVisible} onChange={updateToggleSetting('propsVisible')} type="checkbox" />
                  <span>Show Props</span>
                </label>
              </div>
            </div>
            <div className="detail-actions detail-actions--compact">
              <button className="secondary-button" onClick={resetRenderSettings} type="button">
                Reset Controls
              </button>
            </div>
          </section>

          <section className="panel detail-panel">
            <span className="eyebrow">Current Scene</span>
            <h2>{currentScene?.headline || 'Loading...'}</h2>
            <p>{currentScene?.objective || 'The preview app needs generated scene JSON before it can render.'}</p>

            <div className="detail-section">
              <h3>Stage Notes</h3>
              <ul className="detail-list">
                {[currentScene?.subheadline, ...(currentScene?.copyLines || [])].filter(Boolean).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="detail-section">
              <h3>Amazon Rules</h3>
              <ul className="detail-list">
                {(currentScene?.compliance || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="detail-section">
              <h3>Render Hints</h3>
              <ul className="detail-list">
                {(currentScene?.renderHints || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="detail-section">
              <h3>Override Data</h3>
              <ul className="detail-list">
                {buildOverrideEntries(currentScene?.override).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="detail-actions">
              <button className="secondary-button" onClick={resetCurrentView} type="button">
                Reset View
              </button>
              <button className="primary-button" onClick={exportCurrentPng} type="button">
                Export PNG
              </button>
              <button className="primary-button" onClick={copyPrompt} type="button">
                Copy Prompt
              </button>
              <button className="secondary-button" onClick={downloadCurrentScene} type="button">
                Download Scene JSON
              </button>
            </div>

            <div className="prompt-box">
              <div className="prompt-toolbar">
                <span>Prompt Spec</span>
                <span>{statusMessage}</span>
              </div>
              <pre>{currentScene?.prompt || ''}</pre>
            </div>
          </section>

          <section className="panel timeline-panel">
            <span className="eyebrow">Video Flow</span>
            <h2>30-second Amazon Video</h2>
            <div className="preview-player">
              <label className="preview-player__scrub">
                <input
                  max="1000"
                  min="0"
                  onChange={(event) => {
                    const duration = Math.max(preview.duration, 1);
                    const nextTime = (Number(event.target.value) / 1000) * duration;
                    setPreviewTime(nextTime);
                  }}
                  step="1"
                  type="range"
                  value={Math.round((preview.currentTime / Math.max(preview.duration, 1)) * 1000)}
                />
              </label>
              <div className="preview-player__meta">
                <span>{`${formatTimestamp(preview.currentTime)} / ${formatTimestamp(preview.duration)}`}</span>
                <span>{previewStatusLabel}</span>
              </div>
            </div>
            <div className="preview-player__actions">
              <button className="primary-button" disabled={preview.exporting} onClick={exportPreviewVideo} type="button">
                {preview.exporting ? 'Exporting...' : 'Export Video'}
              </button>
            </div>
            <ol className="timeline-list">
              {preview.segments.map((segment) => (
                <li className={`timeline-step${segment.index === sceneIndex ? ' is-active' : ''}`} key={`${segment.index}-${segment.start}`}>
                  <button className="timeline-step__button" onClick={() => jumpToSegment(segment.index)} type="button">
                    <span className="timeline-step__time">
                      {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                    </span>
                    <span className="timeline-step__text">{segment.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </main>
    </div>
  );
}
