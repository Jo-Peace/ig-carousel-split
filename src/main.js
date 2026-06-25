import {
  loadImage,
  splitImage,
  canvasToBlob,
  canvasToDataUrl,
  getTargetSize,
} from "./splitter.js";
import { createCropEditor } from "./crop-editor.js";

const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");
const controls = document.getElementById("controls");
const carouselControls = document.getElementById("carousel-controls");
const profileControls = document.getElementById("profile-controls");
const originalPreviewCard = document.getElementById("original-preview-card");
const assemblyPreviewCard = document.getElementById("assembly-preview-card");
const modePreviewCard = document.getElementById("mode-preview-card");
const slicesCard = document.getElementById("slices-card");
const originalPreviewImg = document.getElementById("original-preview");
const assemblyStatic = document.getElementById("assembly-static");
const assemblyPreviewImg = document.getElementById("assembly-preview");
const assemblyHint = document.getElementById("assembly-hint");
const modePreviewTitle = document.getElementById("mode-preview-title");
const carouselPreviewWrap = document.getElementById("carousel-preview-wrap");
const profilePreviewWrap = document.getElementById("profile-preview-wrap");
const carouselTrack = document.getElementById("carousel-track");
const carouselPreview = document.getElementById("carousel-preview");
const profileGrid = document.getElementById("profile-grid");
const dotsEl = document.getElementById("dots");
const slicesGrid = document.getElementById("slices-grid");
const downloadAllBtn = document.getElementById("download-all-btn");
const downloadStatus = document.getElementById("download-status");
const sliceCountInput = document.getElementById("slice-count");
const sliceOutput = document.getElementById("slice-output");
const imageMeta = document.getElementById("image-meta");
const previewHint = document.getElementById("preview-hint");
const slicesHint = document.getElementById("slices-hint");

let sourceImage = null;
let currentSlices = [];
let mode = "carousel";
let direction = "horizontal";
let ratioKey = "1:1";
let gridSize = "3x1";
let downloadingAll = false;

const cropEditor = createCropEditor({
  container: document.getElementById("crop-editor"),
  canvas: document.getElementById("crop-canvas"),
  zoomInput: document.getElementById("crop-zoom"),
  resetButton: document.getElementById("crop-reset"),
  onChange: () => renderSlices(),
});

uploadZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("dragover");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    carouselControls.classList.toggle("hidden", mode !== "carousel");
    profileControls.classList.toggle("hidden", mode !== "profile");
    updateHints();
    updateCropUI();
  });
});

document.querySelectorAll("[data-direction]").forEach((btn) => {
  btn.addEventListener("click", () => {
    direction = btn.dataset.direction;
    document.querySelectorAll("[data-direction]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateHints();
    updateCropUI();
  });
});

document.querySelectorAll(".grid-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    gridSize = btn.dataset.grid;
    document.querySelectorAll(".grid-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateCropUI();
  });
});

document.querySelectorAll(".ratio-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    ratioKey = btn.dataset.ratio;
    document.querySelectorAll(".ratio-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateCropUI();
  });
});

sliceCountInput.addEventListener("input", () => {
  sliceOutput.textContent = sliceCountInput.value;
  updateCropUI();
});

downloadAllBtn.addEventListener("click", downloadAllSequential);
carouselPreview.addEventListener("scroll", updateDots);

function getOptions() {
  const options = {
    mode,
    direction,
    count: Number(sliceCountInput.value),
    gridSize,
    ratioKey,
  };
  const crop = cropEditor.getCrop();
  if (getTargetSize(options)) {
    options.crop = crop;
  }
  return options;
}

function getBaseOptions() {
  return {
    mode,
    direction,
    count: Number(sliceCountInput.value),
    gridSize,
    ratioKey,
  };
}

function updateHints() {
  if (mode === "carousel") {
    modePreviewTitle.textContent = "輪播預覽";
    previewHint.textContent =
      direction === "horizontal"
        ? "左右滑動查看接續效果"
        : "左右滑動查看上下接續（第 1 張在左）";
    slicesHint.textContent = "依序上傳到同一則 IG 輪播（第 1 張 → 第 2 張 → …）";
  } else {
    modePreviewTitle.textContent = "主頁九宮格預覽";
    previewHint.textContent = "模擬 IG 個人主頁上看到的組合效果";
    slicesHint.textContent = "請依「發文順序」發佈（先發第 1 張，最後發完）";
  }

  const hasCrop = ratioKey !== "original";
  assemblyHint.textContent = hasCrop
    ? "拖曳移動裁切範圍，白線為切割位置，確認後再下載"
    : "原始比例使用完整圖片，確認後再下載";
}

async function handleFile(file) {
  try {
    sourceImage = await loadImage(file);
    cropEditor.setImage(sourceImage);
    originalPreviewImg.src = canvasToDataUrl(toPreviewCanvas(sourceImage));
    controls.classList.remove("hidden");
    originalPreviewCard.classList.remove("hidden");
    assemblyPreviewCard.classList.remove("hidden");
    modePreviewCard.classList.remove("hidden");
    slicesCard.classList.remove("hidden");
    imageMeta.textContent = `原始尺寸：${sourceImage.width} × ${sourceImage.height} px`;
    updateHints();
    updateCropUI();
  } catch (error) {
    alert(error.message || "讀取圖片失敗");
  }
}

function toPreviewCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return canvas;
}

function updateCropUI() {
  if (!sourceImage) return;

  const baseOptions = getBaseOptions();
  const hasCrop = getTargetSize(baseOptions) !== null;

  cropEditor.setOptions(baseOptions);
  document.getElementById("crop-editor").classList.toggle("hidden", !hasCrop);
  assemblyStatic.classList.toggle("hidden", hasCrop);

  if (!hasCrop) {
    renderSlices();
    return;
  }

  requestAnimationFrame(() => {
    cropEditor.draw();
    renderSlices();
  });
}

function renderSlices() {
  if (!sourceImage) return;

  const result = splitImage(sourceImage, getOptions());
  currentSlices = result.slices;

  if (!getTargetSize(getBaseOptions())) {
    assemblyPreviewImg.src = canvasToDataUrl(result.source);
  }

  renderModePreview(result);
  renderDownloadGrid(currentSlices);
  updateModePreviewVisibility();
}

function updateModePreviewVisibility() {
  const isCarousel = mode === "carousel";
  carouselPreviewWrap.classList.toggle("hidden", !isCarousel);
  profilePreviewWrap.classList.toggle("hidden", isCarousel);
}

function renderModePreview(result) {
  if (mode === "carousel") {
    renderCarouselPreview(result.slices);
  } else {
    renderProfilePreview(result.slices, result.cols, result.rows);
  }
}

function renderCarouselPreview(slices) {
  carouselTrack.innerHTML = "";
  dotsEl.innerHTML = "";

  slices.forEach((slice, index) => {
    const slide = document.createElement("div");
    slide.className = "carousel-slide";
    const img = document.createElement("img");
    img.src = canvasToDataUrl(slice.canvas);
    img.alt = slice.label;
    const badge = document.createElement("span");
    badge.className = "slide-badge";
    badge.textContent = `${slice.index} / ${slices.length}`;
    slide.append(img, badge);
    carouselTrack.appendChild(slide);

    const dot = document.createElement("span");
    dot.className = `dot${index === 0 ? " active" : ""}`;
    dotsEl.appendChild(dot);
  });
}

function renderProfilePreview(slices, cols, rows) {
  profileGrid.innerHTML = "";
  profileGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const byVisual = [...slices].sort((a, b) => a.index - b.index);
  byVisual.forEach((slice) => {
    const cell = document.createElement("div");
    cell.className = "profile-cell";
    const img = document.createElement("img");
    img.src = canvasToDataUrl(slice.canvas);
    img.alt = slice.label;
    const badge = document.createElement("span");
    badge.className = "cell-badge";
    badge.textContent = slice.index;
    cell.append(img, badge);
    profileGrid.appendChild(cell);
  });
}

function renderDownloadGrid(slices) {
  slicesGrid.innerHTML = "";
  slices.forEach((slice) => {
    const item = document.createElement("article");
    item.className = "slice-item";
    item.dataset.index = String(slice.postOrder);

    const img = document.createElement("img");
    img.src = canvasToDataUrl(slice.canvas);
    img.alt = slice.label;

    const badge = document.createElement("span");
    badge.className = "slide-badge";
    badge.textContent =
      mode === "profile"
        ? `${slice.label} · ${slice.postLabel}`
        : slice.label;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-slice-download";
    btn.textContent =
      mode === "profile"
        ? `下載 ${slice.postLabel}`
        : `下載第 ${slice.index} 張`;
    btn.addEventListener("click", () => downloadSlice(slice, btn));

    item.append(img, badge, btn);
    slicesGrid.appendChild(item);
  });
}

function updateDots() {
  const slideWidth = carouselPreview.clientWidth;
  const index = Math.round(carouselPreview.scrollLeft / slideWidth);
  dotsEl.querySelectorAll(".dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
}

async function downloadSlice(slice, button) {
  const blob = await canvasToBlob(slice.canvas);
  const prefix = mode === "profile" ? "ig-profile" : "ig-carousel";
  const filename = `${prefix}-${String(slice.postOrder).padStart(2, "0")}.jpg`;
  triggerDownload(blob, filename);

  if (button) {
    const original = button.textContent;
    button.textContent = "已觸發下載 ✓";
    button.classList.add("done");
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove("done");
    }, 2000);
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadAllSequential() {
  if (!currentSlices.length || downloadingAll) return;

  downloadingAll = true;
  downloadAllBtn.disabled = true;

  for (let i = 0; i < currentSlices.length; i++) {
    const slice = currentSlices[i];
    const item = slicesGrid.querySelector(`[data-index="${slice.postOrder}"]`);
    const btn = item?.querySelector(".btn-slice-download");

    downloadStatus.classList.remove("hidden");
    downloadStatus.textContent =
      mode === "profile"
        ? `請儲存 ${slice.postLabel}（共 ${currentSlices.length} 張）`
        : `請儲存第 ${slice.index} 張（共 ${currentSlices.length} 張）`;
    item?.scrollIntoView({ behavior: "smooth", block: "center" });
    item?.classList.add("highlight");
    btn?.classList.add("pulse");

    await downloadSlice(slice, btn);
    await wait(1200);
    item?.classList.remove("highlight");
    btn?.classList.remove("pulse");
  }

  downloadStatus.textContent = "全部已觸發！請確認相簿或下載項目。";
  downloadingAll = false;
  downloadAllBtn.disabled = false;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}