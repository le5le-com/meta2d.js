import { snapdom } from '@zumer/snapdom';
import { renderLineGradientPath } from '../../diagrams/line/gradient';
import type { Meta2d } from '../../meta2d';
import {
  calcIconRect,
  calcImageRect,
  calcTextLines,
  calcTextRect,
  ColorType,
  createBackgroundGradient,
  createGradient,
  createLineGradient,
  createTextGradient,
  flipRender,
  getFont,
  getRectOfPoints,
  isEffectiveShowChild,
  isEffectiveVisible,
  Pen,
  PenCategory,
  Point,
  Rect,
  rectToPoints,
  rotateRender,
  setBackground,
  setBackgrounds,
  TextDecoration,
} from '../../models';
import { toPngFns } from '../../models/pen/handle';
import { getPathBBox, getPathBBoxCache } from '../../workers/utility/svg';
import { pSBC } from '../color';
import { getSvgDraw } from './registry';

type SvgContext = CanvasRenderingContext2D & {
  getSerializedSvg: () => string;
  svgPath?: (path: string) => void;
};

type Canvas2SvgConstructor = new (width: number, height: number) => SvgContext;

interface SvgAssets {
  images: Record<string, HTMLImageElement>;
  elements: Record<string, HTMLCanvasElement>;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function getCanvas2Svg(): Canvas2SvgConstructor | undefined {
  return (globalThis as typeof globalThis & { C2S?: Canvas2SvgConstructor }).C2S;
}

function getExportPens(meta2d: Meta2d): Pen[] {
  const pens: Pen[] = [];
  for (const pen of meta2d.penMap.values()) {
    if (!isEffectiveVisible(pen, meta2d.penMap) || !isEffectiveShowChild(pen, meta2d.penMap)) {
      continue;
    }
    pens.push(pen);
  }
  return pens;
}

function getExportRect(meta2d: Meta2d, pens: Pen[]): Rect {
  // 固定尺寸画布始终使用完整画布范围，不受当前视口缩放和平移影响。
  if (meta2d.data.width && meta2d.data.height) {
    return {
      x: 0,
      y: 0,
      width: meta2d.data.width,
      height: meta2d.data.height,
      ex: meta2d.data.width,
      ey: meta2d.data.height,
    };
  }

  const points: Point[] = [];
  for (const pen of pens) {
    points.push(...rectToPoints(pen));
    if (pen.textBox) {
      points.push(...rectToPoints(pen.textBox));
    }
  }
  return getRectOfPoints(points);
}

function isValidRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function collectImageUrls(meta2d: Meta2d, pens: Pen[]): Map<string, string | undefined> {
  const urls = new Map<string, string | undefined>();
  if (meta2d.data.backgroundImage) {
    urls.set(meta2d.data.backgroundImage, undefined);
  }

  for (const pen of pens) {
    if (pen.image) {
      urls.set(pen.image, pen.crossOrigin);
    }
    if (pen.backgroundImage) {
      urls.set(pen.backgroundImage, pen.crossOrigin);
    }
    pen.backgrounds?.forEach((background) => {
      if (background.image) {
        urls.set(background.image, pen.crossOrigin);
      }
    });
  }
  return urls;
}

function loadImage(url: string, crossOrigin?: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    if (crossOrigin) {
      image.crossOrigin = crossOrigin;
    }
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined);
    image.src = url;
  });
}

async function loadImages(meta2d: Meta2d, pens: Pen[]): Promise<Record<string, HTMLImageElement>> {
  const images: Record<string, HTMLImageElement> = {};
  const entries = Array.from(collectImageUrls(meta2d, pens));
  await Promise.all(
    entries.map(async ([url, crossOrigin]) => {
      const image = await loadImage(url, crossOrigin);
      if (image) {
        images[url] = image;
      }
    }),
  );
  return images;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('HTML 图元图片读取失败'));
    reader.readAsDataURL(blob);
  });
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement | undefined> {
  return loadImage(await blobToDataUrl(blob));
}

function imageSourceToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return undefined;
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function renderElementToCanvas(meta2d: Meta2d, pen: Pen): Promise<HTMLCanvasElement | undefined> {
  const width = Math.max(1, Math.round(pen.width));
  const height = Math.max(1, Math.round(pen.height));

  try {
    if (toPngFns[pen.type]) {
      const source = await toPngFns[pen.type].call(meta2d, pen);
      if (source) {
        return imageSourceToCanvas(source, width, height);
      }
    }

    const element = meta2d.componentElementMap.get(pen.id);
    if (!element) {
      return undefined;
    }
    const blob = await snapdom.toBlob(element, { type: 'png' });
    const image = await blobToImage(blob);
    return image ? imageSourceToCanvas(image, width, height) : undefined;
  } catch (error) {
    meta2d.emitter.emit('error', error instanceof Error ? error.message : 'HTML 图元导出失败');
    return undefined;
  }
}

async function loadElementImages(meta2d: Meta2d, pens: Pen[]): Promise<Record<string, HTMLCanvasElement>> {
  const elements: Record<string, HTMLCanvasElement> = {};
  await Promise.all(
    pens.map(async (pen) => {
      if (pen.category !== PenCategory.HtmlElement) {
        return;
      }
      const canvas = await renderElementToCanvas(meta2d, pen);
      if (canvas) {
        elements[pen.id] = canvas;
      }
    }),
  );
  return elements;
}

async function loadAssets(meta2d: Meta2d, pens: Pen[]): Promise<SvgAssets> {
  const [images, elements] = await Promise.all([loadImages(meta2d, pens), loadElementImages(meta2d, pens)]);
  return { images, elements };
}

function clipRoundRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number) {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.lineTo(rect.ex - r, rect.y);
  ctx.quadraticCurveTo(rect.ex, rect.y, rect.ex, rect.y + r);
  ctx.lineTo(rect.ex, rect.ey - r);
  ctx.quadraticCurveTo(rect.ex, rect.ey, rect.ex - r, rect.ey);
  ctx.lineTo(rect.x + r, rect.ey);
  ctx.quadraticCurveTo(rect.x, rect.ey, rect.x, rect.ey - r);
  ctx.lineTo(rect.x, rect.y + r);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
  ctx.closePath();
  ctx.clip();
}

function renderImage(ctx: CanvasRenderingContext2D, pen: Pen, image: CanvasImageSource) {
  const rect = calcImageRect(pen, image);
  ctx.save();
  if (pen.imageRadius) {
    clipRoundRect(ctx, rect, pen.imageRadius);
  }
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function renderIcon(ctx: CanvasRenderingContext2D, meta2d: Meta2d, pen: Pen) {
  const rect = calcIconRect(pen);
  const size = pen.iconSize || Math.min(rect.width, rect.height);
  const fill = pen.disabled
    ? pen.disabledTextColor || pen.disabledColor || pSBC(0.4, pen.iconColor)
    : pen.iconColor || pen.textColor || pen.color || meta2d.data.textColor || meta2d.data.color || meta2d.options.color;

  ctx.save();
  ctx.font = `${pen.iconWeight || 'normal'} ${size}px ${pen.iconFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pen.iconGradient
    ? createGradient(ctx, rect.x, rect.y, rect.width, rect.height, pen.iconGradient)
    : fill;
  ctx.fillText(pen.icon, rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.restore();
}

function renderText(ctx: CanvasRenderingContext2D, meta2d: Meta2d, pen: Pen) {
  if (!pen.textShadow) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowBlur = pen.textShadowBlur || pen.shadowBlur || 0;
    ctx.shadowOffsetX = pen.textShadowOffsetX || pen.shadowOffsetX || 0;
    ctx.shadowOffsetY = pen.textShadowOffsetY || pen.shadowOffsetY || 0;
    ctx.shadowColor = pen.textShadowColor || pen.shadowColor;
  }

  ctx.save();
  ctx.font = getFont(pen, meta2d.data);
  // SVG 导出时无条件重新计算文本坐标，避免使用缓存的无效值
  // 必须先调用 calcTextRect 初始化 textRectX 和 textRectY，再调用 calcTextLines
  calcTextRect(pen);
  calcTextLines(ctx, pen);

  if (!pen.textLines?.length) {
    ctx.restore();
    return;
  }

  let fill: string;
  if (pen.disabled) {
    fill =
      pen.disabledTextColor ||
      pen.disabledColor ||
      pSBC(
        0.4,
        pen.textColor || pen.color || meta2d.data.textColor || meta2d.data.color || meta2d.options.color,
      );
  }

  let gradient: CanvasGradient;
  if (!fill) {
    if (pen.textGradient) {
      gradient = createTextGradient(ctx, pen, pen.textGradient);
    } else if (!pen.textColor && !pen.color && meta2d.data.textGradient) {
      gradient = createTextGradient(ctx, pen, meta2d.data.textGradient);
    } else {
      fill = pen.textColor || pen.color || meta2d.data.textColor || meta2d.data.color || meta2d.options.color;
    }
  }

  ctx.fillStyle = fill || gradient;
  ctx.strokeStyle =
    pen.textDecorationColor ||
    pen.textColor ||
    pen.color ||
    meta2d.data.textColor ||
    meta2d.data.color ||
    meta2d.options.color;
  ctx.lineWidth = 1;

  const rowHeight = ((pen.fontSize || 12) * (pen.lineHeight || 1.5)) / 2;
  pen.textLines.forEach((item) => {
    // 防御性检查：跳过坐标计算异常的文本行
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) {
      return;
    }

    if (pen.textBackground) {
      ctx.fillStyle = pen.textBackground;
      ctx.fillRect(item.x, item.y - item.textHeight / 2 + rowHeight, item.textWidth, item.textHeight + 0.5);
      ctx.fillStyle = fill || gradient;
    }

    if (pen.letterSpacing) {
      let width = 0;
      for (let i = 0; i < item.text.length; i++) {
        ctx.fillText(item.text[i], item.x + width, item.y + rowHeight);
        width += ctx.measureText(item.text[i]).width + pen.letterSpacing;
      }
    } else {
      ctx.fillText(item.text, item.x, item.y + rowHeight);
    }

    if (pen.textDecoration) {
      let y = item.y + rowHeight;
      if (pen.textDecoration === TextDecoration.LineThrough) {
        y -= item.textHeight / 10;
      } else {
        y += item.textHeight / 2 - 3;
      }
      ctx.setLineDash(pen.textDecorationDash || []);
      ctx.beginPath();
      ctx.moveTo(item.x, y);
      ctx.lineTo(item.ex, y);
      ctx.stroke();
    }
  });
  ctx.restore();
}

function renderSvgPath(ctx: SvgContext, meta2d: Meta2d, pen: Pen) {
  const path = meta2d.data.paths?.[pen.pathId];
  if (!path || !ctx.svgPath) {
    return;
  }

  const pathBBoxs = getPathBBoxCache();
  const pathRect = pathBBoxs[pen.pathId] || getPathBBox(path);
  if (!pathRect?.width || !pathRect?.height) {
    return;
  }

  ctx.save();
  const scaleX = pen.width / pathRect.width;
  const scaleY = pen.height / pathRect.height;
  ctx.translate(pen.x - pathRect.x * scaleX, pen.y - pathRect.y * scaleY);
  ctx.scale(scaleX, scaleY);
  ctx.beginPath();
  ctx.svgPath(path);

  if (pen.pathFill) {
    const fillStyle = ctx.fillStyle;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.fillStyle = fillStyle;
  } else {
    ctx.stroke();
    pen.fillStyles?.forEach((fillStyle) => {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    });
  }
  ctx.restore();
}

function renderProgress(ctx: CanvasRenderingContext2D, meta2d: Meta2d, pen: Pen) {
  if (!pen.progress || isNaN(pen.progress)) {
    return;
  }

  const progressMin = pen.progressMin || 0;
  const progressMax = pen.progressMax || 1;
  const progress = Math.max(0, Math.min(1, (pen.progress - progressMin) / (progressMax - progressMin)));
  if (!pen.progressColors?.length) {
    return;
  }

  for (const progressColor of pen.progressColors) {
    const gradient = pen.verticalProgress
      ? pen.reverseProgress
        ? ctx.createLinearGradient(pen.x, pen.y, pen.x, pen.y + pen.height * progress)
        : ctx.createLinearGradient(pen.x, pen.ey, pen.x, pen.ey - pen.height * progress)
      : pen.reverseProgress
        ? ctx.createLinearGradient(pen.ex, pen.y, pen.ex - pen.width * progress, pen.y)
        : ctx.createLinearGradient(pen.x, pen.y, pen.x + pen.width * progress, pen.y);

    if (progressColor.type === ColorType.LinearGradient && progressColor.gradient) {
      progressColor.gradient.colorStops.forEach((colorStop) => gradient.addColorStop(colorStop.i, colorStop.color));
    } else {
      const color = progressColor.color || meta2d.data.color || meta2d.options.color;
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color);
    }
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

function renderPen(ctx: SvgContext, meta2d: Meta2d, pen: Pen, assets: SvgAssets) {
  if (pen.type === 'group') {
    return;
  }
  if (pen.category === PenCategory.HtmlElement) {
    const image = assets.elements[pen.id];
    if (image) {
      ctx.drawImage(image, pen.x, pen.y, pen.width, pen.height);
    }
    return;
  }

  const fillStyles = pen.fillStyles;
  ctx.save();
  try {
    // fillStyles 是渲染期临时状态，导出结束后必须恢复，避免污染画布数据。
    pen.fillStyles = undefined;
    const lineGradient = pen.lineGradient || (!pen.color ? meta2d.data.lineGradient : undefined);

    if (pen.disabled) {
      ctx.strokeStyle = pen.disabledColor || pSBC(0.4, pen.color || meta2d.data.color);
    } else if (lineGradient && pen.category !== PenCategory.Line) {
      ctx.strokeStyle = createLineGradient(ctx, pen, lineGradient);
    } else {
      ctx.strokeStyle = pen.color || meta2d.data.color || meta2d.options.color;
    }
    ctx.lineWidth = pen.lineWidth === 0 ? 0 : pen.lineWidth || 1;
    if (pen.lineWidth === 0) {
      ctx.strokeStyle = 'transparent';
    }
    ctx.lineCap = pen.lineCap || 'square';
    ctx.lineJoin = pen.lineJoin || 'round';
    ctx.globalAlpha = pen.opacity ?? 1;
    ctx.shadowColor = pen.shadowColor || 'transparent';
    ctx.shadowBlur = pen.shadowBlur || 0;
    ctx.shadowOffsetX = pen.shadowOffsetX || 0;
    ctx.shadowOffsetY = pen.shadowOffsetY || 0;
    ctx.setLineDash(pen.lineDash || []);
    ctx.lineDashOffset = pen.lineDashOffset || 0;

    if (pen.flipX || pen.flipY) {
      flipRender(ctx, pen);
    }
    if (pen.rotate && pen.category !== PenCategory.Line) {
      rotateRender(ctx, pen);
    }

    if (pen.disabled) {
      pen.fillStyles = [pen.disabledBackground || pSBC(0.4, pen.background) || 'transparent'];
    } else if (pen.backgrounds) {
      setBackgrounds(ctx, pen, assets.images);
    } else if (pen.background || pen.gradient || pen.backgroundImage) {
      setBackground(ctx, pen, assets.images);
    } else if (meta2d.data.penGradient) {
      pen.fillStyles = [createBackgroundGradient(ctx, pen, meta2d.data.penGradient)];
    } else if (meta2d.data.penBackground) {
      pen.fillStyles = [meta2d.data.penBackground];
    }

    if (pen.pathId) {
      renderSvgPath(ctx, meta2d, pen);
    } else {
      const draw = getSvgDraw(meta2d, pen.type);
      if (draw) {
        if (pen.category === PenCategory.Line) {
          if (lineGradient?.colorStops?.length && pen.lineWidth !== 0 && !pen.disabled) {
            renderLineGradientPath(ctx, pen, lineGradient);
          } else {
            draw(ctx, pen, meta2d.options, meta2d.data);
          }
        } else {
          draw(ctx, pen);
        }
      } else if (pen.fillStyles?.length) {
        pen.fillStyles.forEach((fillStyle) => {
          ctx.fillStyle = fillStyle;
          ctx.fillRect(pen.x, pen.y, pen.width, pen.height);
        });
      } else if (!pen.text && !pen.image) {
        ctx.fillStyle = meta2d.options.unknowBackground || '#d9d9d960';
        ctx.fillRect(pen.x, pen.y, pen.width, pen.height);
      }
    }

    renderProgress(ctx, meta2d, pen);
    if (pen.image && assets.images[pen.image]) {
      renderImage(ctx, pen, assets.images[pen.image]);
    }
    if (pen.icon) {
      renderIcon(ctx, meta2d, pen);
    }
    if (pen.textVisible !== false && pen.text) {
      renderText(ctx, meta2d, pen);
    }
  } finally {
    pen.fillStyles = fillStyles;
    ctx.restore();
  }
}

function renderBackground(ctx: SvgContext, meta2d: Meta2d, rect: Rect, assets: SvgAssets) {
  if (meta2d.data.backgroundImage && assets.images[meta2d.data.backgroundImage]) {
    ctx.drawImage(assets.images[meta2d.data.backgroundImage], rect.x, rect.y, rect.width, rect.height);
  } else if (meta2d.data.width && meta2d.data.height && meta2d.data.backgroundGradient) {
    ctx.fillStyle = createGradient(ctx, rect.x, rect.y, rect.width, rect.height, meta2d.data.backgroundGradient);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  } else if (meta2d.data.background) {
    ctx.fillStyle = meta2d.data.background;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
}

function serializeSvg(ctx: SvgContext, rect: Rect, defs?: string[]): string {
  const source = ctx.getSerializedSvg();
  const documentNode = new DOMParser().parseFromString(source, 'image/svg+xml');
  const parserError = documentNode.querySelector('parsererror');
  if (parserError) {
    throw new Error('SVG 序列化失败');
  }

  const root = documentNode.documentElement;
  root.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  root.setAttribute('overflow', 'hidden');

  if (defs?.length) {
    let defsElement = root.querySelector('defs');
    if (!defsElement) {
      defsElement = documentNode.createElementNS(SVG_NAMESPACE, 'defs');
      root.insertBefore(defsElement, root.firstChild);
    }
    const style = documentNode.createElementNS(SVG_NAMESPACE, 'style');
    style.setAttribute('type', 'text/css');
    style.textContent = defs.join('\n');
    defsElement.appendChild(style);
  }

  return new XMLSerializer().serializeToString(root).replace(/--le5le--/g, '&#x');
}

function downloadSvg(meta2d: Meta2d, content: string) {
  const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${meta2d.data.name || 'meta2d'}.svg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export async function exportToSvg(meta2d: Meta2d, defs?: string[]): Promise<void> {
  const Canvas2Svg = getCanvas2Svg();
  if (!Canvas2Svg) {
    const message = '请先加载乐吾乐官网下的canvas2svg.js';
    meta2d.emitter.emit('error', message);
    throw new Error(message);
  }

  const pens = getExportPens(meta2d);
  const rect = getExportRect(meta2d, pens);
  if (!isValidRect(rect)) {
    const message = 'SVG 导出区域无效。宽高必须是大于0的有限数值';
    meta2d.emitter.emit('error', message);
    throw new Error(message);
  }

  const assets = await loadAssets(meta2d, pens);
  const ctx = new Canvas2Svg(rect.width, rect.height);
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = meta2d.data.color || meta2d.options.color;
  // canvas2svg 的 setTransform 为空实现，必须通过 translate 对齐联合包围盒原点。
  ctx.translate(-rect.x, -rect.y);
  renderBackground(ctx, meta2d, rect, assets);
  pens.forEach((pen) => renderPen(ctx, meta2d, pen, assets));
  downloadSvg(meta2d, serializeSvg(ctx, rect, defs));
}
