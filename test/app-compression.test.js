const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Utils = require("../js/utils.js");

// Exercise the actual app event handlers, with controllable Canvas completion
// and debounce timers so asynchronous request ordering is deterministic.
function app() {
  const elements = new Map();
  const encodes = [];
  const urls = [];
  const revoked = [];
  const timers = new Map();
  const requests = [];
  let nextTimer = 0;
  function element() {
    const handlers = {};
    const classes = new Set();
    return {
      children: [], value: "", files: [], disabled: false,
      classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name) { if (classes.has(name)) classes.delete(name); else classes.add(name); },
      },
      addEventListener(name, handler) { handlers[name] = handler; },
      fire(name) { return handlers[name]({ target: this }); },
      appendChild(child) { this.children.push(child); },
      set innerHTML(value) { this.children = []; },
      querySelector() { return element(); },
      querySelectorAll() { return []; },
    };
  }
  function get(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  }
  get("quality").value = "0.8";
  get("format").value = "auto";
  get("max-dim").value = "4096";
  class Image {
    constructor() { this.naturalWidth = 100; this.naturalHeight = 100; }
    set src(value) { queueMicrotask(() => this.onload()); }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8"), {
    window: {
      ImgSlimUtils: Utils,
      ImgSlimI18n: { t: key => key, applyStatic() {}, toggleLabel: () => "EN" },
    },
    document: {
      getElementById: get, querySelector: get, addEventListener() {},
      createElement(tag) {
        if (tag !== "canvas") return element();
        return {
          getContext: () => ({ drawImage() {} }),
          toBlob(callback, mime, quality) { encodes.push({ callback, mime, quality }); },
        };
      },
    },
    Image, navigator: {},
    URL: {
      createObjectURL(blob) { const url = "blob:" + urls.length; urls.push({ url, blob }); return url; },
      revokeObjectURL: url => revoked.push(url),
    },
    fetch(url) {
      if (url.endsWith("/health")) return Promise.reject(new Error("Offline test backend"));
      return new Promise((resolve, reject) => requests.push({ resolve, reject }));
    },
    AbortSignal: { timeout() {} },
    setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return {
    get, encodes, urls, revoked, requests, settle,
    async add(count = 1) {
      get("file-input").files = Array.from({ length: count }, (_, i) => ({ name: `image-${i}.png`, type: "image/png", size: 100 }));
      get("file-input").fire("change");
      await settle();
    },
    changeQuality(value) { get("quality").value = String(value); get("quality").fire("input"); },
    async debounce() {
      for (const [id, timer] of timers) {
        if (timer.delay === 400) { timers.delete(id); timer.callback(); }
      }
      await settle();
    },
    async complete(index, blob) { encodes[index].callback(blob); await settle(); },
  };
}

test("older compression cannot overwrite a newer result", async () => {
  const ui = app();
  await ui.add();
  ui.changeQuality(0.4);
  await ui.debounce();
  assert.deepEqual(ui.encodes.map(job => job.quality), [0.8, 0.4]);
  const latest = { type: "image/png", size: 40 };
  await ui.complete(1, latest);
  const latestUrl = ui.urls.find(entry => entry.blob === latest).url;
  const obsolete = { type: "image/png", size: 80 };
  await ui.complete(0, obsolete);
  assert.equal(ui.urls.some(entry => entry.blob === obsolete), false);
  assert.equal(ui.revoked.includes(latestUrl), false);
  const thumbnail = ui.get("results").children[0].children[0].children[0];
  assert.equal(thumbnail.src, latestUrl);
});

test("obsolete failures cannot replace successful results with errors", async () => {
  const ui = app();
  await ui.add();
  ui.changeQuality(0.4);
  await ui.debounce();
  await ui.complete(1, { type: "image/png", size: 40 });
  await ui.complete(0, null);
  assert.equal(ui.get("results").children[0].className, "card status-done");
  assert.equal(ui.get("download-all").disabled, false);
});

test("clear discards active results and skips queued images", async () => {
  const ui = app();
  await ui.add(2);
  ui.get("clear-all").fire("click");
  const obsolete = { type: "image/png", size: 80 };
  await ui.complete(0, obsolete);
  assert.equal(ui.urls.some(entry => entry.blob === obsolete), false);
  assert.equal(ui.encodes.length, 1);
  assert.equal(ui.get("results").children.length, 0);
  assert.equal(ui.get("download-all").disabled, true);
});

test("settings changes invalidate old work during the debounce delay", async () => {
  const ui = app();
  await ui.add(2);
  ui.changeQuality(0.4);
  const obsolete = { type: "image/png", size: 80 };
  await ui.complete(0, obsolete);
  assert.equal(ui.urls.some(entry => entry.blob === obsolete), false);
  assert.equal(ui.encodes.length, 1);
  await ui.debounce();
  assert.equal(ui.encodes.length, 2);
  assert.equal(ui.encodes[1].quality, 0.4);
});

test("current batch still processes all images and replaces old URLs", async () => {
  const ui = app();
  await ui.add(2);
  const first = { type: "image/png", size: 80 };
  await ui.complete(0, first);
  await ui.complete(1, { type: "image/png", size: 70 });
  assert.equal(ui.get("results").children.length, 2);
  assert.ok(ui.get("results").children.every(card => card.className === "card status-done"));
  ui.changeQuality(0.4);
  await ui.debounce();
  await ui.complete(2, { type: "image/png", size: 40 });
  assert.ok(ui.revoked.includes(ui.urls.find(entry => entry.blob === first).url));
  await ui.complete(3, { type: "image/png", size: 35 });
  assert.ok(ui.get("results").children.every(card => card.className === "card status-done"));
});

test("current failures remain visible and can recover after a settings change", async () => {
  const ui = app();
  await ui.add();
  await ui.complete(0, null);
  assert.equal(ui.get("results").children[0].className, "card status-error");
  assert.equal(ui.get("download-all").disabled, true);
  ui.changeQuality(0.4);
  await ui.debounce();
  await ui.complete(1, { type: "image/png", size: 40 });
  assert.equal(ui.get("results").children[0].className, "card status-done");
  assert.equal(ui.get("download-all").disabled, false);
});

test("cleared backend requests do not start Canvas fallback or show failure toasts", async () => {
  const ui = app();
  await ui.settle();
  ui.get("backend-toggle").classList.add("active");
  await ui.add();
  assert.equal(ui.requests.length, 1);
  ui.get("clear-all").fire("click");
  ui.requests[0].reject(new Error("Backend disconnected"));
  await ui.settle();
  assert.equal(ui.encodes.length, 0);
  assert.equal(ui.get("toast").classList.contains("show"), false);
  assert.equal(ui.get("results").children.length, 0);
});

test("active backend failures still fall back to Canvas compression", async () => {
  const ui = app();
  await ui.settle();
  ui.get("backend-toggle").classList.add("active");
  await ui.add();
  ui.requests[0].reject(new Error("Backend disconnected"));
  await ui.settle();
  assert.equal(ui.encodes.length, 1);
  await ui.complete(0, { type: "image/png", size: 40 });
  assert.equal(ui.get("results").children[0].className, "card status-done");
});
