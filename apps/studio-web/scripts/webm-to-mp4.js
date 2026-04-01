const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const args = {
    ffmpegPath: process.env.FFMPEG_PATH || '',
    input: '',
    output: '',
    overwrite: true,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === '--input' || arg === '-i') && argv[i + 1]) args.input = path.resolve(argv[++i]);
    else if ((arg === '--output' || arg === '-o') && argv[i + 1]) args.output = path.resolve(argv[++i]);
    else if (arg === '--ffmpeg' && argv[i + 1]) args.ffmpegPath = path.resolve(argv[++i]);
    else if (arg === '--no-overwrite') args.overwrite = false;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      positional.push(path.resolve(arg));
    }
  }

  if (!args.input && positional[0]) {
    args.input = positional[0];
  }

  if (!args.output && positional[1]) {
    args.output = positional[1];
  }

  if (!args.input) {
    throw new Error('Missing input file. Use --input <file.webm> or pass the .webm path as the first positional argument.');
  }

  if (!fs.existsSync(args.input)) {
    throw new Error(`Input file was not found: ${args.input}`);
  }

  if (path.extname(args.input).toLowerCase() !== '.webm') {
    throw new Error(`Input file must be a .webm file: ${args.input}`);
  }

  if (!args.output) {
    args.output = args.input.replace(/\.webm$/i, '.mp4');
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node scripts/webm-to-mp4.js --input <file.webm> [options]',
    '   or: node scripts/webm-to-mp4.js <file.webm> [output.mp4]',
    '',
    'Options:',
    '  --input, -i <path>     Source .webm file',
    '  --output, -o <path>    Target .mp4 path (defaults to input basename)',
    '  --ffmpeg <path>        Explicit ffmpeg executable path',
    '  --no-overwrite         Fail if the output file already exists',
  ].join('\n'));
}

function canRunExecutable(candidate) {
  const result = spawnSync(candidate, ['-version'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

function getWingetFfmpegCandidates() {
  const localAppData = process.env.LOCALAPPDATA || '';
  if (!localAppData) return [];

  const candidates = [];
  const linksPath = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
  candidates.push(linksPath);

  const packagesRoot = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (!fs.existsSync(packagesRoot)) return candidates;

  for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('Gyan.FFmpeg_')) continue;
    const packageRoot = path.join(packagesRoot, entry.name);
    for (const innerEntry of fs.readdirSync(packageRoot, { withFileTypes: true })) {
      if (!innerEntry.isDirectory() || !innerEntry.name.startsWith('ffmpeg-')) continue;
      candidates.push(path.join(packageRoot, innerEntry.name, 'bin', 'ffmpeg.exe'));
    }
  }

  return candidates;
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
    ...getWingetFfmpegCandidates(),
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    if (candidate !== 'ffmpeg' && !fs.existsSync(candidate)) continue;
    if (canRunExecutable(candidate)) return candidate;
  }

  return '';
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const ffmpegPath = findFfmpeg(options.ffmpegPath);

  if (!ffmpegPath) {
    throw new Error('ffmpeg was not found. Install ffmpeg or set FFMPEG_PATH or --ffmpeg.');
  }

  if (!options.overwrite && fs.existsSync(options.output)) {
    throw new Error(`Output file already exists: ${options.output}`);
  }

  await runProcess(ffmpegPath, [
    options.overwrite ? '-y' : '-n',
    '-i',
    options.input,
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-vf',
    'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    options.output,
  ], 'ffmpeg conversion');

  console.log(`Converted: ${options.output}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
