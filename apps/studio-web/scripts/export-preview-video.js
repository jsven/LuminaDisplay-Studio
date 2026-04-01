const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const server = require(path.join(appRoot, 'server.js'));

function parseArgs(argv) {
  const args = {
    ffmpegPath: process.env.FFMPEG_PATH || '',
    format: 'mp4',
    height: 1440,
    keepWebm: false,
    outDir: path.join(repoRoot, 'assets', 'renders', 'video-previews'),
    packId: 'portable-monitor-16-inch',
    width: 2560,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pack' && argv[i + 1]) args.packId = argv[++i];
    else if (arg === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(repoRoot, argv[++i]);
    else if (arg === '--width' && argv[i + 1]) args.width = parsePositiveNumber(argv[++i], '--width');
    else if (arg === '--height' && argv[i + 1]) args.height = parsePositiveNumber(argv[++i], '--height');
    else if (arg === '--format' && argv[i + 1]) args.format = normalizeFormat(argv[++i]);
    else if (arg === '--ffmpeg' && argv[i + 1]) args.ffmpegPath = path.resolve(argv[++i]);
    else if (arg === '--keep-webm') args.keepWebm = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function parsePositiveNumber(rawValue, label) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${label} value: ${rawValue}`);
  }
  return value;
}

function normalizeFormat(rawValue) {
  const value = String(rawValue).toLowerCase();
  if (value === 'auto' || value === 'mp4' || value === 'webm') return value;
  throw new Error(`Invalid --format value: ${rawValue}. Expected mp4, webm, or auto.`);
}

function printHelp() {
  console.log([
    'Usage: node scripts/export-preview-video.js [options]',
    '',
    'Options:',
    '  --pack <id>        Product pack id to load',
    '  --out-dir <path>   Output directory under the repository root',
    '  --width <px>       Browser viewport width',
    '  --height <px>      Browser viewport height',
    '  --format <type>    mp4 (default), webm, or auto',
    '  --ffmpeg <path>    Explicit ffmpeg executable path',
    '  --keep-webm        Keep the downloaded .webm after mp4 conversion',
  ].join('\n'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runProcess(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderr.trim();
      reject(new Error(`${label} failed with exit code ${code}${detail ? `\n${detail}` : ''}`));
    });
  });
}

function waitForChildExit(child, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);
    child.once('exit', finish);
    child.once('error', finish);
  });
}

async function stopChild(child) {
  if (!child) return;
  if (child.exitCode === null) {
    try {
      child.kill();
    } catch {}
  }
  await waitForChildExit(child);
}

async function removeDirWithRetries(dirPath) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.rmSync(dirPath, { force: true, recursive: true });
      return;
    } catch (error) {
      if (attempt === 5 || (error.code !== 'EBUSY' && error.code !== 'EPERM')) {
        throw error;
      }
      await wait(250 * (attempt + 1));
    }
  }
}

async function waitFor(predicate, timeoutMs, intervalMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await predicate();
    if (result) return result;
    await wait(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const instance = server.listen(0, () => {
      resolve({
        close: () => new Promise((done) => instance.close(() => done())),
        port: instance.address().port,
      });
    });
    instance.on('error', reject);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 1;

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const resolver = pending.get(message.id);
    if (!resolver) return;
    pending.delete(message.id);
    if (message.error) resolver.reject(new Error(message.error.message));
    else resolver.resolve(message.result);
  });

  await opened;

  return {
    close() {
      socket.close();
    },
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextId += 1;
        pending.set(id, { reject, resolve });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function waitForChrome(debugPort) {
  return waitFor(async () => {
    try {
      return await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
    } catch {
      return null;
    }
  }, 20000, 250, 'Chrome remote debugging');
}

async function waitForTarget(debugPort, appUrl) {
  return waitFor(async () => {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
      return targets.find((target) => target.type === 'page' && target.url.startsWith(appUrl)) || null;
    } catch {
      return null;
    }
  }, 20000, 250, 'preview page target');
}

async function waitForPreviewReady(cdp, downloadPath) {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath,
  }).catch(() => {});

  await waitFor(async () => {
    const result = await cdp.send('Runtime.evaluate', {
      awaitPromise: true,
      expression: 'window.__studioPreview && window.__studioPreview.isReady && window.__studioPreview.isReady()',
      returnByValue: true,
    }).catch(() => null);
    return result && result.result && result.result.value === true;
  }, 30000, 250, 'preview app readiness');
}

function listCandidateFiles(outDir, packId) {
  return [
    path.join(outDir, `${packId}-preview.webm`),
    path.join(outDir, `${packId}-preview.mp4`),
  ];
}

function snapshotCandidateFiles(outDir, packId) {
  const snapshot = new Map();
  for (const file of listCandidateFiles(outDir, packId)) {
    if (!fs.existsSync(file)) continue;
    const stats = fs.statSync(file);
    snapshot.set(file, `${stats.size}:${stats.mtimeMs}`);
  }
  return snapshot;
}

function isFreshDownload(file, stats, snapshot) {
  return snapshot.get(file) !== `${stats.size}:${stats.mtimeMs}`;
}

function canRunExecutable(candidate) {
  const result = spawnSync(candidate, ['-version'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

function findFfmpeg(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.FFMPEG_PATH,
    'ffmpeg',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(os.homedir(), 'scoop', 'apps', 'ffmpeg', 'current', 'bin', 'ffmpeg.exe'),
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];
  for (const candidate of uniqueCandidates) {
    if (candidate !== 'ffmpeg' && !fs.existsSync(candidate)) continue;
    if (canRunExecutable(candidate)) return candidate;
  }

  return '';
}

async function waitForDownload(outDir, packId, snapshot) {
  return waitFor(async () => {
    const candidates = listCandidateFiles(outDir, packId);
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue;
      const statsA = fs.statSync(file);
      if (!isFreshDownload(file, statsA, snapshot)) continue;
      await wait(400);
      const statsB = fs.statSync(file);
      if (!isFreshDownload(file, statsB, snapshot)) continue;
      if (statsA.size > 0 && statsA.size === statsB.size) return file;
    }
    return null;
  }, 180000, 500, 'downloaded preview video');
}

async function convertWebmToMp4(sourceFile, explicitFfmpegPath) {
  const ffmpegPath = findFfmpeg(explicitFfmpegPath);
  if (!ffmpegPath) {
    throw new Error([
      'Downloaded a .webm preview but ffmpeg was not found.',
      `Install ffmpeg or set FFMPEG_PATH, then rerun the script to convert: ${sourceFile}`,
    ].join(' '));
  }

  const outputFile = sourceFile.replace(/\.webm$/i, '.mp4');
  await runProcess(ffmpegPath, [
    '-y',
    '-i',
    sourceFile,
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-vf',
    'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    outputFile,
  ], 'ffmpeg conversion');
  return outputFile;
}

async function finalizeOutput(downloadedFile, options) {
  const ext = path.extname(downloadedFile).toLowerCase();
  if (options.format === 'auto') return downloadedFile;
  if (options.format === 'webm') return downloadedFile;
  if (ext === '.mp4') return downloadedFile;
  if (ext !== '.webm') {
    throw new Error(`Unsupported downloaded video format: ${downloadedFile}`);
  }

  const convertedFile = await convertWebmToMp4(downloadedFile, options.ffmpegPath);
  if (!options.keepWebm) {
    fs.rmSync(downloadedFile, { force: true });
  }
  return convertedFile;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDir(options.outDir);

  const browserPath = findBrowser();
  if (!browserPath) {
    throw new Error('No supported Chrome/Edge browser was found in standard install paths.');
  }

  const debugPort = 9223;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-export-'));
  const downloadSnapshot = snapshotCandidateFiles(options.outDir, options.packId);

  const runningServer = await startServer();
  const appUrl = `http://127.0.0.1:${runningServer.port}/?product=${encodeURIComponent(options.packId)}`;

  const browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${options.width},${options.height}`,
    appUrl,
  ], {
    detached: false,
    stdio: 'ignore',
    windowsHide: true,
  });

  let browserCdp;
  let pageCdp;
  let resultError = null;

  try {
    const browserInfo = await waitForChrome(debugPort);
    browserCdp = await connectCdp(browserInfo.webSocketDebuggerUrl);
    await browserCdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: options.outDir,
      eventsEnabled: false,
    }).catch(() => {});

    const target = await waitForTarget(debugPort, appUrl);
    pageCdp = await connectCdp(target.webSocketDebuggerUrl);
    await waitForPreviewReady(pageCdp, options.outDir);

    await pageCdp.send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `window.__studioPreview.loadPack(${JSON.stringify(options.packId)})`,
      returnByValue: true,
      userGesture: true,
    });

    await pageCdp.send('Runtime.evaluate', {
      awaitPromise: true,
      expression: 'window.__studioPreview.exportPreviewVideo()',
      returnByValue: true,
      userGesture: true,
    });

    const downloadedFile = await waitForDownload(options.outDir, options.packId, downloadSnapshot);
    const finalFile = await finalizeOutput(downloadedFile, options);
    console.log(`Export completed: ${finalFile}`);
  } catch (error) {
    resultError = error;
  }

  try {
    if (pageCdp) pageCdp.close();
    if (browserCdp) browserCdp.close();
    await stopChild(browser);
    await runningServer.close();
    await removeDirWithRetries(userDataDir);
  } catch (cleanupError) {
    if (!resultError) {
      resultError = cleanupError;
    } else {
      console.warn(`Cleanup warning: ${cleanupError.message || cleanupError}`);
    }
  }

  if (resultError) throw resultError;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
