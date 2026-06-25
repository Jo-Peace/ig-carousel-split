const RATIO_MAP = {
  "4:5": 4 / 5,
  "1:1": 1,
  original: null,
};

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法讀取圖片"));
    };
    img.src = url;
  });
}

export function getTargetSize(options) {
  if (options.ratioKey === "original") {
    return null;
  }

  if (options.mode === "profile") {
    const { cols, rows } = parseGridSize(options.gridSize);
    const ratio = RATIO_MAP[options.ratioKey] ?? 1;
    return {
      width: 1080 * cols,
      height: Math.round((1080 / ratio) * rows),
    };
  }

  const ratio = RATIO_MAP[options.ratioKey];
  if (!ratio) return null;

  if (options.direction === "horizontal") {
    return {
      width: 1080 * options.count,
      height: Math.round(1080 / ratio),
    };
  }

  return {
    width: 1080,
    height: Math.round((1080 / ratio) * options.count),
  };
}

export function computeDefaultCrop(img, targetSize) {
  const baseScale = Math.max(
    targetSize.width / img.width,
    targetSize.height / img.height
  );
  const scaledWidth = img.width * baseScale;
  const scaledHeight = img.height * baseScale;

  return {
    scale: baseScale,
    offsetX: (targetSize.width - scaledWidth) / 2,
    offsetY: (targetSize.height - scaledHeight) / 2,
  };
}

export function clampCrop(crop, img, targetSize) {
  const minScale = Math.max(
    targetSize.width / img.width,
    targetSize.height / img.height
  );
  const scale = Math.max(minScale, Math.min(minScale * 4, crop.scale));
  const scaledWidth = img.width * scale;
  const scaledHeight = img.height * scale;

  const minX = targetSize.width - scaledWidth;
  const minY = targetSize.height - scaledHeight;

  return {
    scale,
    offsetX: Math.min(0, Math.max(minX, crop.offsetX)),
    offsetY: Math.min(0, Math.max(minY, crop.offsetY)),
  };
}

export function renderSourceCanvas(img, targetSize, crop) {
  const canvas = document.createElement("canvas");
  canvas.width = targetSize.width;
  canvas.height = targetSize.height;
  const ctx = canvas.getContext("2d");
  const safe = clampCrop(crop, img, targetSize);
  ctx.drawImage(
    img,
    safe.offsetX,
    safe.offsetY,
    img.width * safe.scale,
    img.height * safe.scale
  );
  return canvas;
}

export function splitImage(img, options) {
  const targetSize = getTargetSize(options);
  const source = targetSize
    ? renderSourceCanvas(img, targetSize, options.crop)
    : toCanvas(img);

  if (options.mode === "profile") {
    return splitFromSource(source, options);
  }
  return splitCarouselFromSource(source, options);
}

function splitCarouselFromSource(source, { direction, count }) {
  const slices = [];
  const sliceWidth =
    direction === "horizontal" ? source.width / count : source.width;
  const sliceHeight =
    direction === "horizontal" ? source.height : source.height / count;

  for (let i = 0; i < count; i++) {
    const sx = direction === "horizontal" ? i * sliceWidth : 0;
    const sy = direction === "vertical" ? i * sliceHeight : 0;
    const canvas = createSliceCanvas(source, sx, sy, sliceWidth, sliceHeight);
    slices.push({
      canvas,
      index: i + 1,
      postOrder: i + 1,
      label: `第 ${i + 1} 張`,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return { slices, source };
}

function splitFromSource(source, { gridSize }) {
  const { cols, rows } = parseGridSize(gridSize);
  const slices = [];
  const sliceWidth = source.width / cols;
  const sliceHeight = source.height / rows;
  const total = cols * rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const visualIndex = row * cols + col + 1;
      const postOrder = total - visualIndex + 1;
      const canvas = createSliceCanvas(
        source,
        col * sliceWidth,
        row * sliceHeight,
        sliceWidth,
        sliceHeight
      );
      slices.push({
        canvas,
        index: visualIndex,
        postOrder,
        row,
        col,
        label: `位置 ${row + 1}-${col + 1}`,
        postLabel: `發文第 ${postOrder} 張`,
        width: canvas.width,
        height: canvas.height,
      });
    }
  }

  slices.sort((a, b) => a.postOrder - b.postOrder);
  return { slices, source, cols, rows };
}

function parseGridSize(gridSize) {
  const [cols, rows] = gridSize.split("x").map(Number);
  return { cols, rows };
}

function createSliceCanvas(source, sx, sy, sw, sh) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
  });
}

export function canvasToDataUrl(canvas) {
  return canvas.toDataURL("image/jpeg", 0.9);
}