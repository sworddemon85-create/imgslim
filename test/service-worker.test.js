const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8");

function storage() {
  const entries = new Map();
  return {
    entries,
    async open(name) {
      if (!entries.has(name)) entries.set(name, new Map());
      const cache = entries.get(name);
      return {
        async addAll() {},
        async put(request, response) { cache.set(request.url, response); },
      };
    },
    async keys() { return [...entries.keys()]; },
    async delete(name) { return entries.delete(name); },
    async match(request, options = {}) {
      const candidates = options.cacheName ? [entries.get(options.cacheName)] : entries.values();
      for (const cache of candidates) {
        if (!cache) continue;
        for (const [url, response] of cache) {
          if (url === request.url || (options.ignoreSearch && url.split("?")[0] === request.url.split("?")[0])) return response;
        }
      }
    },
  };
}

function worker(caches, scope, networkResponse = { ok: false, body: "network" }) {
  const handlers = {};
  const network = [];
  let claimed = false;
  vm.runInNewContext(source, {
    caches, URL,
    self: {
      registration: { scope }, location: new URL(scope),
      addEventListener: (name, handler) => { handlers[name] = handler; },
      async skipWaiting() {}, clients: { async claim() { claimed = true; } },
    },
    async fetch(request) {
      network.push(request.url);
      return networkResponse;
    },
  });
  return {
    network,
    get claimed() { return claimed; },
    async dispatch(name, request) {
      let response;
      const work = [];
      handlers[name]({ request, waitUntil: promise => work.push(promise), respondWith: promise => { response = promise; } });
      await Promise.all(work);
      return response;
    },
  };
}

test("installations at different scopes use separate caches", async () => {
  const caches = storage();
  await worker(caches, "https://example.com/one/").dispatch("install");
  await worker(caches, "https://example.com/two/").dispatch("install");
  assert.equal(caches.entries.size, 2);
});

test("activation only deletes older cache versions owned by this scope", async () => {
  const caches = storage();
  const app = worker(caches, "https://example.com/imgslim/");
  await app.dispatch("install");
  const [current] = await caches.keys();
  const old = current.replace(/imgslim-v[^:]*$/, "imgslim-old-test-version");
  assert.notEqual(old, current);
  await caches.open(old);
  await caches.open("other-project-v1");
  await caches.open("imgslim-v3"); // Legacy caches have no provable scope owner.
  await worker(caches, "https://example.com/other-imgslim/").dispatch("install");
  const keep = (await caches.keys()).filter(key => key !== old);
  await app.dispatch("activate");
  assert.deepEqual(await caches.keys(), keep);
  assert.equal(app.claimed, true);
});

test("fetch ignores matching responses in another application's cache", async () => {
  const caches = storage();
  const request = { method: "GET", url: "https://example.com/imgslim/js/app.js" };
  await (await caches.open("unrelated-cache")).put(request, { body: "foreign stale code" });
  const app = worker(caches, "https://example.com/imgslim/");
  await app.dispatch("install");
  const response = await app.dispatch("fetch", request);
  assert.equal(response.body, "network");
  assert.deepEqual(app.network, [request.url]);
});

test("fetch still serves this version's offline assets and bypasses POST", async () => {
  const caches = storage();
  const app = worker(caches, "https://example.com/imgslim/");
  await app.dispatch("install");
  const [current] = await caches.keys();
  const url = "https://example.com/imgslim/js/app.js";
  await (await caches.open(current)).put({ url }, { body: "current code" });
  assert.equal((await app.dispatch("fetch", { method: "GET", url: url + "?v=1" })).body, "current code");
  assert.equal(await app.dispatch("fetch", { method: "POST", url }), undefined);
  assert.deepEqual(app.network, []);
});

test("successful network responses are stored in the same scoped cache", async () => {
  const caches = storage();
  const response = { ok: true, body: "downloaded", clone() { return this; } };
  const app = worker(caches, "https://example.com/imgslim/", response);
  await app.dispatch("install");
  const [current] = await caches.keys();
  const request = { method: "GET", url: "https://example.com/imgslim/new.js" };
  assert.equal(await app.dispatch("fetch", request), response);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await caches.keys(), [current]);
  assert.equal(caches.entries.get(current).get(request.url), response);
  assert.equal(await app.dispatch("fetch", request), response);
  assert.equal(app.network.length, 1);
});
