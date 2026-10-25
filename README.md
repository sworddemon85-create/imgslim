# 🗜️ imgslim

**English** | [中文](README.zh-CN.md)

[![CI](https://github.com/sworddemon85-create/imgslim/actions/workflows/ci.yml/badge.svg)](https://github.com/sworddemon85-create/imgslim/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-GitHub%20Pages-4f5dff)](https://sworddemon85-create.github.io/imgslim/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**A privacy-friendly image compressor that runs entirely in your browser.** Drop images in, compress them, convert formats, batch-download as ZIP, or stitch several into one grid collage. Nothing is ever uploaded — all processing happens on your device, and it works offline.

## ✨ Features

- **Private by design** — compression uses the Canvas API locally; zero network requests, works with the network unplugged
- **Zero dependencies, zero build step** — no framework, no bundler, no third-party libraries (the ZIP packer is hand-rolled, CRC32 included)
- **One-click presets** — chat-app sharing, web images, format-only conversion
- **Batch processing** — multi-select, drag & drop (whole folders supported), Ctrl+V paste, one-click ZIP download
- **Format conversion** — output JPEG / PNG / WebP, or keep the original format
- **Adjustable quality & size** — quality slider plus max-dimension cap; changes recompress automatically
- **Grid collage** — combine multiple images into one evenly-spaced grid (4 images always produce a perfect square)
- **Installable PWA** — install it and use it fully offline
- **Before/after comparison** — click a thumbnail to compare quality
- **Dark mode** — follows your system preference
- **Optional local backend** — if the companion local service is running, compression can be delegated to it (auto-detected, with browser fallback). The backend lives in [`backend/`](backend/) and also works standalone over HTTP or a CLI

## 🖥️ Try it

Open the GitHub Pages deployment:

**https://sworddemon85-create.github.io/imgslim/**

## 🚀 Run locally

Requires Node.js 18+ (only for the dev server and tests — the page itself has no dependencies):

```bash
git clone https://github.com/sworddemon85-create/imgslim.git
cd imgslim
npm start          # http://localhost:8080
```

> Opening `index.html` directly also works, but some browsers restrict Canvas features on the `file://` protocol.

## 🧪 Tests

```bash
npm test           # node --test — 22 unit tests
```

Covers `js/utils.js` (byte formatting, aspect-ratio scaling), `js/zip.js` (CRC32 test vectors, ZIP structure), and `js/collage.js` (grid layout, center-crop math, square-canvas guarantee for 4 images).

## 📁 Project structure

```
imgslim/
├── index.html            # page entry
├── css/style.css         # styles (light/dark adaptive)
├── js/utils.js           # shared helpers (browser/Node)
├── js/zip.js             # zero-dependency store-mode ZIP writer
├── js/collage.js         # collage geometry (grid/cover/contain)
├── js/app.js             # main logic: pick → compress → preview/download
├── sw.js                 # service worker: offline cache
├── manifest.webmanifest  # PWA manifest
├── icons/                # app icons (192/512)
├── server.js             # zero-dependency dev server
├── backend/              # optional local processing backend (HTTP API + CLI, jimp)
├── test/                 # node:test unit tests
└── .github/workflows/    # CI + GitHub Pages deployment
```

## 🛠️ How it works

- Compression draws each image onto a canvas scaled to the max dimension, then re-encodes via `canvas.toBlob()` with the chosen MIME type and quality
- The ZIP writer implements the **store (no-compression)** format by hand — images are already compressed, so it only writes local file headers, the central directory, and CRC32 checksums
- The optional local backend (see [imgslim-backend](https://github.com/sworddemon85-create) companion folder) exposes `/api/compress` and `/api/collage` on `127.0.0.1:3210`; the page auto-detects it and can route compression there, falling back to the browser if it fails

## ⚠️ Known limitations

- Animated GIFs are flattened to their first frame (Canvas limitation)
- Older browsers (e.g. old Safari) may not export WebP — pick JPEG/PNG there
- HEIC/HEIF support depends on system codecs and usually fails with a clear error

## 🤝 Contributing

Issues and PRs welcome! Please make sure `npm test` passes before submitting.

## 📄 License

[MIT](LICENSE)
