/*
 * imgslim 通用工具函数。
 * 同时运行在浏览器（window.ImgSlimUtils）和 Node 测试环境（module.exports）。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ImgSlimUtils = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var UNITS = ["B", "KB", "MB", "GB", "TB"];

  /** 将字节数格式化为易读字符串，例如 1536000 -> "1.5 MB"。 */
  function formatBytes(bytes) {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
      return "0 B";
    }
    var i = 0;
    var value = bytes;
    while (value >= 1024 && i < UNITS.length - 1) {
      value /= 1024;
      i += 1;
    }
    return (i === 0 ? String(Math.round(value)) : value.toFixed(1)) + " " + UNITS[i];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * 按最长边计算缩放后的尺寸。
   * maxDim 为 0/负数/undefined 时不缩放。
   */
  function computeTargetSize(width, height, maxDim) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return { width: 0, height: 0 };
    }
    var limit = Number(maxDim);
    if (!Number.isFinite(limit) || limit <= 0 || (width <= limit && height <= limit)) {
      return { width: Math.round(width), height: Math.round(height) };
    }
    var scale = limit / Math.max(width, height);
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  /** 解析用户输入的最大边长；非法输入回退到 fallback。 */
  function parseMaxDim(input, fallback) {
    var text = String(input == null ? "" : input).trim();
    if (text === "") {
      return fallback;
    }
    var n = Number(text);
    if (!Number.isFinite(n) || n <= 0) {
      return fallback;
    }
    return Math.floor(n);
  }

  /** 压缩节省的百分比，只会变大时返回 0。 */
  function savedPercent(originalSize, compressedSize) {
    if (typeof originalSize !== "number" || typeof compressedSize !== "number" || originalSize <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));
  }

  return {
    formatBytes: formatBytes,
    clamp: clamp,
    computeTargetSize: computeTargetSize,
    parseMaxDim: parseMaxDim,
    savedPercent: savedPercent,
  };
});
