/*
 * 零依赖的静态文件服务器，用于本地开发：npm start 后访问 http://localhost:8080
 * Canvas 的 toBlob 在 file:// 协议下部分浏览器受限，本地预览请走 HTTP。
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function createServer(root = ROOT) {
  root = path.resolve(root);
  return http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400).end("Bad Request");
      return;
    }
    if (urlPath.includes("\0")) {
      res.writeHead(400).end("Bad Request");
      return;
    }

    let filePath = path.join(root, urlPath);
    const relative = path.relative(root, filePath);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (urlPath.endsWith("/")) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404 Not Found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`imgslim 已启动: http://localhost:${PORT}`);
  });
}

module.exports = { createServer };
