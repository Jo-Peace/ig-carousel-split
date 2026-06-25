import { loadImage, splitImage, canvasToBlob } from "./splitter.js";

const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");
const controls = document.getElementById("controls");
const previewCard = document.getElementById("preview-card");
const slicesCard = document.getElementById("slices-card");
const carouselTrack = document.getElementById("carousel-track");
const carouselPreview = document.getElementById("carousel-preview");
const dotsEl = document.getElementById("dots");
const slicesGrid = document.getElementById("slices-grid");
const downloadAllBtn = document.getElementById("download-all-btn");
const downloadStatus = document.getElementById("download-status");
const sliceCountInput = document.getElementById("slice-count");
const sliceOutput = document.getElementById("slice-output");
const imageMeta = document.getElementById("image-meta");
const previewHint = document.getElementById("preview-hint");

let sourceImage = null;
let currentSlices = [];
let direction = "horizontal";
let ratioKey = "original";
let downloadingAll = false;

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

document.querySelectorAll("[data-direction]").forEach((btn) => {
  btn.addEventListener("click", () => {
    direction = btn.dataset.direction;
    document.querySelectorAll("[data-direction]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    previewHint.textContent =
      direction === "horizontal"
        ? "左右滑動查看接續效果"
        : "左右滑動查看上下接續（第 1 張在上）";
    render();
  });
});

document.querySelectorAll(".ratio-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    ratioKey = btn.dataset.ratio;
    document.querySelectorAll(".ratio-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    render();
  });
});

sliceCountInput.addEventListener("input", () => {
  sliceOutput.textContent = sliceCountInput.value;
  render();
});

downloadAllBtn.addEventListener("click", downloadAllSequential);

carouselPreview.addEventListener("scroll", updateDots);

async function handleFile(file) {
  try {
    sourceImage = await loadImage(file);
    controls.classList.remove("hidden");
    previewCard.classList.remove("hidden");
    slicesCard.classList.remove("hidden");
    imageMeta.textContent = `原始尺寸：${sourceImage.width} × ${sourceImage.height} px`;
    render();
  } catch (error) {
    alert(error.message || "讀取圖片失敗");
  }
}

function render() {
  if (!sourceImage) return;

  const count = Number(sliceCountInput.value);
  currentSlices = splitImage(sourceImage, { direction, count, ratioKey });
  renderPreview(currentSlices);
  renderGrid(currentSlices);
}

function renderPreview(slices) {
  carouselTrack.innerHTML = "";
  dotsEl.innerHTML = "";

  slices.forEach((slice, index) => {
    const slide = document.createElement("div");
    slide.className = "carousel-slide";
    const img = document.createElement("img");
    img.src = slice.canvas.toDataURL("image/jpeg", 0.9);
    img.alt = `第 ${slice.index} 張`;
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

function renderGrid(slices) {
  slicesGrid.innerHTML = "";
  slices.forEach((slice) => {
    const item = document.createElement("article");
    item.className = "slice-item";
    item.dataset.index = String(slice.index);

    const img = document.createElement("img");
    img.src = slice.canvas.toDataURL("image/jpeg", 0.9);
    img.alt = `第 ${slice.index} 張`;

    const badge = document.createElement("span");
    badge.className = "slide-badge";
    badge.textContent = `第 ${slice.index} 張`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-slice-download";
    btn.textContent = `下載第 ${slice.index} 張`;
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
  const filename = `ig-carousel-${String(slice.index).padStart(2, "0")}.jpg`;
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
    const item = slicesGrid.querySelector(`[data-index="${slice.index}"]`);
    const btn = item?.querySelector(".btn-slice-download");

    downloadStatus.classList.remove("hidden");
    downloadStatus.textContent = `請儲存第 ${slice.index} 張（共 ${currentSlices.length} 張）`;
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