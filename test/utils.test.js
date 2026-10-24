const test = require("node:test");
const assert = require("node:assert");
const Utils = require("../js/utils.js");

test("formatBytes 输出人类可读的字节大小", () => {
  assert.strictEqual(Utils.formatBytes(0), "0 B");
  assert.strictEqual(Utils.formatBytes(1), "1 B");
  assert.strictEqual(Utils.formatBytes(1023), "1023 B");
  assert.strictEqual(Utils.formatBytes(1024), "1.0 KB");
  assert.strictEqual(Utils.formatBytes(1536), "1.5 KB");
  assert.strictEqual(Utils.formatBytes(1536000), "1.5 MB");
  assert.strictEqual(Utils.formatBytes(5 * 1024 ** 3), "5.0 GB");
});

test("formatBytes 对非法输入返回 0 B", () => {
  assert.strictEqual(Utils.formatBytes(-5), "0 B");
  assert.strictEqual(Utils.formatBytes(NaN), "0 B");
  assert.strictEqual(Utils.formatBytes(Infinity), "0 B");
  assert.strictEqual(Utils.formatBytes("1024"), "0 B");
});

test("clamp 限制数值范围", () => {
  assert.strictEqual(Utils.clamp(5, 0, 10), 5);
  assert.strictEqual(Utils.clamp(-1, 0, 10), 0);
  assert.strictEqual(Utils.clamp(11, 0, 10), 10);
});

test("computeTargetSize 按最长边等比缩放", () => {
  assert.deepStrictEqual(Utils.computeTargetSize(1920, 1080, 1280), { width: 1280, height: 720 });
  assert.deepStrictEqual(Utils.computeTargetSize(3000, 2000, 1000), { width: 1000, height: 667 });
  assert.deepStrictEqual(Utils.computeTargetSize(1000, 3000, 1500), { width: 500, height: 1500 });
});

test("computeTargetSize 未超限时保持原尺寸", () => {
  assert.deepStrictEqual(Utils.computeTargetSize(800, 600, null), { width: 800, height: 600 });
  assert.deepStrictEqual(Utils.computeTargetSize(800, 600, undefined), { width: 800, height: 600 });
  assert.deepStrictEqual(Utils.computeTargetSize(800, 600, 0), { width: 800, height: 600 });
  assert.deepStrictEqual(Utils.computeTargetSize(800, 600, 4096), { width: 800, height: 600 });
  assert.deepStrictEqual(Utils.computeTargetSize(1, 1, 1000), { width: 1, height: 1 });
});

test("computeTargetSize 缩放结果最小不小于 1px", () => {
  // 宽边缩到极限时短边不足 1px，应被钳制到 1 而不是 0
  assert.deepStrictEqual(Utils.computeTargetSize(3, 10000, 2), { width: 1, height: 2 });
});

test("parseMaxDim 解析合法输入并回退非法输入", () => {
  assert.strictEqual(Utils.parseMaxDim("2048", 4096), 2048);
  assert.strictEqual(Utils.parseMaxDim(" 2048 ", 4096), 2048);
  assert.strictEqual(Utils.parseMaxDim("1024.9", 4096), 1024);
  assert.strictEqual(Utils.parseMaxDim("", 4096), 4096);
  assert.strictEqual(Utils.parseMaxDim("abc", 4096), 4096);
  assert.strictEqual(Utils.parseMaxDim("0", 4096), 4096);
  assert.strictEqual(Utils.parseMaxDim("-5", 4096), 4096);
  assert.strictEqual(Utils.parseMaxDim(null, 4096), 4096);
});

test("savedPercent 计算压缩节省比例", () => {
  assert.strictEqual(Utils.savedPercent(1000, 750), 25);
  assert.strictEqual(Utils.savedPercent(1000, 0), 100);
  assert.strictEqual(Utils.savedPercent(1000, 1000), 0);
  assert.strictEqual(Utils.savedPercent(1000, 1200), 0, "变大时不应出现负数");
  assert.strictEqual(Utils.savedPercent(0, 0), 0);
});
