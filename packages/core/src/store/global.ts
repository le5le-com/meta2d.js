import pkg from '../../package.json';
import { Pen } from '../pen';
import {Point} from "@meta2d/core";

export interface GridDrawerContext {
  store: any;
  canvas: HTMLCanvasElement;
}

export type GridDrawer = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  context: GridDrawerContext,
  mousePos: Point
) => boolean | undefined;

export const globalStore: {
  version: string;
  path2dDraws: {
    [key: string]: (pen: Pen, ctx?: CanvasRenderingContext2D) => Path2D;
  };
  canvasDraws: {
    [key: string]: (ctx: CanvasRenderingContext2D, pen: Pen) => void;
  };
  lineAnimateDraws: {
    [key: string]: (ctx:CanvasRenderingContext2D, pen: Pen, state: any,index:number) => void
  }
  anchors: { [key: string]: (pen: Pen) => void }; // TODO: 存储的是 副作用 函数，函数内修改 anchors
  htmlElements: { [key: string]: HTMLImageElement }; // 目前只存在图片资源，此处使用 HTMLImageElement
  gridDrawers: { [key: string]: GridDrawer };
} = {
  version: pkg.version,
  path2dDraws: {},
  canvasDraws: {},
  anchors: {},
  lineAnimateDraws:{},
  htmlElements: {},
  gridDrawers: {},
};

export function register(path2dFns: {
  [key: string]: (pen: Pen, ctx?: CanvasRenderingContext2D) => Path2D;
}) {
  Object.assign(globalStore.path2dDraws, path2dFns);
}

export function registerCanvasDraw(drawFns: {
  [key: string]: (ctx: CanvasRenderingContext2D, pen: Pen) => void;
}) {
  Object.assign(globalStore.canvasDraws, drawFns);
}

export function registerAnchors(anchorsFns: {
  [key: string]: (pen: Pen) => void;
}) {
  Object.assign(globalStore.anchors, anchorsFns);
}

export function registerLineAnimateDraws(lineAnimateDraws: {
  [key: string]: (ctx:CanvasRenderingContext2D, line:Pen, pos:any, index:number)=>void
}) {
  Object.assign(globalStore.lineAnimateDraws, lineAnimateDraws);
}

export function registerGridDrawer(name: string, drawer: GridDrawer) {
  globalStore.gridDrawers[name] = drawer;
}

export function unregisterGridDrawer(name: string) {
  delete globalStore.gridDrawers[name];
}
