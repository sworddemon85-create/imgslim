/*
 * imgslim 拼图模块：把 N 张图均匀排布进一张网格大图。
 * 纯几何计算，浏览器（window.ImgSlimCollage）与 Node 测试环境通用。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ImgSlimCollage = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * 计算 N 张图的网格布局。
   * 1-3 张排成一行；更多张取接近正方形的网格（列数 = ceil(sqrt(n))）。
   */
  function computeGrid(count) {
    var n = Math.max(1, Math.floor(Number(count) || 1));
    if (n <= 3) {
      return { cols: n, rows: 1 };
    }
    var cols = Math.ceil(Math.sqrt(n));
    return { cols: cols, rows: Math.ceil(n / cols) };
  }

  /**
   * “填满裁剪”模式：返回在原图上截取的矩形，使内容无变形地铺满格子。
   * 结果可直接作为 drawImage 的源矩形参数（居中裁剪）。
   */
  function coverDraw(imgW, imgH, cellW, cellH) {
    var scale = Math.max(cellW / imgW, cellH / imgH);
    var sw = cellW / scale;
    var sh = cellH / scale;
    return {
      sx: (imgW - sw) / 2,
      sy: (imgH - sh) / 2,
      sw: sw,
      sh: sh,
    };
  }

  /**
   * “完整显示”模式：等比缩小整张图放进格子并居中。
   * 返回目标矩形（drawImage 的 dx/dy/dw/dh，相对格子左上角）。
   */
  function containFit(imgW, imgH, cellW, cellH) {
    var scale = Math.min(cellW / imgW, cellH / imgH);
    var dw = imgW * scale;
    var dh = imgH * scale;
    return {
      dx: (cellW - dw) / 2,
      dy: (cellH - dh) / 2,
      dw: dw,
      dh: dh,
    };
  }

  /**
   * 画布总尺寸：格子网格 + 格子间间距（无外边距）。
   */
  function computeCanvasSize(count, cell, gap) {
    var grid = computeGrid(count);
    return {
      cols: grid.cols,
      rows: grid.rows,
      width: grid.cols * cell + (grid.cols - 1) * gap,
      height: grid.rows * cell + (grid.rows - 1) * gap,
    };
  }

  return {
    computeGrid: computeGrid,
    coverDraw: coverDraw,
    containFit: containFit,
    computeCanvasSize: computeCanvasSize,
  };
});
