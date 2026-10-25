/*
 * imgslim i18n：中英双语。
 * 静态文案用 data-i18n 属性声明，动态文案用 I18n.t(key, params)。
 * 语言偏好存 localStorage，默认跟随浏览器语言。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ImgSlimI18n = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DICT = {
    zh: {
      docTitle: "imgslim — 纯前端图片压缩工具",
      tagline: "拖入即压缩 · 图片永不上传 · 纯浏览器本地处理",
      dropzoneTitle: "把图片拖到这里，或粘贴（Ctrl+V）",
      dropzoneSub: "支持 JPG / PNG / WebP，可多选、可拖入整个文件夹",
      browseBtn: "选择图片",
      presetsLabel: "常用预设：",
      presetChat: "微信/QQ 传图",
      presetFeed: "朋友圈",
      presetWeb: "网页用图",
      presetConvert: "仅转格式",
      qualityLabel: "压缩质量",
      formatLabel: "输出格式",
      formatAuto: "自动（与原图一致）",
      maxDimLabel: "最大边长（px）",
      backendToggle: "⚙ 用本地服务压缩",
      downloadAll: "打包下载 ZIP",
      collageBtn: "🧩 拼接为一张图",
      clearAll: "清空",
      hint: "改动上方设置后会自动重新压缩；点击缩略图可对比原图。",
      footerPrivacy: "🔒 所有处理均在你的浏览器本地完成，图片不会上传到任何服务器。",
      footerBuilt1: "用",
      footerBuilt2: "构建，零依赖",
      previewTitle: "压缩前后对比",
      close: "关闭",
      collageTitle: "🧩 图片拼接",
      collageCell: "每格尺寸",
      collageGap: "间距",
      collageFit: "填充方式",
      fitCover: "填满格子（居中裁剪多余部分）",
      fitContain: "完整显示（比例不同会留白）",
      collageBg: "背景",
      bgWhite: "白色",
      bgDark: "深色",
      bgTransparent: "透明（选 PNG 输出）",
      collageFormat: "输出格式",
      outWebp: "WebP（体积最小）",
      outJpeg: "JPEG（兼容性最好）",
      outPng: "PNG（无损/透明）",
      collageDownload: "下载拼图",

      working: "压缩中…",
      download: "下载",
      badgeBest: "已是最优",
      summary: "共 {n} 张，{a} → {b}，节省 {p}%",
      sizes: "{a} → {b}（{w}×{h}）",
      previewBefore: "原图 · {size}",
      previewAfter: "压缩后 · {size}（−{p}%）",
      collageInfo: "已拼接 {n} 张 → {w}×{h} px",
      collageFilePrefix: "拼图",
      skipNonImage: "已跳过非图片文件：{name}",
      maxFiles: "一次最多处理 {n} 张图片，已截断",
      decodeError: "浏览器无法解码该图片格式",
      encodeError: "编码失败，可能是浏览器不支持该输出格式",
      collageExportFail: "拼图导出失败",
      backendOn: "已开启本地服务压缩，之后的压缩将交给本机后端处理",
      backendOff: "已切回浏览器压缩",
      backendFail: "本地服务调用失败，本次已改用浏览器压缩",
      backendChecking: "正在检测本地服务…",
      backendConnected: "本地服务已连接 · 127.0.0.1:3210（{service} v{version}）",
      backendOffline: "本地服务未启动（点击重试）",
      backendTitleOff: "先双击 D:\\Download\\imgslim-backend\\启动后端.bat，再点这里重试",
      backendTitleOn: "压缩请求将发送到本机 3210 端口的 imgslim 后端处理",
      zipName: "{n}-images",
    },
    en: {
      docTitle: "imgslim — in-browser image compressor",
      tagline: "Drop. Compress. Never uploaded. 100% in your browser.",
      dropzoneTitle: "Drag images here, or paste (Ctrl+V)",
      dropzoneSub: "JPG / PNG / WebP — multiple files, entire folders",
      browseBtn: "Choose images",
      presetsLabel: "Presets:",
      presetChat: "Chat apps",
      presetFeed: "Social feed",
      presetWeb: "Web images",
      presetConvert: "Format only",
      qualityLabel: "Quality",
      formatLabel: "Output format",
      formatAuto: "Auto (same as source)",
      maxDimLabel: "Max dimension (px)",
      backendToggle: "⚙ Use local backend",
      downloadAll: "Download all as ZIP",
      collageBtn: "🧩 Combine into one",
      clearAll: "Clear",
      hint: "Changing settings recompresses automatically; click a thumbnail to compare.",
      footerPrivacy: "🔒 Everything runs locally in your browser — images are never uploaded.",
      footerBuilt1: "Built with",
      footerBuilt2: "— zero dependencies",
      previewTitle: "Before / after",
      close: "Close",
      collageTitle: "🧩 Image collage",
      collageCell: "Cell size",
      collageGap: "Gap",
      collageFit: "Fit mode",
      fitCover: "Fill cells (center-crop overflow)",
      fitContain: "Fit entirely (letterboxed)",
      collageBg: "Background",
      bgWhite: "White",
      bgDark: "Dark",
      bgTransparent: "Transparent (use PNG)",
      collageFormat: "Output format",
      outWebp: "WebP (smallest)",
      outJpeg: "JPEG (most compatible)",
      outPng: "PNG (lossless / alpha)",
      collageDownload: "Download collage",

      working: "Compressing…",
      download: "Download",
      badgeBest: "already optimal",
      summary: "{n} image(s), {a} → {b}, saved {p}%",
      sizes: "{a} → {b} ({w}×{h})",
      previewBefore: "Original · {size}",
      previewAfter: "Compressed · {size} (−{p}%)",
      collageInfo: "{n} image(s) combined → {w}×{h} px",
      collageFilePrefix: "collage",
      skipNonImage: "Skipped non-image file: {name}",
      maxFiles: "Capped at {n} images per batch",
      decodeError: "This image format can't be decoded by the browser",
      encodeError: "Encoding failed — the output format may be unsupported",
      collageExportFail: "Collage export failed",
      backendOn: "Backend compression enabled — images will be processed by your local service",
      backendOff: "Switched back to browser compression",
      backendFail: "Local backend call failed — used browser compression instead",
      backendChecking: "Detecting local backend…",
      backendConnected: "Local backend connected · 127.0.0.1:3210 ({service} v{version})",
      backendOffline: "Local backend not running (click to retry)",
      backendTitleOff: "Start D:\\Download\\imgslim-backend\\启动后端.bat first, then click to retry",
      backendTitleOn: "Compression requests are sent to the local backend on port 3210",
      zipName: "{n}-images",
    },
  };

  var STORAGE_KEY = "imgslim-lang";
  var current = null;

  function detect() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) { /* file:// 或隐私模式下忽略 */ }
    if (saved === "zh" || saved === "en") return saved;
    return (navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }

  function lang() {
    if (!current) current = detect();
    return current;
  }

  /** 取文案；params 形如 {name: "x"} 替换 {name} 占位符。 */
  function t(key, params) {
    var text = (DICT[lang()] && DICT[lang()][key]) || DICT.zh[key] || key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        text = text.split("{" + k + "}").join(String(params[k]));
      });
    }
    return text;
  }

  /** 把文案应用到所有带 data-i18n / data-i18n-title 的元素。 */
  function applyStatic() {
    var l = lang();
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
    document.title = t("docTitle");
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    }
    var titled = document.querySelectorAll("[data-i18n-title]");
    for (var j = 0; j < titled.length; j++) {
      titled[j].title = t(titled[j].getAttribute("data-i18n-title"));
    }
  }

  /** 切换语言并广播 langchange 事件（app.js 据此重渲染动态文案）。 */
  function setLang(l) {
    if (l !== "zh" && l !== "en") return;
    current = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch (e) { /* ignore */ }
    applyStatic();
    if (typeof document !== "undefined" && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: l } }));
    }
  }

  function toggle() {
    setLang(lang() === "zh" ? "en" : "zh");
  }

  /** 语言切换按钮上显示“另一种语言”。 */
  function toggleLabel() {
    return lang() === "zh" ? "EN" : "中文";
  }

  return { t: t, lang: lang, setLang: setLang, applyStatic: applyStatic, toggle: toggle, toggleLabel: toggleLabel };
});
