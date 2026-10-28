import { WorkerMessage } from '../../types';

export interface FontSource {
  fontFamily: string;
  src: string;
  descriptors?: FontFaceDescriptors;
}

export interface FontWorkerHost {
  renderWorker: Worker;
  hoverWorker: Worker;
}

const FONT_LOAD_TIMEOUT = 30_000;
const fontPromises = new Map<string, Promise<void>>();

function getFontFaceSet(): FontFaceSet & { add?: (font: FontFace) => void } {
  if (typeof document !== 'undefined') {
    return document.fonts;
  }

  const workerFonts = (globalThis as typeof globalThis & { fonts?: FontFaceSet }).fonts;
  if (!workerFonts) {
    throw new Error('当前运行环境不支持 FontFaceSet');
  }
  return workerFonts;
}

export function trimCssValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function parseCssDeclarations(body: string) {
  const declarations: Record<string, string> = {};
  let start = 0;
  let quote = '';
  let depth = 0;

  const addDeclaration = (text: string) => {
    const index = text.indexOf(':');
    if (index < 0) {
      return;
    }

    let key = text.slice(0, index).trim().toLowerCase();
    if (key.includes('src')) {
      key = 'src';
    }
    let value = text.slice(index + 1).trim();
    if (key === 'font-family') {
      value = value.replace(/^"|"$/g, '');
    }
    if (key && value) {
      declarations[key] = value;
    }
  };

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    const prev = body[i - 1];

    if (quote) {
      if (char === quote && prev !== '\\') {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth++;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === ';' && depth === 0) {
      addDeclaration(body.slice(start, i));
      start = i + 1;
    }
  }

  addDeclaration(body.slice(start));
  return declarations;
}

function resolveCssUrls(src: string, cssUrl?: string) {
  if (!cssUrl) {
    return src;
  }

  const pageUrl = typeof location === 'undefined' ? undefined : location.href;
  const baseUrl = pageUrl ? new URL(cssUrl, pageUrl).href : cssUrl;

  return src.replace(/url\((['"]?)(.*?)\1\)/g, (_match, _quote, url) => {
    const value = trimCssValue(url);
    if (/^(data:|blob:|https?:\/\/|\/)/i.test(value)) {
      return `url("${value}")`;
    }
    return `url("${new URL(value, baseUrl).href}")`;
  });
}

function getFontFaceDescriptors(declarations: Record<string, string>): FontFaceDescriptors | undefined {
  const descriptors: FontFaceDescriptors = {};
  const descriptorMap: Array<[string, keyof FontFaceDescriptors]> = [
    ['font-style', 'style'],
    ['font-weight', 'weight'],
    ['font-stretch', 'stretch'],
    ['unicode-range', 'unicodeRange'],
    ['font-display', 'display'],
  ];

  for (const [cssName, descriptorName] of descriptorMap) {
    const value = declarations[cssName];
    if (value) {
      // CSS 描述符与 FontFaceDescriptors 的值域由浏览器校验，这里只做字段映射。
      descriptors[descriptorName] = value as never;
    }
  }

  return Object.keys(descriptors).length ? descriptors : undefined;
}

export function parseFontFaceCss(css: string, cssUrl?: string): FontSource[] {
  const sources: FontSource[] = [];
  const fontFaceReg = /@font-face\s*{([\s\S]*?)}/g;
  let match: RegExpExecArray | null;

  while ((match = fontFaceReg.exec(css))) {
    const declarations = parseCssDeclarations(match[1]);
    const family = declarations['font-family'];
    const src = declarations.src;
    if (!family || !src) {
      continue;
    }

    sources.push({
      fontFamily: trimCssValue(family),
      src: resolveCssUrls(src.trim(), cssUrl),
      descriptors: getFontFaceDescriptors(declarations),
    });
  }

  return sources;
}

export function loadFontSource({ fontFamily, src, descriptors }: FontSource): Promise<void> {
  const cacheKey = `${fontFamily}|${src}|${JSON.stringify(descriptors || {})}`;
  let promise = fontPromises.get(cacheKey);
  if (!promise) {
    promise = new FontFace(fontFamily, src, descriptors)
      .load()
      .then(async (fontFace) => {
        const fonts = getFontFaceSet();
        fonts.add?.(fontFace);
        // Worker 中等待 self.fonts.ready 在部分浏览器会一直挂起。
        // FontFace.load 已保证单个资源就绪，仅主线程需再等待文档字体集合。
        if (typeof document !== 'undefined') {
          await fonts.ready;
        }
      })
      .catch((error) => {
        // 失败结果不能进入缓存，否则同一字体后续将永远无法重试。
        fontPromises.delete(cacheKey);
        throw error;
      });
    fontPromises.set(cacheKey, promise);
  }

  return promise;
}

export async function loadFontFaceCss(fontFaceCss: string): Promise<void> {
  const sources = parseFontFaceCss(fontFaceCss);
  if (!sources.length) {
    throw new Error('字体 CSS 中未找到有效的 @font-face 声明');
  }

  await Promise.all(sources.map(loadFontSource));
}

function withFontLoadTimeout(task: Promise<void>, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${target}字体加载超时`));
    }, FONT_LOAD_TIMEOUT);

    task.then(resolve, reject).finally(() => clearTimeout(timeoutId));
  });
}

function loadFontsInWorker(worker: Worker, fontFaceCss: string, target: string) {
  try {
    worker.postMessage({ action: WorkerMessage.FontLoad, fontFaceCss });
  } catch (error) {
    // Worker 字体是渐进增强能力，发送失败不影响画布打开。
    console.warn(`${target}字体加载消息发送失败`, error);
  }
}

export async function loadFonts(owner: FontWorkerHost, fontFaceCss: string): Promise<void> {
  if (!fontFaceCss?.trim()) {
    throw new Error('字体 CSS 不能为空');
  }

  loadFontsInWorker(owner.renderWorker, fontFaceCss, '渲染线程');
  loadFontsInWorker(owner.hoverWorker, fontFaceCss, '交互线程');
  await withFontLoadTimeout(loadFontFaceCss(fontFaceCss), '主线程');
}
