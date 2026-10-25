const test = require("node:test");
const assert = require("node:assert");
const Collage = require("../js/collage.js");

test("computeGrid 布局规则", () => {
  assert.deepStrictEqual(Collage.computeGrid(1), { cols: 1, rows: 1 });
  assert.deepStrictEqual(Collage.computeGrid(2), { cols: 2, rows: 1 }, "2 张排一行");
  assert.deepStrictEqual(Collage.computeGrid(3), { cols: 3, rows: 1 }, "3 张排一行");
  assert.deepStrictEqual(Collage.computeGrid(4), { cols: 2, rows: 2 }, "4 张田字格");
  assert.deepStrictEqual(Collage.computeGrid(5), { cols: 3, rows: 2 });
  assert.deepStrictEqual(Collage.computeGrid(6), { cols: 3, rows: 2 });
  assert.deepStrictEqual(Collage.computeGrid(9), { cols: 3, rows: 3 }, "9 张九宫格");
  assert.deepStrictEqual(Collage.computeGrid(16), { cols: 4, rows: 4 });
});

test("computeGrid 容忍非法输入", () => {
  assert.deepStrictEqual(Collage.computeGrid(0), { cols: 1, rows: 1 });
  assert.deepStrictEqual(Collage.computeGrid(-2), { cols: 1, rows: 1 });
  assert.deepStrictEqual(Collage.computeGrid(2.9), { cols: 2, rows: 1 });
});

test("coverDraw 横图进正方形格子：居中裁剪左右两侧", () => {
  // 2000x1000 的图放进 800x800 格子：scale = max(0.4, 0.8) = 0.8
  const r = Collage.coverDraw(2000, 1000, 800, 800);
  assert.strictEqual(r.sw, 1000);
  assert.strictEqual(r.sh, 1000);
  assert.strictEqual(r.sx, 500);
  assert.strictEqual(r.sy, 0);
});

test("coverDraw 竖图进正方形格子：居中裁剪上下", () => {
  const r = Collage.coverDraw(1000, 2000, 800, 800);
  assert.strictEqual(r.sw, 1000);
  assert.strictEqual(r.sh, 1000);
  assert.strictEqual(r.sx, 0);
  assert.strictEqual(r.sy, 500);
});

test("coverDraw 同比例图：无裁剪", () => {
  const r = Collage.coverDraw(1600, 1600, 800, 800);
  assert.strictEqual(r.sx, 0);
  assert.strictEqual(r.sy, 0);
  assert.strictEqual(r.sw, 1600);
  assert.strictEqual(r.sh, 1600);
});

test("containFit 等比缩小并居中", () => {
  // 2000x1000 放进 800x800：scale = 0.4，得 800x400，上下各留 200
  const r = Collage.containFit(2000, 1000, 800, 800);
  assert.strictEqual(r.dw, 800);
  assert.strictEqual(r.dh, 400);
  assert.strictEqual(r.dx, 0);
  assert.strictEqual(r.dy, 200);
});

test("containFit 长条图按较小边适配", () => {
  // 4000x500 放进 800x800：scale = min(0.2, 1.6) = 0.2 → 800x100
  const r = Collage.containFit(4000, 500, 800, 800);
  assert.strictEqual(r.dw, 800);
  assert.strictEqual(r.dh, 100);
  assert.strictEqual(r.dy, 350);
});

test("computeCanvasSize 四张图必须拼出正方形整体", () => {
  // 4 张 -> 田字格 2x2，且画布宽高相等
  assert.deepStrictEqual(Collage.computeGrid(4), { cols: 2, rows: 2 });
  const s = Collage.computeCanvasSize(4, 800, 8);
  assert.strictEqual(s.width, s.height, "4 张拼图的画布必须是正方形");
  assert.strictEqual(s.width, 2 * 800 + 8);
});

test("computeCanvasSize 网格尺寸与间距", () => {
  // 3 张一行：宽 = 3*800 + 2*8 = 2416，高 = 800
  const a = Collage.computeCanvasSize(3, 800, 8);
  assert.strictEqual(a.width, 2416);
  assert.strictEqual(a.height, 800);

  // 5 张 3x2：宽 = 3*800 + 2*8 = 2416，高 = 2*800 + 8 = 1608
  const b = Collage.computeCanvasSize(5, 800, 8);
  assert.strictEqual(b.cols, 3);
  assert.strictEqual(b.rows, 2);
  assert.strictEqual(b.width, 2416);
  assert.strictEqual(b.height, 1608);

  // 间距 0：宽 = 3*800
  const c = Collage.computeCanvasSize(3, 800, 0);
  assert.strictEqual(c.width, 2400);
  assert.strictEqual(c.height, 800);
});
