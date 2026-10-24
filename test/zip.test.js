const test = require("node:test");
const assert = require("node:assert");
const Zip = require("../js/zip.js");

const encoder = new TextEncoder();

test("crc32 匹配标准测试向量", () => {
  // IEEE 802.3 CRC-32 的经典校验值
  assert.strictEqual(Zip.crc32(encoder.encode("123456789")), 0xcbf43926);
  assert.strictEqual(Zip.crc32(new Uint8Array(0)), 0);
});

test("crc32 对相同内容返回一致结果", () => {
  const data = encoder.encode("imgslim zip test");
  assert.strictEqual(Zip.crc32(data), Zip.crc32(data));
});

test("buildZip 生成的 ZIP 结构合法（单文件）", () => {
  const name = "hello.txt";
  const data = encoder.encode("hello imgslim");
  const zip = Buffer.from(Zip.buildZip([{ name, data }]));

  // 总长 = 本地头 30 + 文件名 + 数据 + 中央目录 46 + 文件名 + EOCD 22
  assert.strictEqual(zip.length, 30 + name.length + data.length + 46 + name.length + 22);

  // 本地文件头签名 PK\x03\x04
  assert.strictEqual(zip[0], 0x50);
  assert.strictEqual(zip[1], 0x4b);
  assert.strictEqual(zip[2], 0x03);
  assert.strictEqual(zip[3], 0x04);

  // 文件名紧跟本地头
  assert.strictEqual(zip.slice(30, 30 + name.length).toString(), name);

  // 中央目录签名
  const centralOffset = 30 + name.length + data.length;
  assert.strictEqual(zip.readUInt32LE(centralOffset), 0x02014b50);

  // EOCD 位于末尾 22 字节处
  const eocd = zip.length - 22;
  assert.strictEqual(zip.readUInt32LE(eocd), 0x06054b50);
  assert.strictEqual(zip.readUInt16LE(eocd + 8), 1, "entry count");
  assert.strictEqual(zip.readUInt32LE(eocd + 12), 46 + name.length, "central size");
  assert.strictEqual(zip.readUInt32LE(eocd + 16), centralOffset, "central offset");
});

test("buildZip 支持多文件且条目数正确", () => {
  const entries = [
    { name: "a.jpg", data: encoder.encode("aaa") },
    { name: "b.jpg", data: encoder.encode("bbbbb") },
    { name: "c.jpg", data: encoder.encode("cc") },
  ];
  const zip = Buffer.from(Zip.buildZip(entries));
  const eocd = zip.length - 22;
  assert.strictEqual(zip.readUInt16LE(eocd + 8), 3);
  assert.strictEqual(zip.readUInt16LE(eocd + 10), 3);

  // 第二个条目的 CRC 已正确写入其本地头
  const secondHeaderOffset = 30 + entries[0].name.length + entries[0].data.length;
  assert.strictEqual(zip.readUInt32LE(secondHeaderOffset + 14), Zip.crc32(entries[1].data));
});

test("buildZip 支持包含中文的文件名（UTF-8）", () => {
  const name = "图片-测试.jpg";
  const nameBytes = encoder.encode(name);
  const zip = Buffer.from(Zip.buildZip([{ name, data: encoder.encode("x") }]));

  // UTF-8 标志位 0x0800
  assert.strictEqual(zip.readUInt16LE(6), 0x0800);
  // 文件名长度按 UTF-8 字节数记录
  assert.strictEqual(zip.readUInt16LE(26), nameBytes.length);
});
