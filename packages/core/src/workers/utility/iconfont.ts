import {
  type FontSource,
  loadFontSource,
  parseCssDeclarations,
  parseFontFaceCss,
  trimCssValue,
} from './fonts';

const cssPromises = new Map<string, Promise<FontSource[]>>();
const iconfontClassMap = new Map<string, { fontFamily: string; icon: string }>();

/**
 * 将图标字体 CSS 注入指定的 ShadowRoot，供 DOM 图元使用字体类名和 ::before 规则。
 * 同一个 ShadowRoot 中的地址只插入一次，避免重复创建样式链接。
 */
export function injectIconfontCss(cssUrl: string, shadowRoot: ShadowRoot | null) {
  if (!shadowRoot || !cssUrl?.trim()) {
    return;
  }

  const ownerDocument = shadowRoot.ownerDocument;
  let resolvedUrl: string;
  try {
    resolvedUrl = new URL(cssUrl, ownerDocument.baseURI).href;
  } catch (error) {
    console.warn(`图标字体 CSS 地址无效：${cssUrl}`, error);
    return;
  }

  const exists = Array.from(shadowRoot.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some((link) => {
    try {
      return new URL(link.href, ownerDocument.baseURI).href === resolvedUrl;
    } catch {
      return false;
    }
  });
  if (exists) {
    return;
  }

  const link = ownerDocument.createElement('link');
  link.rel = 'stylesheet';
  link.href = resolvedUrl;
  link.dataset.meta2dIconfont = 'true';
  shadowRoot.appendChild(link);
}

function unescapeCssContent(value: string) {
  const content = trimCssValue(value);
  return normalizeIconfontCodePoint(content);
}

function cacheIconfontClassMap(css: string, fontFamily: string) {
  const iconReg = /\.([_a-zA-Z][\w-]*)\s*:\s*before\s*{([\s\S]*?)}/g;
  let match: RegExpExecArray;

  while ((match = iconReg.exec(css))) {
    const declarations = parseCssDeclarations(match[2]);
    const content = declarations.content;
    if (!content) {
      continue;
    }

    iconfontClassMap.set(match[1], {
      fontFamily,
      icon: unescapeCssContent(content),
    });
  }
}

async function loadIconfontCss(cssUrl: string): Promise<FontSource[]> {
  let promise = cssPromises.get(cssUrl);
  if (!promise) {
    promise = fetch(cssUrl)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        return {
          css: await res.text(),
          resolvedCssUrl: res.url || cssUrl,
        };
      })
      .then(({ css, resolvedCssUrl }) => {
        const iconfonts = parseFontFaceCss(css, resolvedCssUrl);
        for (const iconfont of iconfonts) {
          cacheIconfontClassMap(css, iconfont.fontFamily);
        }
        return iconfonts;
      })
      .catch((error) => {
        console.warn(`Failed to load iconfont css "${cssUrl}"`, error);
        return [];
      });
    cssPromises.set(cssUrl, promise);
  }

  return promise;
}

export function normalizeIconfontCodePoint(icon: string) {
  if (!icon) {
    return '';
  }

  const value = `${icon}`.trim();
  if (!value) {
    return '';
  }

  const entityMatch = value.match(/^&#x([0-9a-fA-F]{1,6});?$/) || value.match(/^&#(\d{1,7});?$/);
  if (entityMatch) {
    const radix = value.startsWith('&#x') ? 16 : 10;
    return String.fromCodePoint(parseInt(entityMatch[1], radix));
  }

  const unicodeMatch =
    value.match(/^\\u\{([0-9a-fA-F]{1,6})}$/) ||
    value.match(/^\\u([0-9a-fA-F]{4,6})$/) ||
    value.match(/^\\([0-9a-fA-F]{1,6})\s?$/) ||
    value.match(/^0x([0-9a-fA-F]{1,6})$/i) ||
    value.match(/^u\+([0-9a-fA-F]{1,6})$/i);
  if (unicodeMatch) {
    return String.fromCodePoint(parseInt(unicodeMatch[1], 16));
  }

  if (/^[0-9a-fA-F]{4,6}$/.test(value)) {
    return String.fromCodePoint(parseInt(value, 16));
  }

  return value;
}

export function resolveIconfontIcon(icon: string, iconFamily?: string) {
  const normalizedIcon = normalizeIconfontCodePoint(icon);
  if (!normalizedIcon) {
    return;
  }

  if (normalizedIcon !== icon) {
    return {
      fontFamily: iconFamily,
      icon: normalizedIcon,
    };
  }

  const classNames = icon
    .split(/\s+/)
    .map((item) => item.trim().replace(/^#|\./, ''))
    .filter(Boolean);

  for (const className of classNames) {
    const cached = iconfontClassMap.get(className);
    if (cached) {
      return cached;
    }
  }

  if (iconFamily && iconfontClassMap.has(icon)) {
    return iconfontClassMap.get(icon);
  }
}

export function loadIconfonts(iconfonts?: string[]): Promise<void> {
  if (!iconfonts?.length) {
    return Promise.resolve();
  }

  const promises = iconfonts.map(async (cssUrl) => {
    const sources = await loadIconfontCss(cssUrl);
    await Promise.all(
      sources.map((source) =>
        loadFontSource(source).catch((error) => {
          // 图标字体保持历史兼容行为：加载失败只告警，不阻断画布。
          console.warn(`Failed to load iconfont "${source.fontFamily}" from ${source.src}`, error);
        }),
      ),
    );
  });

  return Promise.all(promises).then(() => undefined);
}
