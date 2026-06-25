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

export function splitImage(img, { direction, count, ratioKey }) {
  const source = prepareSource(img, direction, count, ratioKey);
  const slices = [];
  const sliceWidth =
    direction === "horizontal" ? source.width / count : source.width;
  const sliceHeight =
    direction === "horizontal" ? source.height : source.height / count;

  for (let i = 0; i < count; i++) {
    const sx = direction === "horizontal" ? i * sliceWidth : 0;
    const sy = direction === "vertical" ? i * sliceHeight : 0;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sliceWidth);
    canvas.height = Math.round(sliceHeight);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      source,
      sx,
      sy,
      sliceWidth,
      sliceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    slices.push({ canvas, index: i + 1, width: canvas.width, height: canvas.height });
  }

  return slices;
}

function prepareSource(img, direction, count, ratioKey) {
  const ratio = RATIO_MAP[ratioKey];
  if (!ratio) return img;

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