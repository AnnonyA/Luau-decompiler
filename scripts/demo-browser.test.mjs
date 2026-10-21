import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

test("static demo works under a repository subpath in Chromium", { timeout: 60_000 }, async (t) => {
  const root = new URL("../_site/", import.meta.url);
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, "http://localhost").pathname;
      if (!path.startsWith("/Luau-decompiler/")) throw new Error("outside site");
      const file = new URL(path.slice("/Luau-decompiler/".length) || "index.html", root);
      if (!file.href.startsWith(root.href)) throw new Error("outside site");
      const body = await readFile(file);
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
      response.writeHead(200, { "Content-Type": types[extname(file.pathname)] ?? "application/octet-stream" });
      response.end(body);
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const profile = await mkdtemp(join(tmpdir(), "luau-demo-browser-"));
  const browser = spawn(process.env.CHROME_BIN || "chromium", [
    "--headless", "--no-sandbox", "--disable-gpu", "--disable-background-networking",
    "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  t.after(async () => {
    if (browser.pid && browser.exitCode === null) { const done = once(browser, "exit"); browser.kill(); await done; }
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  });
  const endpoint = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(() => reject(new Error("Chromium did not start")), 10_000);
    browser.once("error", (error) => { clearTimeout(timer); reject(error); });
    browser.stderr.on("data", (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const socket = new WebSocket(endpoint);
  await once(socket, "open");
  t.after(() => socket.close());
  let serial = 0;
  const pending = new Map();
  const errors = [];
  const requests = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callback.reject(new Error(message.error.message));
      else callback.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    if (message.method === "Network.requestWillBeSent") requests.push(message.params.request);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page("Runtime.enable");
  await page("Network.enable");
  await page("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expression) => {
    const result = await page("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = (expression) => evaluate(`new Promise((resolve,reject)=>{
    const until=Date.now()+8000;
    const poll=()=>{if(${expression})resolve(true);else if(Date.now()>until)reject(new Error("UI condition timed out"));else setTimeout(poll,30)};poll();
  })`);
  const base = `http://127.0.0.1:${server.address().port}/Luau-decompiler/`;
  await page("Page.navigate", { url: base });
  await waitFor('document.getElementById("revision")?.textContent');
  await evaluate('document.getElementById("example").click()');
  await waitFor('document.getElementById("cancel").hidden && document.getElementById("code").textContent');
  assert.match(await evaluate('document.getElementById("code").textContent'), /print\("Hello from Luau!"\)/);
  assert.equal(await evaluate('document.getElementById("download").disabled'), false);

  // Browser file selection exercises File.arrayBuffer and transferable bytes.
  const { root: documentRoot } = await page("DOM.getDocument");
  const { nodeId } = await page("DOM.querySelector", { nodeId: documentRoot.nodeId, selector: "#file" });
  await page("DOM.setFileInputFiles", { nodeId, files: [fileURLToPath(new URL("example.luauc", root))] });
  await evaluate('document.getElementById("run").click()');
  await waitFor('document.getElementById("cancel").hidden && !document.getElementById("download").disabled');
  assert.match(await evaluate('document.getElementById("code").textContent'), /Hello from Luau/);
  await send("Browser.grantPermissions", {
    origin: new URL(base).origin, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  });
  await page("Page.bringToFront");
  await evaluate('document.getElementById("copy").click()');
  await waitFor('document.getElementById("status").textContent === "Copied to clipboard."');
  assert.match(await evaluate("navigator.clipboard.readText()"), /Hello from Luau/);
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: profile });
  await evaluate('document.getElementById("download").click()');
  let downloaded;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { downloaded = await readFile(join(profile, "example.luau"), "utf8"); break; }
    catch { await delay(30); }
  }
  assert.equal(downloaded, await evaluate('document.getElementById("code").textContent'));
  await evaluate('document.getElementById("tab-disassembly").click()');
  assert.match(await evaluate('document.getElementById("code").textContent'), /CALL/);
  await evaluate('document.getElementById("tab-source").click()');

  await evaluate('document.getElementById("run").click(); document.getElementById("cancel").click()');
  assert.match(await evaluate('document.getElementById("status").textContent'), /Cancelled/);
  assert.equal(await evaluate('document.getElementById("download").disabled'), true);

  const encoded = (await readFile(new URL("example.luauc", root))).toString("base64");
  await evaluate(`document.getElementById("mode-base64").click(); document.getElementById("base64").value=${JSON.stringify(encoded)}; document.getElementById("run").click()`);
  await waitFor('document.getElementById("cancel").hidden && !document.getElementById("download").disabled');
  assert.match(await evaluate('document.getElementById("code").textContent'), /Hello from Luau/);
  if (process.env.DEMO_SCREENSHOT) {
    const shot = await page("Page.captureScreenshot", { format: "png" });
    await writeFile(process.env.DEMO_SCREENSHOT, Buffer.from(shot.data, "base64"));
  }

  await evaluate('document.getElementById("base64").value="@@@"; document.getElementById("run").click()');
  await waitFor('document.getElementById("status").classList.contains("error")');
  assert.match(await evaluate('document.getElementById("code").textContent'), /valid Base64/);
  assert.equal(await evaluate('document.getElementById("download").disabled'), true);
  await evaluate('document.getElementById("base64").value="/wAA"; document.getElementById("run").click()');
  await waitFor('document.getElementById("cancel").hidden && document.getElementById("code").textContent.includes("version")');
  assert.equal(await evaluate('document.getElementById("download").disabled'), true);

  // Keep the worker deliberately silent to verify timeout recovery without a
  // slow or resource-heavy bytecode fixture. Real workers are exercised above.
  await evaluate(`
    window.savedWorker = window.Worker;
    window.savedTimeout = window.setTimeout;
    window.Worker = class { postMessage() {} terminate() {} };
    window.setTimeout = (fn, ms, ...args) => savedTimeout(fn, ms === 15000 ? 20 : ms, ...args);
    document.getElementById("base64").value = ${JSON.stringify(encoded)};
    document.getElementById("run").click();
  `);
  await waitFor('document.getElementById("status").textContent.includes("15 seconds")');
  assert.equal(await evaluate('document.getElementById("run").disabled'), false);
  await evaluate('window.Worker = savedWorker; window.setTimeout = savedTimeout; document.getElementById("example").click()');
  await waitFor('!document.getElementById("download").disabled');

  await page("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  if (process.env.DEMO_SCREENSHOT) {
    const shot = await page("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(process.env.DEMO_SCREENSHOT.replace(/\.png$/, "-mobile.png"), Buffer.from(shot.data, "base64"));
  }
  assert.deepEqual(errors, []);
  assert.ok(requests.every((request) => request.method === "GET"), "no bytecode is POSTed to a backend");
  assert.ok(requests.every((request) => request.url.startsWith(base)), "all requests stay within the static site");
});
