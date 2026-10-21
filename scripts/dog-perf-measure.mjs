#!/usr/bin/env node
/**
 * Headed (or headless) Chrome probe for the Dog page.
 * Usage:
 *   node scripts/dog-perf-measure.mjs --url http://127.0.0.1:3000/en/dog?preview=world --label after --seconds 12
 *   node scripts/dog-perf-measure.mjs --url https://saidyaka.com/en/dog --label before --throttle 4
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import http from 'node:http';

const args = process.argv.slice(2);
function flag(name, fallback = '') {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const url = flag('url', 'https://saidyaka.com/en/dog');
const label = flag('label', 'run');
const seconds = Number(flag('seconds', '12'));
const throttle = Number(flag('throttle', '1'));
const headed = args.includes('--headed');
const port = Number(flag('port', '9223'));
const out = flag('out', `/tmp/dog-perf-${label}.json`);
const chrome = process.env.CHROME_PATH || 'google-chrome';

const chromeArgs = [
  headed ? '' : '--headless=new',
  '--disable-gpu-sandbox',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`,
  '--window-size=1280,800',
  '--user-data-dir=/tmp/dog-perf-chrome',
  url,
].filter(Boolean);

const child = spawn(chrome, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTarget(tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const list = await get('/json/list');
      const page = list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // chrome still coming up
    }
    await sleep(250);
  }
  throw new Error('chrome target not found');
}

async function cdp(wsUrl, method, params = {}, sessionId) {
  if (!cdp.ws) {
    cdp.id = 0;
    cdp.ws = new WebSocket(wsUrl);
    cdp.pending = new Map();
    await new Promise((resolve, reject) => {
      cdp.ws.addEventListener('open', resolve);
      cdp.ws.addEventListener('error', reject);
    });
    cdp.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      const wait = cdp.pending.get(msg.id);
      if (wait) {
        cdp.pending.delete(msg.id);
        wait(msg);
      }
    });
  }
  const id = (cdp.id += 1);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`cdp timeout ${method}`)), 20_000);
    cdp.pending.set(id, (msg) => {
      clearTimeout(timer);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    });
    cdp.ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

try {
  const target = await waitForTarget();
  const hello = await cdp(target.webSocketDebuggerUrl, 'Target.getTargetInfo');
  void hello;
  await cdp(target.webSocketDebuggerUrl, 'Runtime.enable');
  await cdp(target.webSocketDebuggerUrl, 'Page.enable');
  if (throttle > 1) {
    await cdp(target.webSocketDebuggerUrl, 'Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  await cdp(target.webSocketDebuggerUrl, 'Page.bringToFront');
  await sleep(2500);
  await cdp(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: `(() => {
      if (window.__DOG_PERF_INJECTED) return true;
      window.__DOG_PERF_INJECTED = true;
      const frames = [];
      let last = performance.now();
      const loop = (now) => {
        frames.push(now - last);
        last = now;
        if (frames.length > 360) frames.shift();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      window.__DOG_FRAMES = frames;
      const kick = () => {
        const play = document.querySelector('.dog-start-play');
        if (play && !play.disabled) play.click();
        document.querySelectorAll('.biscuit-scene, canvas').forEach((node) => {
          node.style.width = '100vw';
          node.style.height = '100vh';
        });
        window.dispatchEvent(new Event('resize'));
      };
      kick();
      setInterval(kick, 800);
      return true;
    })()`,
    awaitPromise: false,
  });
  await sleep(Math.max(4000, seconds * 1000));
  const result = await cdp(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: `(() => {
      const frames = window.__DOG_FRAMES || [];
      const sorted = [...frames].sort((a, b) => a - b);
      const avg = frames.reduce((s, n) => s + n, 0) / Math.max(1, frames.length);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      const fps = frames.filter((n) => n > 0).map((n) => 1000 / n);
      const avgFps = fps.reduce((s, n) => s + n, 0) / Math.max(1, fps.length);
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
      return {
        label: ${JSON.stringify(label)},
        url: location.href,
        samples: frames.length,
        avgFrameMs: Number(avg.toFixed(2)),
        p95FrameMs: Number(p95.toFixed(2)),
        avgFps: Number(avgFps.toFixed(1)),
        minFps: Number(Math.min(...fps, 0).toFixed(1)),
        memMB: mem,
        probe: window.__DOG_PERF || null,
        throttle: ${throttle},
      };
    })()`,
    returnByValue: true,
  });
  const payload = result.result.value;
  mkdirSync('/tmp', { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
