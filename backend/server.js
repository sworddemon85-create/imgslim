/*
 * imgslim 后端服务：本机运行的图片处理 API（不依赖浏览器）。
 *
 * 端口默认 3210，仅监听 127.0.0.1（不对局域网开放）。
 *
 * 接口：
 *   GET  /health                          健康检查
 *   POST /api/compress?quality=80&format=jpeg&maxdim=4096
 *         请求体 = 原始图片字节；响应 = 压缩后的图片字节
 *   POST /api/collage
 *         请求体 = JSON { images: [base64...], cell, gap, fit, bg, format }
 *         响应 = 拼接后的图片字节
 */
const http = require("http");
const Jimp = require("jimp");
const Collage = require("./collage.js");

const PORT = Number(process.env.PORT) || 3210;
const MAX_BODY = 200 * 1024 * 1024; // 200MB

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("请求体超过 200MB 限制"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(obj));
}

function sendImage(res, buf, mime, extra) {
  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": buf.length,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "X-Original-Size,X-Compressed-Size,X-Width,X-Height",
    ...(extra || {}),
  });
  res.end(buf);
}

/* ---------- 压缩 ---------- */

async function processCompress(body, query) {
  const quality = clamp(parseInt(query.quality ?? "80", 10) || 80, 10, 100);
  const maxDim = clamp(parseInt(query.maxdim ?? "4096", 10) || 4096, 16, 20000);
  const format = String(query.format || "auto").toLowerCase();

  const img = await Jimp.read(body);
  const originalSize = body.length;
  const w = img.bitmap.width;
  const h = img.bitmap.height;

  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    img.resize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
  }

  let mime;
  if (format === "jpeg" || format === "jpg") mime = Jimp.MIME_JPEG;
  else if (format === "png") mime = Jimp.MIME_PNG;
  else if (format === "bmp") mime = Jimp.MIME_BMP;
  else mime = img.getMIME(); // auto：与原图一致

  if (mime === Jimp.MIME_JPEG) {
    img.quality(quality);
  }
  const out = await img.getBufferAsync(mime);
  return { buf: out, mime, originalSize, width: img.bitmap.width, height: img.bitmap.height };
}

/* ---------- 拼图 ---------- */

function createCanvas(w, h, hexOrInt) {
  return new Promise((resolve, reject) => {
    new Jimp(w, h, hexOrInt, (err, img) => (err ? reject(err) : resolve(img)));
  });
}

async function processCollage(payload) {
  const images = Array.isArray(payload.images) ? payload.images : [];
  if (images.length < 1 || images.length > 36) {
    throw new Error("images 需要 1-36 个 base64 编码的图片");
  }
  const cell = clamp(parseInt(payload.cell ?? 800, 10) || 800, 100, 2000);
  const gap = clamp(parseInt(payload.gap ?? 8, 10) || 0, 0, 100);
  const fit = payload.fit === "contain" ? "contain" : "cover";
  const format = payload.format === "jpeg" ? "jpeg" : "png";
  const bg = String(payload.bg || "#ffffff");

  const size = Collage.computeCanvasSize(images.length, cell, gap);
  const transparent = bg === "transparent";
  const canvas = await createCanvas(
    size.width,
    size.height,
    transparent ? 0x00000000 : Jimp.cssColorToHex(bg)
  );

  for (let i = 0; i < images.length; i++) {
    const img = await Jimp.read(Buffer.from(images[i], "base64"));
    if (fit === "cover") {
      img.cover(cell, cell);
    } else {
      img.contain(cell, cell);
    }
    const col = i % size.cols;
    const row = Math.floor(i / size.cols);
    canvas.composite(img, col * (cell + gap), row * (cell + gap));
  }

  const mime = format === "jpeg" ? Jimp.MIME_JPEG : Jimp.MIME_PNG;
  if (mime === Jimp.MIME_JPEG) canvas.quality(92);
  const buf = await canvas.getBufferAsync(mime);
  return { buf, mime, width: size.width, height: size.height, count: images.length };
}

/* ---------- 服务器 ---------- */

const server = http.createServer(async (req, res) => {

  const url = new URL(req.url, "http://127.0.0.1");
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      // 允许 https 页面（如 GitHub Pages）访问本机回环地址
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && path === "/health") {
      json(res, 200, { ok: true, service: "imgslim-backend", version: "1.0.0" });
      return;
    }

    if (req.method === "POST" && path === "/api/compress") {
      const body = await readBody(req);
      if (!body.length) throw new Error("请求体为空，请直接发送图片字节");
      const query = Object.fromEntries(url.searchParams);
      const out = await processCompress(body, query);
      console.log(
        `[compress] ${body.length}B -> ${out.buf.length}B  ${out.width}x${out.height}  ${out.mime}`
      );
      sendImage(res, out.buf, out.mime, {
        "X-Original-Size": String(out.originalSize),
        "X-Compressed-Size": String(out.buf.length),
        "X-Width": String(out.width),
        "X-Height": String(out.height),
      });
      return;
    }

    if (req.method === "POST" && path === "/api/collage") {
      const body = await readBody(req);
      const payload = JSON.parse(body.toString("utf8"));
      const out = await processCollage(payload);
      sendImage(res, out.buf, out.mime, {
        "X-Width": String(out.width),
        "X-Height": String(out.height),
        "X-Image-Count": String(out.count),
      });
      return;
    }

    json(res, 404, { ok: false, error: "接口不存在：可用 /health、/api/compress、/api/collage" });
  } catch (err) {
    json(res, 400, { ok: false, error: err.message || String(err) });
  }
});

// 供 cli.js 复用处理逻辑；直接运行本文件时才启动监听
if (require.main === module) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`imgslim 后端已启动: http://127.0.0.1:${PORT}（仅本机可访问）`);
    console.log("接口: /health | /api/compress | /api/collage");
  });
}

module.exports = { processCompress, processCollage };
