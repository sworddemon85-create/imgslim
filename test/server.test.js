const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { once } = require("node:events");
const { createServer } = require("../server.js");

async function fixture(t) {
  const base = await fs.mkdtemp(path.join(__dirname, ".server-test-"));
  const root = path.join(base, "public");
  const server = createServer(root);
  t.after(async () => {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    const relative = path.relative(__dirname, base);
    assert.ok(relative.startsWith(".server-test-") && !relative.includes(path.sep));
    await fs.rm(base, { recursive: true, force: true });
  });
  await fs.mkdir(root);
  await fs.mkdir(path.join(base, "public-private"));
  await fs.writeFile(path.join(root, "index.html"), "<h1>Home</h1>");
  await fs.writeFile(path.join(root, "space name.txt"), "normal file");
  await fs.writeFile(path.join(base, "public-private", "secret.txt"), "outside root");
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return requestPath => new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port: server.address().port, path: requestPath }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      res.on("error", reject);
    });
    req.setTimeout(1500, () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
  });
}

test("serves index and encoded filenames and returns 404 for missing files", async t => {
  const get = await fixture(t);
  const index = await get("/?preview=1");
  assert.equal(index.status, 200);
  assert.equal(index.body, "<h1>Home</h1>");
  assert.equal(index.headers["content-type"], "text/html; charset=utf-8");
  assert.equal((await get("/space%20name.txt")).body, "normal file");
  assert.equal((await get("/missing.txt")).status, 404);
});

test("rejects traversal into a sibling whose name shares the root prefix", async t => {
  const get = await fixture(t);
  assert.equal((await get("/..%2fpublic-private%2fsecret.txt")).status, 403);
  if (process.platform === "win32") {
    assert.equal((await get("/..%5cpublic-private%5csecret.txt")).status, 403);
  }
  assert.equal((await get("/")).status, 200);
});

test("returns 400 for malformed encoding and continues serving requests", async t => {
  const get = await fixture(t);
  for (const requestPath of ["/%", "/%E0%A4%A", "/%00"]) {
    assert.equal((await get(requestPath)).status, 400);
  }
  assert.equal((await get("/")).status, 200);
});
