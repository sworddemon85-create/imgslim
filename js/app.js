/*
 * imgslim 主逻辑：选图 -> Canvas 压缩 -> 预览/下载/打包 ZIP。
 * 所有处理都在浏览器本地完成，不经过任何服务器。
 */
(function () {
  "use strict";

  var Utils = window.ImgSlimUtils;
  var Zip = window.ImgSlimZip;
  var Collage = window.ImgSlimCollage;

  var QUALITY_DEFAULT = 0.8;
  var MAX_DIM_DEFAULT = 4096;
  var RESPRUSH_DELAY = 400;
  var COLLAGE_MAX_IMAGES = 36;
  var BACKEND_URL = "http://127.0.0.1:3210";

  var state = {
    items: [], // { id, file, status, blob, url, thumbUrl, width, height, error }
    nextId: 1,
  };

  var el = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("file-input"),
    browseBtn: document.getElementById("browse-btn"),
    presets: document.getElementById("presets"),
    quality: document.getElementById("quality"),
    qualityValue: document.getElementById("quality-value"),
    format: document.getElementById("format"),
    maxDim: document.getElementById("max-dim"),
    results: document.getElementById("results"),
    summary: document.getElementById("summary"),
    downloadAll: document.getElementById("download-all"),
    clearAll: document.getElementById("clear-all"),
    toast: document.getElementById("toast"),
    dialog: document.getElementById("preview-dialog"),
    dialogBody: document.getElementById("preview-body"),
    dialogClose: document.getElementById("preview-close"),
    collageBtn: document.getElementById("collage-btn"),
    collageDialog: document.getElementById("collage-dialog"),
    collageClose: document.getElementById("collage-close"),
    collageCell: document.getElementById("collage-cell"),
    collageCellLabel: document.getElementById("collage-cell-label"),
    collageGap: document.getElementById("collage-gap"),
    collageGapLabel: document.getElementById("collage-gap-label"),
    collageFit: document.getElementById("collage-fit"),
    collageBg: document.getElementById("collage-bg"),
    collageFormat: document.getElementById("collage-format"),
    collagePreview: document.getElementById("collage-preview"),
    collageInfo: document.getElementById("collage-info"),
    collageDownload: document.getElementById("collage-download"),
    backendDot: document.getElementById("backend-dot"),
    backendText: document.getElementById("backend-text"),
    backendToggle: document.getElementById("backend-toggle"),
  };

  // ---------- 基础工具 ----------

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      el.toast.classList.remove("show");
    }, 2600);
  }

  function currentSettings() {
    return {
      quality: Number(el.quality.value),
      format: el.format.value,
      maxDim: Utils.parseMaxDim(el.maxDim.value, MAX_DIM_DEFAULT),
    };
  }

  function outputMime(originalType, setting) {
    if (setting !== "auto") {
      return "image/" + setting;
    }
    return originalType === "image/jpeg" || originalType === "image/png" || originalType === "image/webp"
      ? originalType
      : "image/jpeg";
  }

  function extensionFor(mime) {
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return "jpg";
  }

  function baseName(name) {
    var dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(0, dot) : name;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("浏览器无法解码该图片格式"));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("编码失败，可能是浏览器不支持该输出格式"));
        },
        mime,
        quality
      );
    });
  }

  // ---------- 压缩 ----------

  // 浏览器本地压缩（Canvas 编码）
  function canvasCompress(item, settings) {
    return loadImage(item.file).then(function (img) {
      var target = Utils.computeTargetSize(img.naturalWidth, img.naturalHeight, settings.maxDim);
      var canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, target.width, target.height);

      var mime = outputMime(item.file.type, settings.format);
      return canvasToBlob(canvas, mime, settings.quality).then(function (blob) {
        return { blob: blob, width: target.width, height: target.height };
      });
    });
  }

  // 本地后端压缩（jimp 编码）；后端不支持 WebP 输出，需要时转 JPEG
  function backendFormatFor(originalType, setting) {
    if (setting === "webp") return "jpeg";
    if (setting !== "auto") return setting;
    return originalType === "image/png" ? "png" : "jpeg";
  }

  function backendCompress(item, settings) {
    var fmt = backendFormatFor(item.file.type, settings.format);
    var url =
      BACKEND_URL + "/api/compress?quality=" + Math.round(settings.quality * 100) +
      "&format=" + fmt + "&maxdim=" + settings.maxDim;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: item.file,
    }).then(function (res) {
      if (!res.ok) throw new Error("本地服务返回 " + res.status);
      return res.blob().then(function (blob) {
        return {
          blob: blob,
          width: parseInt(res.headers.get("X-Width"), 10) || 0,
          height: parseInt(res.headers.get("X-Height"), 10) || 0,
        };
      });
    });
  }

  function compressItem(item, settings) {
    var useBackend = el.backendToggle.classList.contains("active");
    var work = useBackend
      ? backendCompress(item, settings).catch(function (err) {
          toast("本地服务调用失败，本次已改用浏览器压缩");
          return canvasCompress(item, settings);
        })
      : canvasCompress(item, settings);

    return work
      .then(function (out) {
        if (item.url) URL.revokeObjectURL(item.url);
        item.blob = out.blob;
        item.url = URL.createObjectURL(out.blob);
        // 缩略图始终跟随最新结果，避免引用已被回收的旧 URL
        item.thumbUrl = item.url;
        item.width = out.width;
        item.height = out.height;
        item.status = "done";
        item.error = null;
      })
      .catch(function (err) {
        item.status = "error";
        item.error = err.message || "处理失败";
      });
  }

  function refreshAll() {
    var settings = currentSettings();
    var chain = Promise.resolve();
    state.items.forEach(function (item) {
      chain = chain.then(function () {
        item.status = "working";
        render();
        return compressItem(item, settings);
      });
    });
    chain.then(render);
  }

  var reschedule = (function () {
    var timer = null;
    return function () {
      if (!state.items.length) return;
      clearTimeout(timer);
      timer = setTimeout(refreshAll, RESPRUSH_DELAY);
    };
  })();

  // ---------- 渲染 ----------

  function render() {
    el.results.innerHTML = "";
    var totalOriginal = 0;
    var totalCompressed = 0;
    var doneCount = 0;

    state.items.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "card status-" + item.status;

      if (item.status === "error") {
        card.innerHTML =
          '<div class="card-error"><p class="file-name"></p><p class="error-text"></p></div>';
        card.querySelector(".file-name").textContent = item.file.name;
        card.querySelector(".error-text").textContent = item.error;
        el.results.appendChild(card);
        return;
      }

      var thumb = document.createElement("div");
      thumb.className = "card-thumb";
      if (item.thumbUrl) {
        var img = document.createElement("img");
        img.src = item.thumbUrl;
        img.alt = item.file.name;
        img.loading = "lazy";
        thumb.appendChild(img);
        thumb.addEventListener("click", function () {
          openPreview(item);
        });
      } else {
        thumb.textContent = "…";
      }

      var info = document.createElement("div");
      info.className = "card-info";
      var name = document.createElement("p");
      name.className = "file-name";
      name.title = item.file.name;
      name.textContent = item.file.name;
      info.appendChild(name);

      if (item.status === "done") {
        var saved = Utils.savedPercent(item.file.size, item.blob.size);
        var sizes = document.createElement("p");
        sizes.className = "sizes";
        sizes.textContent =
          Utils.formatBytes(item.file.size) + " → " + Utils.formatBytes(item.blob.size) +
          "（" + item.width + "×" + item.height + "）";
        var badge = document.createElement("span");
        badge.className = "badge" + (saved > 0 ? " saved" : "");
        badge.textContent = saved > 0 ? "−" + saved + "%" : "已是最优";
        var download = document.createElement("button");
        download.className = "btn btn-small";
        download.textContent = "下载";
        download.addEventListener("click", function () {
          downloadItem(item);
        });
        info.appendChild(sizes);
        info.appendChild(badge);
        info.appendChild(download);

        totalOriginal += item.file.size;
        totalCompressed += item.blob.size;
        doneCount += 1;
      } else {
        var working = document.createElement("p");
        working.className = "sizes";
        working.textContent = "压缩中…";
        info.appendChild(working);
      }

      card.appendChild(thumb);
      card.appendChild(info);
      el.results.appendChild(card);
    });

    var hasFiles = state.items.length > 0;
    document.querySelector(".results-panel").hidden = !hasFiles;
    if (doneCount > 0) {
      var totalSaved = Utils.savedPercent(totalOriginal, totalCompressed);
      el.summary.textContent =
        "共 " + doneCount + " 张，" + Utils.formatBytes(totalOriginal) + " → " +
        Utils.formatBytes(totalCompressed) + "，节省 " + totalSaved + "%";
      el.downloadAll.disabled = false;
      el.collageBtn.disabled = false;
    } else {
      el.summary.textContent = "";
      el.downloadAll.disabled = true;
      el.collageBtn.disabled = true;
    }
  }

  // ---------- 下载 ----------

  function triggerDownload(url, filename) {
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadItem(item) {
    var ext = extensionFor(item.blob.type);
    triggerDownload(item.url, baseName(item.file.name) + "-imgslim." + ext);
  }

  function downloadAllAsZip() {
    var done = state.items.filter(function (item) {
      return item.status === "done";
    });
    if (!done.length) return;

    var used = {};
    Promise.all(
      done.map(function (item, index) {
        return item.blob.arrayBuffer().then(function (buffer) {
          var ext = extensionFor(item.blob.type);
          var name = baseName(item.file.name) + "-imgslim." + ext;
          if (used[name]) name = baseName(item.file.name) + "-imgslim-" + (index + 1) + "." + ext;
          used[name] = true;
          return { name: name, data: new Uint8Array(buffer) };
        });
      })
    ).then(function (entries) {
      var zipBytes = Zip.buildZip(entries);
      var url = URL.createObjectURL(new Blob([zipBytes], { type: "application/zip" }));
      triggerDownload(url, "imgslim-" + done.length + "-images.zip");
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 10000);
    });
  }

  // ---------- 预览对比 ----------

  function openPreview(item) {
    if (item.status !== "done") return;
    el.dialogBody.innerHTML = "";

    loadImage(item.file).then(function (img) {
      var before = img.cloneNode ? img : new Image();
      if (before !== img) before.src = img.src;

      var after = document.createElement("img");
      after.src = item.url;

      var wrap = document.createElement("div");
      wrap.className = "compare";

      var beforeBox = document.createElement("figure");
      var beforeCaption = document.createElement("figcaption");
      beforeCaption.textContent = "原图 · " + Utils.formatBytes(item.file.size);
      beforeBox.appendChild(before);
      beforeBox.appendChild(beforeCaption);

      var afterBox = document.createElement("figure");
      var afterCaption = document.createElement("figcaption");
      afterCaption.textContent =
        "压缩后 · " + Utils.formatBytes(item.blob.size) + "（−" +
        Utils.savedPercent(item.file.size, item.blob.size) + "%）";
      afterBox.appendChild(after);
      afterBox.appendChild(afterCaption);

      wrap.appendChild(beforeBox);
      wrap.appendChild(afterBox);
      el.dialogBody.appendChild(wrap);
      el.dialog.showModal();
    });
  }

  // ---------- 图片拼接 ----------

  var renderCollageTimer = null;

  function loadBlobImage(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("解码失败"));
      };
      img.src = url;
    });
  }

  function scheduleCollageRender() {
    clearTimeout(renderCollageTimer);
    renderCollageTimer = setTimeout(renderCollage, 120);
  }

  function renderCollage() {
    var done = state.items
      .filter(function (item) {
        return item.status === "done";
      })
      .slice(0, COLLAGE_MAX_IMAGES);
    if (!done.length) return;

    var cell = Utils.clamp(parseInt(el.collageCell.value, 10) || 800, 200, 1600);
    var gap = Utils.clamp(parseInt(el.collageGap.value, 10) || 0, 0, 40);
    var fit = el.collageFit.value;
    var bg = el.collageBg.value;
    var mime = el.collageFormat.value;
    // JPEG 不支持透明，透明背景时强制 PNG
    if (bg === "transparent" && mime === "image/jpeg") {
      mime = "image/png";
      el.collageFormat.value = mime;
    }

    var size = Collage.computeCanvasSize(done.length, cell, gap);
    var canvas = el.collagePreview;
    canvas.width = size.width;
    canvas.height = size.height;
    var ctx = canvas.getContext("2d");
    if (bg !== "transparent") {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size.width, size.height);
    }

    Promise.all(
      done.map(function (item) {
        return loadBlobImage(item.blob);
      })
    ).then(function (images) {
      images.forEach(function (img, i) {
        var col = i % size.cols;
        var row = Math.floor(i / size.cols);
        var dx = col * (cell + gap);
        var dy = row * (cell + gap);
        if (fit === "cover") {
          var src = Collage.coverDraw(img.naturalWidth, img.naturalHeight, cell, cell);
          ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, dx, dy, cell, cell);
        } else {
          var r = Collage.containFit(img.naturalWidth, img.naturalHeight, cell, cell);
          ctx.drawImage(img, dx + r.dx, dy + r.dy, r.dw, r.dh);
        }
      });
      el.collageInfo.textContent =
        "已拼接 " + done.length + " 张 → " + size.width + "×" + size.height + " px";
    });
  }

  function downloadCollage() {
    var canvas = el.collagePreview;
    if (!canvas.width) return;
    var mime = el.collageFormat.value;
    var ext = extensionFor(mime);
    canvas.toBlob(
      function (blob) {
        if (!blob) {
          toast("拼图导出失败");
          return;
        }
        var url = URL.createObjectURL(blob);
        triggerDownload(url, "拼图-" + canvas.width + "x" + canvas.height + "-imgslim." + ext);
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 10000);
      },
      mime,
      0.9
    );
  }

  // ---------- 添加文件 ----------

  var MAX_FOLDER_FILES = 300;

  // 把拖入的目录递归展开成文件列表（只支持浏览器的 webkitGetAsEntry API）
  function expandEntries(list) {
    var files = [];
    var queue = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i]) queue.push(list[i]);
    }

    function drain() {
      if (!queue.length || files.length >= MAX_FOLDER_FILES) {
        if (files.length >= MAX_FOLDER_FILES) {
          toast("一次最多处理 " + MAX_FOLDER_FILES + " 张图片，已截断");
        }
        return Promise.resolve(files);
      }
      var entry = queue.shift();
      if (entry.isFile) {
        return new Promise(function (resolve) {
          entry.file(resolve, function () {
            resolve(null);
          });
        }).then(function (file) {
          if (file) files.push(file);
          return drain();
        });
      }
      if (entry.isDirectory) {
        var reader = entry.createReader();
        // readEntries 每次最多返回 100 条，需要循环读到空
        var readBatch = function () {
          return new Promise(function (resolve) {
            reader.readEntries(resolve, function () {
              resolve([]);
            });
          });
        };
        var readAll = function () {
          return readBatch().then(function (batch) {
            for (var j = 0; j < batch.length; j++) {
              queue.push(batch[j]);
            }
            return batch.length ? readAll() : drain();
          });
        };
        return readAll();
      }
      return drain();
    }

    return drain();
  }

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList).filter(function (file) {
      if (file.type.indexOf("image/") === 0) return true;
      toast("已跳过非图片文件：" + file.name);
      return false;
    });
    if (!files.length) return;

    files.forEach(function (file) {
      state.items.push({
        id: state.nextId++,
        file: file,
        status: "working",
        blob: null,
        url: null,
        thumbUrl: null,
        width: 0,
        height: 0,
        error: null,
      });
    });
    render();
    refreshAll();
  }

  function clearAll() {
    state.items.forEach(function (item) {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    state.items = [];
    render();
  }

  // ---------- 事件绑定 ----------

  el.browseBtn.addEventListener("click", function () {
    el.fileInput.click();
  });
  el.dropzone.addEventListener("click", function (event) {
    if (event.target === el.browseBtn) return;
    el.fileInput.click();
  });
  el.fileInput.addEventListener("change", function () {
    addFiles(el.fileInput.files);
    el.fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach(function (type) {
    el.dropzone.addEventListener(type, function (event) {
      event.preventDefault();
      el.dropzone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach(function (type) {
    el.dropzone.addEventListener(type, function (event) {
      event.preventDefault();
      el.dropzone.classList.remove("dragging");
    });
  });
  el.dropzone.addEventListener("drop", function (event) {
    if (!event.dataTransfer) return;
    var items = Array.prototype.slice.call(event.dataTransfer.items || []);
    if (!items.length) {
      if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
      return;
    }
    // items/getAsFile/webkitGetAsEntry 必须在事件回调内同步读取
    var entries = [];
    var directFiles = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.kind !== "file") continue;
      var entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
      if (entry) entries.push(entry);
      var file = item.getAsFile();
      if (file) directFiles.push(file);
    }
    if (!entries.length) {
      addFiles(directFiles);
      return;
    }
    expandEntries(entries).then(function (expanded) {
      // 合并两条路径的结果并按 名称+大小 去重；Entry 展开失败时兜底用直接文件
      var seen = {};
      expanded.forEach(function (f) {
        seen[f.name + "/" + f.size] = true;
      });
      var merged = expanded.slice();
      directFiles.forEach(function (f) {
        if (!seen[f.name + "/" + f.size]) merged.push(f);
      });
      addFiles(merged.length ? merged : directFiles);
    });
  });

  document.addEventListener("paste", function (event) {
    if (!event.clipboardData) return;
    var images = Array.prototype.slice.call(event.clipboardData.files).filter(function (file) {
      return file.type.indexOf("image/") === 0;
    });
    if (images.length) addFiles(images);
  });

  // ---------- 常用预设 ----------

  function clearActivePreset() {
    Array.prototype.forEach.call(el.presets.querySelectorAll(".chip"), function (chip) {
      chip.classList.remove("active");
    });
  }

  el.presets.addEventListener("click", function (event) {
    var chip = event.target.closest(".chip");
    if (!chip) return;
    el.quality.value = chip.dataset.quality;
    el.qualityValue.textContent = Math.round(chip.dataset.quality * 100) + "%";
    el.format.value = chip.dataset.format;
    el.maxDim.value = chip.dataset.maxdim;
    Array.prototype.forEach.call(el.presets.querySelectorAll(".chip"), function (c) {
      c.classList.toggle("active", c === chip);
    });
    reschedule();
  });

  el.quality.addEventListener("input", function () {
    el.qualityValue.textContent = Math.round(el.quality.value * 100) + "%";
    clearActivePreset();
    reschedule();
  });
  el.format.addEventListener("change", function () {
    clearActivePreset();
    reschedule();
  });
  el.maxDim.addEventListener("change", function () {
    clearActivePreset();
    reschedule();
  });

  el.downloadAll.addEventListener("click", downloadAllAsZip);
  el.clearAll.addEventListener("click", clearAll);
  el.dialogClose.addEventListener("click", function () {
    el.dialog.close();
  });

  // ---------- 拼接对话框事件 ----------

  el.collageBtn.addEventListener("click", function () {
    el.collageDialog.showModal();
    renderCollage();
  });
  el.collageClose.addEventListener("click", function () {
    el.collageDialog.close();
  });
  el.collageCell.addEventListener("input", function () {
    el.collageCellLabel.textContent = el.collageCell.value + "px";
    scheduleCollageRender();
  });
  el.collageGap.addEventListener("input", function () {
    el.collageGapLabel.textContent = el.collageGap.value + "px";
    scheduleCollageRender();
  });
  el.collageFit.addEventListener("change", renderCollage);
  el.collageBg.addEventListener("change", renderCollage);
  el.collageFormat.addEventListener("change", renderCollage);
  el.collageDownload.addEventListener("click", downloadCollage);

  // ---------- 本地服务连接 ----------

  function probeBackend() {
    el.backendText.textContent = "正在检测本地服务…";
    fetch(BACKEND_URL + "/health", { signal: AbortSignal.timeout(2000) })
      .then(function (res) {
        return res.ok ? res.json() : Promise.reject(new Error("HTTP " + res.status));
      })
      .then(function (data) {
        if (!data || !data.ok) throw new Error("bad response");
        el.backendDot.className = "backend-dot connected";
        el.backendText.textContent = "本地服务已连接 · 127.0.0.1:3210（" + data.service + " v" + data.version + "）";
        el.backendToggle.disabled = false;
        el.backendToggle.title = "压缩请求将发送到本机 3210 端口的 imgslim 后端处理";
      })
      .catch(function () {
        el.backendDot.className = "backend-dot offline";
        el.backendText.textContent = "本地服务未启动（点击重试）";
        el.backendToggle.disabled = true;
        el.backendToggle.classList.remove("active");
        el.backendToggle.title = "先双击 D:\\Download\\imgslim-backend\\启动后端.bat，再点这里重试";
      });
  }

  el.backendToggle.addEventListener("click", function () {
    if (el.backendToggle.disabled) {
      probeBackend();
      return;
    }
    el.backendToggle.classList.toggle("active");
    if (el.backendToggle.classList.contains("active")) {
      toast("已开启本地服务压缩，之后的压缩将交给本机后端处理");
    } else {
      toast("已切回浏览器压缩");
    }
  });

  el.backendText.addEventListener("click", probeBackend);
  el.qualityValue.textContent = Math.round(QUALITY_DEFAULT * 100) + "%";
  probeBackend();

  // PWA：注册 Service Worker，安装后可离线使用
  if ("serviceWorker" in navigator) {
    var isSecure =
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
    if (isSecure) {
      navigator.serviceWorker.register("./sw.js").catch(function () {
        // 离线缓存注册失败不影响正常使用
      });
    }
  }
})();
