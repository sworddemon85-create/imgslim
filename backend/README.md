# 🖥️ imgslim backend

**English** | 说明见 [使用说明.txt](使用说明.txt)

An optional local image-processing backend for imgslim. Runs on your machine, listens on `127.0.0.1:3210` only, and exposes the same compress/collage pipeline as the browser UI — usable from any HTTP client or the bundled CLI, no browser needed.

- **Compression** via [jimp](https://github.com/jimp-dev/jimp) (pure JS, no native binaries)
- **Privacy**: nothing leaves your machine; the server binds to loopback only
- The web UI auto-detects this backend (`/health`) and can route compression to it — see the toggle in the settings panel

## 🚀 Setup

Requires Node.js 18+:

```bash
cd backend
npm install          # installs jimp
npm start            # → http://127.0.0.1:3210
```

> Windows users without Node installed: copy `node.exe` (any recent x64 build) into this folder and run `node.exe server.js` — no install needed.

## 🔌 API

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/health` | GET | — | `{"ok":true,...}` |
| `/api/compress?quality=80&format=jpeg&maxdim=1080` | POST | raw image bytes | compressed bytes (`X-Original-Size`, `X-Compressed-Size`, `X-Width`, `X-Height` headers) |
| `/api/collage` | POST | JSON `{images: [base64...], cell, gap, fit, bg, format}` | collage bytes |

`format` for compress: `auto` (keep source) / `jpeg` / `png` / `bmp`. Collage options mirror the web UI (1–36 images; transparent background requires PNG).

## 🧰 CLI (no server needed)

```bash
# batch-compress a folder into ./compressed
node cli.js compress "D:\photos" --quality 80 --format jpeg

# single file
node cli.js compress photo.jpg

# stitch a folder into one grid image
node cli.js collage "D:\photos" --cell 800 --gap 8 --out collage.png
```

Exit behavior: if the default output folder isn't writable, the CLI falls back to the system temp directory and says so.

## 📄 License

[MIT](../LICENSE)
