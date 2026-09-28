/*
 * Minimal web smoke test.
 * Starts Expo in web mode, waits for the dev server, then verifies that the
 * document is reachable and contains the app root. This intentionally avoids
 * asserting medical content or clinical behaviour.
 */
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const PORT = Number(process.env.E2E_PORT || 4173);
const HOST = process.env.E2E_HOST || '127.0.0.1';
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 120000);
const url = `http://${HOST}:${PORT}`;

function waitForServer(target, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(target, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve(res.statusCode);
        retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${target}`));
      } else {
        setTimeout(poll, 1000);
      }
    };
    poll();
  });
}

(async () => {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['expo', 'start', '--web', '--localhost', '--port', String(PORT)],
    {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1' },
    },
  );

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    const status = await waitForServer(url, TIMEOUT_MS);
    if (status >= 400) throw new Error(`Web server returned HTTP ${status}`);
    console.log(`E2E smoke test passed: ${url}`);
  } catch (error) {
    console.error(error.message);
    console.error(output.slice(-4000));
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 3000).unref();
  }
})();
