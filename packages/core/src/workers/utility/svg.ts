import { Pen, Rect } from '../../models';
import { s8 } from '../../utils';

let offscreen: OffscreenCanvas = new OffscreenCanvas(100, 100);
let ctx: OffscreenCanvasRenderingContext2D = offscreen.getContext('2d');

let pathBBoxCache = {};

export async function loadSvgAsImageBitmap(url: string, maxSide?: number): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch SVG image: ${url} (${response.status})`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = async () => {
      try {
        const imageWidth = img.naturalWidth || img.width || 1;
        const imageHeight = img.naturalHeight || img.height || 1;
        let width = imageWidth;
        let height = imageHeight;

        if (maxSide && maxSide > 0) {
          const scale = maxSide / Math.max(imageWidth, imageHeight);
          width = Math.max(1, Math.round(imageWidth * scale));
          height = Math.max(1, Math.round(imageHeight * scale));
        }

        offscreen.width = width;
        offscreen.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(await createImageBitmap(offscreen));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode SVG image: ${url}`));
    };
    img.src = objectUrl;
  });
}

export function clearSvgCache(pens: Pen[]) {
  return pens;
}

export function getPathBBox(svgPath: string): Rect {
  // 创建一个临时 SVG 元素
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElem.setAttribute('d', svgPath);
  svg.appendChild(pathElem);
  document.body.appendChild(svg); // 需要插入 DOM 才能 getBBox

  const bbox = pathElem.getBBox();
  document.body.removeChild(svg);

  return {
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
  };
}

export function getPathBBoxs(paths: { [key: string]: string }) {
  for (const key in paths) {
    pathBBoxCache[key] = getPathBBox(paths[key]);
  }
}

export function addPath(paths: { [key: string]: string }, value: string) {
  for (const key in paths) {
    if (paths[key] === value) {
      return { id: key, rect: pathBBoxCache[key] };
    }
  }

  const id = s8();
  paths[id] = value;
  pathBBoxCache[id] = getPathBBox(value);
  return { id, rect: pathBBoxCache[id] };
}

export function getPathBBoxCache() {
  return pathBBoxCache;
}
