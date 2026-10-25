/*
 * imgslim 命令行工具（不依赖浏览器，直接处理本地文件）
 *
 * 用法：
 *   node cli.js compress <图片文件或文件夹> [--quality 80] [--format auto|jpeg|png] [--maxdim 4096] [--out 输出目录]
 *   node cli.js collage <图片文件夹> [--out 拼图.png] [--cell 800] [--gap 8] [--fit cover|contain] [--bg #ffffff] [--format png|jpeg]
 *
 * 示例：
 *   node cli.js compress D:\照片 --quality 80 --format jpeg
 *   node cli.js collage D:\照片 --out D:\拼图.png
 */
const fs = require("fs");
const path = require("path");
const { processCompress, processCollage } = require("./server.js");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".bmp"]);
const EXT_BY_MIME = { "image/jpeg": ".jpg", "image/png": ".png", "image/bmp": ".bmp" };

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

function listImages(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (!IMAGE_EXT.has(path.extname(target).toLowerCase())) {
      throw new Error("不支持的图片格式: " + target);
    }
    return [target];
  }
  return fs
    .readdirSync(target)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort()
    .map((name) => path.join(target, name));
}

function ensureOutDir(preferred) {
  try {
    fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch (err) {
    // 目标位置没有写权限时回退到系统临时目录
    const os = require("os");
    const fallback = path.join(os.tmpdir(), "imgslim-output");
    fs.mkdirSync(fallback, { recursive: true });
    console.log(`提示: 无法在 ${preferred} 创建输出目录（${err.code}），改用 ${fallback}`);
    return fallback;
  }
}

async function cmdCompress(args) {
  const target = args._[0];
  if (!target) throw new Error("请指定要压缩的图片文件或文件夹");
  const files = listImages(target);
  if (!files.length) throw new Error("文件夹里没有可处理的图片");

  const defaultDir = fs.statSync(target).isDirectory()
    ? path.join(target, "compressed")
    : path.join(path.dirname(target), "compressed");
  const outDir = ensureOutDir(args.out || defaultDir);

  const query = { quality: args.quality || "80", format: args.format || "auto", maxdim: args.maxdim || "4096" };
  let totalOrig = 0;
  let totalComp = 0;
  let done = 0;

  for (const file of files) {
    try {
      const buf = fs.readFileSync(file);
      const out = await processCompress(buf, query);
      const ext = EXT_BY_MIME[out.mime] || ".jpg";
      const name = path.basename(file, path.extname(file)) + "-imgslim" + ext;
      fs.writeFileSync(path.join(outDir, name), out.buf);
      totalOrig += buf.length;
      totalComp += out.buf.length;
      done += 1;
      const saved = buf.length > 0 ? Math.max(0, Math.round(((buf.length - out.buf.length) / buf.length) * 100)) : 0;
      console.log(
        `${path.basename(file)}  ${(buf.length / 1024).toFixed(0)}KB -> ${(out.buf.length / 1024).toFixed(0)}KB  (-${saved}%)  [${out.width}x${out.height}]`
      );
    } catch (err) {
      console.error(`跳过 ${path.basename(file)}: ${err.message}`);
    }
  }

  const saved = totalOrig > 0 ? Math.max(0, Math.round(((totalOrig - totalComp) / totalOrig) * 100)) : 0;
  console.log(`\n完成 ${done}/${files.length} 个文件，共 ${(totalOrig / 1048576).toFixed(1)}MB -> ${(totalComp / 1048576).toFixed(1)}MB（省 ${saved}%）`);
  console.log(`输出目录: ${outDir}`);
}

async function cmdCollage(args) {
  const target = args._[0];
  if (!target) throw new Error("请指定包含图片的文件夹");
  const files = listImages(target);
  if (files.length < 1) throw new Error("文件夹里没有可拼接的图片");
  if (files.length > 36) throw new Error("最多拼接 36 张（当前 " + files.length + " 张）");

  const payload = {
    images: files.map((f) => fs.readFileSync(f).toString("base64")),
    cell: args.cell || 800,
    gap: args.gap ?? 8,
    fit: args.fit || "cover",
    bg: args.bg || "#ffffff",
    format: args.format || "png",
  };
  const out = await processCollage(payload);
  const ext = out.mime === "image/jpeg" ? ".jpg" : ".png";
  const outFile = args.out || path.join(target, "拼图-" + out.width + "x" + out.height + ext);
  fs.writeFileSync(outFile, out.buf);
  console.log(`已拼接 ${out.count} 张 -> ${out.width}x${out.height}px`);
  console.log(`输出文件: ${outFile} (${(out.buf.length / 1024).toFixed(0)}KB)`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._.shift();
  if (cmd === "compress") return cmdCompress(args);
  if (cmd === "collage") return cmdCollage(args).catch((err) => { console.error("错误: " + err.message); process.exit(1); });
  console.log(fs.readFileSync(path.join(__dirname, "使用说明.txt"), "utf8"));
}

main();
