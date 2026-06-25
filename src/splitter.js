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

export function splitImage(img, options) {
  if (options.mode === "profile") {
    return splitProfileGrid(img, options);
  }
  return splitCarousel(img, options);
}

export function buildPreviewCanvas(img, options) {
  if (options.mode === "profile") {
    const { cols, rows } = parseGridSize(options.gridSize);
    return prepareProfileSource(img, cols, rows, options.ratioKey);
  }
  return prepareCarouselSource(
    img,
    options.direction,
    options.count,
    options.ratioKey
  );
}

function splitCarousel(img, { direction, count, ratioKey }) {
  const source = prepareCarouselSource(img, direction, count, ratioKey);
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

function splitProfileGrid(img, { gridSize, ratioKey }) {
  const { cols, rows } = parseGridSize(gridSize);
  const source = prepareProfileSource(img, cols, rows, ratioKey);
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

function prepareCarouselSource(img, direction, count, ratioKey) {
  const ratio = RATIO_MAP[ratioKey];
  if (!ratio) return toCanvas(img);

  const canvas = document.createElement("canvas");
  if (direction === "horizontal") {
    canvas.width = 1080 * count;
    canvas.height = Math.round(1080 / ratio);
  } else {
    canvas.width = 1080;
    canvas.height = Math.round((1080 / ratio) * count);
  }

  drawImageCover(canvas.getContext("2d"), img, canvas.width, canvas.height);
  return canvas;
}

function prepareProfileSource(img, cols, rows, ratioKey) {
  const ratio = RATIO_MAP[ratioKey] ?? 1;
  const canvas = document.createElement("canvas");
  canvas.width = 1080 * cols;
  canvas.height = Math.round((1080 / ratio) * rows);
  drawImageCover(canvas.getContext("2d"), img, canvas.width, canvas.height);
  return canvas;
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

function drawImageCover(ctx, img, destWidth, destHeight) {
  const scale = Math.max(destWidth / img.width, destHeight / img.height);
  const scaledWidth = img.width * scale;
  const scaledHeight = img.height * scale;
  const offsetX = (destWidth - scaledWidth) / 2;
  const offsetY = (destHeight - scaledHeight) / 2;
  ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
  });
}

export function canvasToDataUrl(canvas) {
  return canvas.toDataURL("image/jpeg", 0.9);
}