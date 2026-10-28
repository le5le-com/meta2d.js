import { Meta2dData, Options } from '../../types';
import { fetchImage } from './image';
import { pSBCr } from '../../utils';
import { GridColor } from '../../const/utility';
import { createGradient } from '../../models';

const BOLD_LINE_INTERVAL = 5; // 每5条线有一条粗线
const MIN_SCALE_FOR_LIGHT_LINES = 0.3; // 缩放小于30%时只显示粗线

let dpr = 1;
let ctx: CanvasRenderingContext2D;
let width: number;
let height: number;
let bgImgUrl: string;
let bgImg: ImageBitmap;

export function setBackgroundCtx(_ctx: CanvasRenderingContext2D, _dpr: number, w: number, h: number) {
  ctx = _ctx;
  dpr = _dpr || 1;
  width = w;
  height = h;
}

export async function renderBackground(options: Options, data: Meta2dData) {
  ctx.resetTransform();
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(new DOMMatrix().scale(dpr));

  let x = 0;
  let y = 0;
  let pageWidth = width;
  let pageHeight = height;

  if (data.width && data.height) {
    x = data.x;
    y = data.y;
    pageWidth = data.width * data.scale;
    pageHeight = data.height * data.scale;
  }

  if (data.backgroundImage) {
    if (data.backgroundImage !== bgImgUrl) {
      bgImg = await fetchImage(data.backgroundImage);
      bgImgUrl = data.backgroundImage;
    }
    if (bgImg) {
      ctx.drawImage(bgImg, x, y, pageWidth, pageHeight);
    }
  } else if (data.width && data.height && data.backgroundGradient) {
    ctx.fillStyle = createGradient(ctx, x, y, pageWidth, pageHeight, data.backgroundGradient);
    ctx.fillRect(x, y, pageWidth, pageHeight);
  } else if (data.background) {
    ctx.fillStyle = data.background;
    ctx.fillRect(x, y, pageWidth, pageHeight);
  }

  const grid = { ...options.grid, ...data.grid };
  if (grid.enable) {
    drawGrid(data, grid, x, y, pageWidth, pageHeight);
  }
}

function drawGrid(data: Meta2dData, grid: any, x: number, y: number, pageWidth: number, pageHeight: number) {
  const gridSize = (grid.size || 20) * data.scale;
  const boundary = { x, y, ex: x + pageWidth, ey: y + pageHeight };
  const gridRotate = (grid.rotate || 0) % 90;

  const boldStrokeStyle = grid.color || GridColor;
  const rgb = pSBCr(boldStrokeStyle);
  const lightAlpha = rgb.a < 0 ? 0.5 : Math.max(0.1, rgb.a - 0.5);
  const lightStrokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${lightAlpha})`;

  if (gridRotate) {
    ctx.save();

    ctx.beginPath();
    ctx.rect(x, y, pageWidth, pageHeight);
    ctx.clip();

    ctx.translate(data.x, data.y);
    ctx.rotate((gridRotate * Math.PI) / 180);
    ctx.translate(-data.x, -data.y);

    const expandedBoundary = calculateExpandedBoundary(boundary, data.x, data.y);
    drawAlignedGrid(ctx, gridSize, data, expandedBoundary, lightStrokeStyle, boldStrokeStyle);
    ctx.restore();
  } else {
    drawAlignedGrid(ctx, gridSize, data, boundary, lightStrokeStyle, boldStrokeStyle);
  }
}

function calculateExpandedBoundary(
  boundary: { x: number; y: number; ex: number; ey: number },
  centerX: number,
  centerY: number,
) {
  const { x, y, ex, ey } = boundary;

  const corners = [
    { x, y },
    { x: ex, y },
    { x, y: ey },
    { x: ex, y: ey },
  ];

  let maxDistance = 0;
  for (const corner of corners) {
    const dx = corner.x - centerX;
    const dy = corner.y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  }

  return {
    x: centerX - maxDistance,
    y: centerY - maxDistance,
    ex: centerX + maxDistance,
    ey: centerY + maxDistance,
  };
}

function drawAlignedGrid(
  ctx: CanvasRenderingContext2D,
  gridSize: number,
  data: Meta2dData,
  boundary: { x: number; y: number; ex: number; ey: number },
  lightStrokeStyle: string,
  boldStrokeStyle: string
) {
  const { x: dataX, y: dataY, scale } = data;
  const { x, y } = boundary;
  const showLightLines = scale > MIN_SCALE_FOR_LIGHT_LINES;

  const startX = dataX + Math.ceil((x - dataX) / gridSize) * gridSize;
  const startY = dataY + Math.ceil((y - dataY) / gridSize) * gridSize;
  const startIndexX = Math.round((startX - dataX) / gridSize);
  const startIndexY = Math.round((startY - dataY) / gridSize);

  // 绘制细线（仅在缩放足够大时）
  if (showLightLines) {
    ctx.strokeStyle = lightStrokeStyle;
    drawAlignedGridLines(ctx, startX, startY, startIndexX, startIndexY, boundary, gridSize, false);
  }

  // 绘制粗线
  ctx.strokeStyle = boldStrokeStyle;
  drawAlignedGridLines(ctx, startX, startY, startIndexX, startIndexY, boundary, gridSize, true);
}

function drawAlignedGridLines(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  startIndexX: number,
  startIndexY: number,
  boundary: { x: number; y: number; ex: number; ey: number },
  gridSize: number,
  isBold: boolean
) {
  const { x, y, ex, ey } = boundary;
  ctx.beginPath();
  // 绘制垂直线
  for (let pos = startX, i = startIndexX; pos <= ex; pos += gridSize, i++) {
    if ((i % BOLD_LINE_INTERVAL === 0) === isBold) {
      ctx.moveTo(pos, y);
      ctx.lineTo(pos, ey);
    }
  }

  // 绘制水平线
  for (let pos = startY, i = startIndexY; pos <= ey; pos += gridSize, i++) {
    if ((i % BOLD_LINE_INTERVAL === 0) === isBold) {
      ctx.moveTo(x, pos);
      ctx.lineTo(ex, pos);
    }
  }
  ctx.stroke();
}
