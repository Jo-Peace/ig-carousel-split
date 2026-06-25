import {
  clampCrop,
  computeDefaultCrop,
  getTargetSize,
  renderSourceCanvas,
} from "./splitter.js";

export function createCropEditor({
  container,
  canvas,
  zoomInput,
  resetButton,
  onChange,
}) {
  let image = null;
  let options = null;
  let targetSize = null;
  let crop = { scale: 1, offsetX: 0, offsetY: 0 };
  let pointers = new Map();
  let pinchStart = null;
  let panStart = null;

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  zoomInput?.addEventListener("input", () => {
    if (!image || !targetSize) return;
    const minScale = getMinScale();
    const maxScale = minScale * 4;
    const next = minScale + (maxScale - minScale) * (Number(zoomInput.value) / 100);
    crop = clampCrop({ ...crop, scale: next }, image, targetSize);
    draw();
    onChange?.(crop);
  });

  resetButton?.addEventListener("click", () => {
    resetCrop();
    draw();
    onChange?.(crop);
  });

  function setImage(img) {
    image = img;
  }

  function setOptions(nextOptions) {
    options = nextOptions;
    targetSize = getTargetSize(options);
    container.classList.toggle("hidden", !targetSize);

    if (!targetSize || !image) return;

    resetCrop();
    draw();
  }

  function resetCrop() {
    if (!image || !targetSize) return;
    crop = computeDefaultCrop(image, targetSize);
    syncZoomInput();
  }

  function getMinScale() {
    return Math.max(targetSize.width / image.width, targetSize.height / image.height);
  }

  function syncZoomInput() {
    if (!zoomInput) return;
    const minScale = getMinScale();
    const maxScale = minScale * 4;
    const percent = ((crop.scale - minScale) / (maxScale - minScale)) * 100;
    zoomInput.value = String(Math.round(Math.max(0, Math.min(100, percent))));
  }

  function getCrop() {
    return crop;
  }

  function getDisplayScale() {
    const rect = canvas.getBoundingClientRect();
    return rect.width / targetSize.width;
  }

  function draw() {
    if (!image || !targetSize) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const displayScale = rect.width / targetSize.width;
    const displayHeight = targetSize.height * displayScale;

    canvas.width = Math.round(rect.width * devicePixelRatio);
    canvas.height = Math.round(displayHeight * devicePixelRatio);
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, rect.width, displayHeight);

    const source = renderSourceCanvas(image, targetSize, crop);
    ctx.drawImage(source, 0, 0, rect.width, displayHeight);
    drawSliceGuides(ctx, rect.width, displayHeight);
  }

  function drawSliceGuides(ctx, width, height) {
    if (!options) return;

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    if (options.mode === "profile") {
      const [cols, rows] = options.gridSize.split("x").map(Number);
      for (let c = 1; c < cols; c++) {
        const x = (width * c) / cols;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        const y = (height * r) / rows;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else {
      const count = options.count;
      if (options.direction === "horizontal") {
        for (let i = 1; i < count; i++) {
          const x = (width * i) / count;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      } else {
        for (let i = 1; i < count; i++) {
          const y = (height * i) / count;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  function onPointerDown(event) {
    if (!targetSize) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      pinchStart = {
        distance: touchDistance(pts[0], pts[1]),
        scale: crop.scale,
      };
      panStart = null;
      return;
    }

    panStart = { x: event.clientX, y: event.clientY, crop: { ...crop } };
  }

  function onPointerMove(event) {
    if (!targetSize || !pointers.has(event.pointerId)) return;

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2 && pinchStart) {
      const pts = [...pointers.values()];
      const distance = touchDistance(pts[0], pts[1]);
      const ratio = distance / pinchStart.distance;
      crop = clampCrop(
        { ...crop, scale: pinchStart.scale * ratio },
        image,
        targetSize
      );
      syncZoomInput();
      draw();
      onChange?.(crop);
      return;
    }

    if (pointers.size === 1 && panStart) {
      const scale = getDisplayScale();
      const dx = (event.clientX - panStart.x) / scale;
      const dy = (event.clientY - panStart.y) / scale;
      crop = clampCrop(
        {
          ...panStart.crop,
          offsetX: panStart.crop.offsetX + dx,
          offsetY: panStart.crop.offsetY + dy,
        },
        image,
        targetSize
      );
      draw();
      onChange?.(crop);
    }
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) panStart = null;
  }

  function touchDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  window.addEventListener("resize", () => draw());

  return {
    setImage,
    setOptions,
    getCrop,
    resetCrop,
    draw,
  };
}