const test = require('node:test');
const assert = require('node:assert/strict');
const { buildZip, crc32 } = require('../js/zip');
test('central directory fields agree with each local header', () => {
  const entries = [{name:'one.txt',data:Buffer.from('abc')},{name:'图片.txt',data:Buffer.from('second file')}];
  const zip = Buffer.from(buildZip(entries));
  let central = zip.readUInt32LE(zip.length - 6);
  let local = 0;
  for (const entry of entries) {
    const length = Buffer.byteLength(entry.name);
    assert.equal(zip.readUInt32LE(central), 0x02014b50);
    assert.equal(zip.readUInt16LE(central + 12), zip.readUInt16LE(local + 10), 'time');
    assert.equal(zip.readUInt16LE(central + 14), zip.readUInt16LE(local + 12), 'date');
    assert.equal(zip.readUInt32LE(central + 16), crc32(entry.data), 'CRC');
    assert.equal(zip.readUInt32LE(central + 20), entry.data.length, 'compressed size');
    assert.equal(zip.readUInt32LE(central + 24), entry.data.length, 'uncompressed size');
    assert.equal(zip.readUInt16LE(central + 28), length, 'filename length');
    assert.equal(zip.readUInt32LE(central + 42), local, 'local header offset');
    assert.equal(zip.subarray(central + 46, central + 46 + length).toString('utf8'), entry.name);
    local += 30 + length + entry.data.length;
    central += 46 + length;
  }
  assert.equal(central, zip.length - 22);
});
