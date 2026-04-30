import { leChartPen } from './common';

export function heatmap(ctx: CanvasRenderingContext2D, pen: leChartPen) {
  if (!pen.onBeforeValue) {
    pen.onBeforeValue = beforeValue;
  }
  if (pen.calculative.update === undefined) {
    pen.calculative.update = true;
  }

  if (pen.calculative.update) {
    const dataURL = createHeatMapImg(pen);
    if (dataURL) {
      if (!pen.calculative.img) {
        pen.calculative.img = new Image();
      }
      pen.calculative.img.src = dataURL;
    }

    pen.calculative.update = false;
  }

  if (pen.calculative.img) {
    const { x, y, width, height } = pen.calculative.worldRect;
    ctx.drawImage(pen.calculative.img, x, y, width, height);
  }
}

function beforeValue(pen: leChartPen, value: any) {
  if (value.data || value.min || value.max || value.chartsColor) {
    pen.calculative.update = true;
  }
  return value;
}

function createHeatMapImg(pen: leChartPen) {
  const { width: w, height: h } = pen.calculative.worldRect;

  const data = pen.data;
  const rows = data?.length || 0;
  const cols = rows > 0 ? data[0].length : 0;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.style.width = `${w}px`;
  tempCanvas.style.height = `${h}px`;
  tempCanvas.width = w;
  tempCanvas.height = h;
  const width = tempCanvas.width;
  const height = tempCanvas.height;
  const tempCtx = tempCanvas.getContext('2d');

  let rect = pen.calculative?.canvas?.getPenRect(pen);
  const scaleX = (cols - 1) / width;
  const scaleY = (rows - 1) / height;
  if (rows === 0 || cols === 0) {
    console.warn('无效数据维度');
    return;
  }
  const imageData = tempCtx.createImageData(width, height);
  const pixels = imageData.data;

  const paddedGrid = padData(data, rows, cols);
  const colorFunc = buildColorMap(pen.min, pen.max, pen.chartsColor);

  for (let py = 0; py < height; py++) {
    const gy = py * scaleY;
    for (let px = 0; px < width; px++) {
      const gx = px * scaleX;
      const temp = bicubicInterpolate(pen, paddedGrid, gx, gy);
      const { r, g, b } = colorFunc(temp);
      const idx = (py * width + px) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
  tempCtx.putImageData(imageData, 0, 0);
  return tempCanvas.toDataURL();
}

// 镜像扩展矩阵 (用于边界平滑)
function padData(data: any, r: number, c: number) {
  const padSize = 2;
  const newRows = r + 2 * padSize;
  const newCols = c + 2 * padSize;
  const padded = Array(newRows)
    .fill(null)
    .map(() => Array(newCols).fill(0));
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      padded[i + padSize][j + padSize] = data[i][j];
    }
  }
  // 上下镜像
  for (let i = 0; i < padSize; i++) {
    for (let j = 0; j < newCols; j++) {
      padded[i][j] = padded[padSize + (padSize - i - 1)][j];
    }
  }
  for (let i = 0; i < padSize; i++) {
    let destRow = newRows - padSize + i;
    let srcRow = newRows - padSize - 1 - i;
    for (let j = 0; j < newCols; j++) {
      padded[destRow][j] = padded[srcRow][j];
    }
  }
  // 左右镜像
  for (let j = 0; j < padSize; j++) {
    for (let i = 0; i < newRows; i++) {
      padded[i][j] = padded[i][padSize + (padSize - j - 1)];
    }
  }
  for (let j = 0; j < padSize; j++) {
    let destCol = newCols - padSize + j;
    let srcCol = newCols - padSize - 1 - j;
    for (let i = 0; i < newRows; i++) {
      padded[i][destCol] = padded[i][srcCol];
    }
  }
  return padded;
}

// 双三次插值获取温度
function bicubicInterpolate(
  pen: leChartPen,
  paddedGrid: any,
  fx: number,
  fy: number,
) {
  const padOffset = 2;
  const px = fx + padOffset;
  const py = fy + padOffset;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const dx = px - ix;
  const dy = py - iy;
  let result = 0;
  for (let m = -1; m <= 2; m++) {
    const wx = cubicWeight(m - dx);
    for (let n = -1; n <= 2; n++) {
      const wy = cubicWeight(n - dy);
      const val = paddedGrid[iy + n][ix + m];
      result += val * wx * wy;
    }
  }
  return Math.min(pen.max, Math.max(pen.min, result));
}

// 双三次插值权重函数
function cubicWeight(x, a = -0.5) {
  x = Math.abs(x);
  if (x <= 1) return (a + 2) * x * x * x - (a + 3) * x * x + 1;
  if (x < 2) return a * x * x * x - 5 * a * x * x + 8 * a * x - 4 * a;
  return 0;
}

// 构建温度 -> RGB 映射函数 (线性插值)
function buildColorMap(minT: number, maxT: number, colorArray: string[]) {
  const n = colorArray.length;
  const stops: any[] = [];
  for (let i = 0; i < n; i++) {
    const pos = i / (n - 1);
    const rgb = colorToRgb(colorArray[i]);
    stops.push({ pos, rgb });
  }
  return function (temp: number) {
    let t = (temp - minT) / (maxT - minT);
    t = Math.min(1, Math.max(0, t));
    let i = 0;
    for (; i < stops.length - 1; i++) {
      if (t <= stops[i + 1].pos) break;
    }
    const left = stops[i];
    const right = stops[i + 1];
    if (t <= left.pos) return left.rgb;
    if (t >= right.pos) return right.rgb;
    const ratio = (t - left.pos) / (right.pos - left.pos);
    const r = Math.round(left.rgb.r + (right.rgb.r - left.rgb.r) * ratio);
    const g = Math.round(left.rgb.g + (right.rgb.g - left.rgb.g) * ratio);
    const b = Math.round(left.rgb.b + (right.rgb.b - left.rgb.b) * ratio);
    return { r, g, b };
  };
}
function colorToRgb(colorStr: string) {
  const tempElem = document.createElement('div');
  tempElem.style.color = colorStr;
  tempElem.style.display = 'none';
  document.body.appendChild(tempElem);
  const computed = window.getComputedStyle(tempElem).color;
  document.body.removeChild(tempElem);
  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(`无法解析颜色: ${colorStr}`);
  return {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3]),
  };
}
