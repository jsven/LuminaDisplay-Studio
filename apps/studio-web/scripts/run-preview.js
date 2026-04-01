const path = require('node:path');
const { spawn } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const server = require(path.join(appRoot, 'server.js'));
const syncScripts = [
  'generate-scene-data.js',
  'generate-scene-data-07.js',
  'build-manifest.js',
  'prepare-vendor.js',
];

let serverInstance = null;
let shuttingDown = false;

function runNodeScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn(process.execPath, [scriptPath], {
      cwd: appRoot,
      detached: false,
      stdio: 'inherit',
      windowsHide: false,
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start ${scriptName}: ${error.message}`));
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${scriptName} exited with ${detail}`));
    });
  });
}

async function syncScenes() {
  for (const scriptName of syncScripts) {
    await runNodeScript(scriptName);
  }
}

function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (reason) {
    console.log(`Stopping preview server (${reason})...`);
  }

  if (!serverInstance) {
    process.exit(exitCode);
    return;
  }

  const forceExitTimer = setTimeout(() => {
    process.exit(exitCode);
  }, 5000);

  if (typeof forceExitTimer.unref === 'function') {
    forceExitTimer.unref();
  }

  serverInstance.close(() => {
    clearTimeout(forceExitTimer);
    process.exit(exitCode);
  });

  if (typeof serverInstance.closeAllConnections === 'function') {
    serverInstance.closeAllConnections();
  }
}

function attachLifecycleHandlers() {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => shutdown(signal));
  }

  process.on('disconnect', () => shutdown('parent disconnect'));
  process.on('uncaughtException', (error) => {
    console.error(error);
    shutdown('uncaught exception', 1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error(reason);
    shutdown('unhandled rejection', 1);
  });

  if (process.stdin) {
    process.stdin.on('end', () => shutdown('stdin closed'));
    process.stdin.on('close', () => shutdown('stdin closed'));

    if (typeof process.stdin.resume === 'function' && !process.stdin.destroyed) {
      process.stdin.resume();
    }
  }
}

async function main() {
  attachLifecycleHandlers();
  await syncScenes();
  serverInstance = server.startServer(Number(process.env.PORT || 4173));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
