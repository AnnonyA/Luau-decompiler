import { decodeBase64, validateSize } from "./input.js";

const $ = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll("[data-tab]")];
let inputMode = "file";
let selectedFile = null;
let activeTab = "source";
let last = null;
let worker = null;
let timer = null;
let generation = 0;
let filename = "decompiled";

function status(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}

function setMode(mode) {
  inputMode = mode;
  for (const name of ["file", "base64"]) {
    $("mode-" + name).classList.toggle("selected", mode === name);
    $("mode-" + name).setAttribute("aria-pressed", String(mode === name));
    $(name + "-panel").hidden = mode !== name;
  }
}

function chooseFile(file) {
  if (!file) return;
  selectedFile = file;
  setMode("file");
  $("file-name").textContent = file.name;
  $("file-detail").textContent = `${file.size.toLocaleString()} bytes · click to replace`;
  try { validateSize(file.size); status("File ready. Select Decompile to inspect it."); }
  catch (error) { status(error.message, true); }
}

function displayedText() {
  if (!last) return "";
  if (activeTab === "diagnostics") {
    return last.diagnostics?.length
      ? last.diagnostics.map((item) => `${item.severity}: ${item.message}`).join("\n\n")
      : "No diagnostics reported. This does not guarantee an exact reconstruction.";
  }
  if (!last.ok) return last.error;
  return last[activeTab] || "No instructions to display.";
}

function render() {
  $("empty").hidden = last !== null;
  $("output").hidden = last === null;
  $("code").textContent = displayedText();
  $("diagnostic-count").textContent = String(last?.diagnostics?.length ?? 0);
  $("copy").disabled = !last;
  $("download").disabled = !last?.ok;
  const lineCount = last?.ok && last.source ? last.source.trimEnd().split("\n").length : 0;
  $("output-info").textContent = last?.ok
    ? `${lineCount} source ${lineCount === 1 ? "line" : "lines"} · UTF-8`
    : last ? "Could not reconstruct this input" : "Waiting for input";
  $("result-meta").textContent = last?.ok
    ? `v${last.profile.version} · ${last.profile.status === "experimental" ? "experimental" : "supported"}` : "";
}

function selectTab(tab) {
  activeTab = tab;
  for (const button of tabs) {
    const active = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }
  $("result").setAttribute("aria-labelledby", "tab-" + tab);
  render();
}

function busy(value) {
  $("run").disabled = value;
  $("example").disabled = value;
  $("cancel").hidden = !value;
  $("result").setAttribute("aria-busy", String(value));
}

function stop() {
  generation++;
  worker?.terminate();
  worker = null;
  clearTimeout(timer);
  timer = null;
  busy(false);
}

function fail(message) {
  stop();
  last = { ok: false, error: message, diagnostics: [{ severity: "error", message }] };
  status(message, true);
  render();
}

async function run(example = false) {
  stop();
  const request = generation;
  busy(true);
  last = null;
  render();
  status(example ? "Loading the example…" : "Reading bytecode…");
  const options = {
    typeAnnotations: $("types").value,
    opcodeEncoding: $("encoding").value,
    // Avoid optional cosmetic rewrites that can alter runtime behavior.
    interpolatedStrings: false, mathConstants: false,
  };
  const started = performance.now();
  timer = setTimeout(() => {
    if (request === generation) fail("Stopped after 15 seconds. Try a smaller chunk or use the local CLI for a larger input.");
  }, 15_000);
  try {
    let bytes;
    if (example) {
      const response = await fetch(new URL("../example.luauc", import.meta.url));
      if (!response.ok) throw new Error("Could not load the example. Try uploading your own bytecode.");
      bytes = new Uint8Array(await response.arrayBuffer());
      filename = "hello-luau";
      options.opcodeEncoding = "official";
    } else if (inputMode === "file") {
      if (!selectedFile) throw new Error("Choose a bytecode file or switch to Paste Base64.");
      validateSize(selectedFile.size);
      filename = selectedFile.name.replace(/\.[^.]+$/, "") || "decompiled";
      bytes = new Uint8Array(await selectedFile.arrayBuffer());
    } else {
      bytes = decodeBase64($("base64").value);
      filename = "decompiled";
    }
    if (request !== generation) return;
    validateSize(bytes.byteLength);
    status("Reconstructing Luau…");
    worker = new Worker(new URL("../worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (request !== generation) return;
      last = data;
      stop();
      const elapsed = ((performance.now() - started) / 1000).toFixed(2);
      const hasErrors = data.diagnostics?.some((item) => item.severity === "error");
      status(data.ok
        ? `${hasErrors ? "Reconstructed with errors — check Diagnostics" : "Reconstructed"} · ${elapsed}s`
        : data.error, !data.ok || hasErrors);
      render();
    };
    worker.onerror = (event) => {
      event.preventDefault();
      if (request === generation) fail("The browser could not complete this chunk. Try a smaller file or reload the page.");
    };
    worker.onmessageerror = () => {
      if (request === generation) fail("The result could not be read. Try another chunk.");
    };
    worker.postMessage({ bytes, options }, [bytes.buffer]);
  } catch (error) {
    if (request === generation) fail(error instanceof Error ? error.message : String(error));
  }
}

$("mode-file").addEventListener("click", () => setMode("file"));
$("mode-base64").addEventListener("click", () => { setMode("base64"); $("base64").focus(); });
$("file").addEventListener("change", (event) => chooseFile(event.target.files[0]));
$("dropzone").addEventListener("dragover", (event) => { event.preventDefault(); $("dropzone").classList.add("dragging"); });
$("dropzone").addEventListener("dragleave", () => $("dropzone").classList.remove("dragging"));
$("dropzone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("dropzone").classList.remove("dragging");
  chooseFile(event.dataTransfer.files[0]);
});
$("run").addEventListener("click", () => void run());
$("example").addEventListener("click", () => void run(true));
$("cancel").addEventListener("click", () => { stop(); status("Cancelled. You can try another chunk."); });
tabs.forEach((button, index) => {
  button.addEventListener("click", () => selectTab(button.dataset.tab));
  button.addEventListener("keydown", (event) => {
    let target;
    if (event.key === "ArrowRight") target = tabs[(index + 1) % tabs.length];
    if (event.key === "ArrowLeft") target = tabs[(index + tabs.length - 1) % tabs.length];
    if (event.key === "Home") target = tabs[0];
    if (event.key === "End") target = tabs.at(-1);
    if (target) { event.preventDefault(); target.focus(); selectTab(target.dataset.tab); }
  });
});
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(displayedText()); status("Copied to clipboard."); }
  catch { status("Clipboard unavailable. Select the output to copy it, or download the source.", true); }
});
$("download").addEventListener("click", () => {
  if (!last?.ok) return;
  const url = URL.createObjectURL(new Blob([last.source], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename + ".luau";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
fetch(new URL("../version.json", import.meta.url)).then((response) => response.ok ? response.json() : null)
  .then((version) => { if (version?.revision) $("revision").textContent = version.revision; })
  .catch(() => {});
