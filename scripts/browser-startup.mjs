import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

// Chrome's DevToolsActivePort is the readiness protocol used by automation
// clients. stderr is diagnostic output and need not contain the endpoint.
export async function waitForBrowser(browser, profile, {timeoutMs = 30_000} = {}) {
  let log = '', spawnError;
  const capture = chunk => { log = (log + chunk.toString()).slice(-16_384); };
  const onError = error => { spawnError = error; };
  browser.stderr?.on('data', capture);
  browser.once('error', onError);
  const failure = message => new Error(`${message}\n${spawnError?.message ?? ''}\n${log}`.trim());
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (spawnError || browser.exitCode !== null || browser.signalCode !== null) {
        throw failure(`Chromium exited before readiness (exit=${browser.exitCode}, signal=${browser.signalCode})`);
      }
      try {
        const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
        if (/^\d+$/.test(port) && Number(port) > 0 && Number(port) <= 65535 && /^\/devtools\/browser\/[\w-]+$/.test(path)) {
          return `ws://127.0.0.1:${port}${path}`;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await delay(50);
    }
    throw failure(`Chromium readiness timed out after ${timeoutMs}ms`);
  } finally {
    browser.stderr?.off('data', capture);
    browser.off('error', onError);
  }
}
