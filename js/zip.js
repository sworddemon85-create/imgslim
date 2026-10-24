/*
 * 零依赖的“仅存储（store）”ZIP 打包器。
 * 图片本身已是压缩格式，打包时无需再次压缩，store 模式最简单也最快。
 * 浏览器（window.ImgSlimZip）与 Node 测试环境（module.exports）通用。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ImgSlimZip = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function concat(chunks, totalLength) {
    var out = new Uint8Array(totalLength);
    var pos = 0;
    for (var i = 0; i < chunks.length; i++) {
      out.set(chunks[i], pos);
      pos += chunks[i].length;
    }
    return out;
  }

  // DOS 日期 1980-01-01，ZIP 规范允许的最早时间
  var DOS_DATE = 0x21;

  /**
   * files: [{ name: string, data: Uint8Array }]
   * 返回完整 ZIP 文件的 Uint8Array。
   */
  function buildZip(files) {
    var encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    if (!encoder) {
      throw new Error("TextEncoder is not available");
    }

    var chunks = [];
    var central = [];
    var offset = 0;

    files.forEach(function (file) {
      var nameBytes = encoder.encode(file.name);
      var data = file.data;
      var crc = crc32(data);

      var header = new DataView(new ArrayBuffer(30));
      header.setUint32(0, 0x04034b50, true); // local file header signature
      header.setUint16(4, 20, true); // version needed to extract
      header.setUint16(6, 0x0800, true); // general purpose flags: UTF-8 文件名
      header.setUint16(8, 0, true); // compression method: store
      header.setUint16(10, 0, true); // modification time
      header.setUint16(12, DOS_DATE, true); // modification date
      header.setUint32(14, crc, true);
      header.setUint32(18, data.length, true); // compressed size
      header.setUint32(22, data.length, true); // uncompressed size
      header.setUint16(26, nameBytes.length, true);
      header.setUint16(28, 0, true); // extra field length

      chunks.push(new Uint8Array(header.buffer), nameBytes, data);
      central.push({ name: nameBytes, crc: crc, size: data.length, offset: offset });
      offset += 30 + nameBytes.length + data.length;
    });

    var centralStart = offset;
    var centralSize = 0;
    central.forEach(function (entry) {
      var record = new DataView(new ArrayBuffer(46));
      record.setUint32(0, 0x02014b50, true); // central directory signature
      record.setUint16(4, 20, true); // version made by
      record.setUint16(6, 20, true); // version needed
      record.setUint16(8, 0x0800, true);
      record.setUint16(10, 0, true);
      record.setUint16(12, DOS_DATE, true);
      record.setUint32(14, entry.crc, true);
      record.setUint32(18, entry.size, true);
      record.setUint32(22, entry.size, true);
      record.setUint16(26, entry.name.length, true);
      record.setUint16(28, 0, true);
      record.setUint16(30, 0, true);
      record.setUint16(32, 0, true);
      record.setUint16(34, 0, true);
      record.setUint32(38, entry.offset, true); // local header offset

      chunks.push(new Uint8Array(record.buffer), entry.name);
      centralSize += 46 + entry.name.length;
    });

    var eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true); // end of central directory
    eocd.setUint16(8, central.length, true); // entries on this disk
    eocd.setUint16(10, central.length, true); // total entries
    eocd.setUint32(12, centralSize, true);
    eocd.setUint32(16, centralStart, true);
    chunks.push(new Uint8Array(eocd.buffer));

    return concat(chunks, offset + centralSize + 22);
  }

  return { crc32: crc32, buildZip: buildZip };
});
