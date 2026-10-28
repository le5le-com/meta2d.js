import type { Meta2d } from '../../meta2d';
import type { Pen } from '../../models';

type SvgPenDraw = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  pathOrOptions?: unknown,
  pathRectOrData?: unknown,
) => unknown;

interface SvgPenDefinition {
  type: string;
  draw?: SvgPenDraw;
}

const svgDrawStores = new WeakMap<Meta2d, Record<string, SvgPenDraw>>();

function getSvgDrawStore(meta2d: Meta2d): Record<string, SvgPenDraw> {
  let store = svgDrawStores.get(meta2d);
  if (!store) {
    store = {};
    svgDrawStores.set(meta2d, store);
  }
  return store;
}

export function registerSvgDraws(meta2d: Meta2d, definitions: SvgPenDefinition[]) {
  const store = getSvgDrawStore(meta2d);
  definitions.forEach((definition) => {
    if (definition.draw) {
      store[definition.type] = definition.draw;
    }
  });
}

export function getSvgDraw(meta2d: Meta2d, type: string): SvgPenDraw | undefined {
  return getSvgDrawStore(meta2d)[type];
}
