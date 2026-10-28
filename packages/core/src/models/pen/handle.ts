import { Rect } from '../rect';
import { Pen } from './pen';

// 其他图元拖拽到图元内部时的处理函数
export const dragoverFns: {
  [key: string]: (dropPen: Pen, x: number, y: number) => Rect;
} = {};
export const dropFns: {
  [key: string]: (pens: Pen[]) => any;
} = {};

// 以下为生命周期函数
// ------------------------
// 图元加载到画布时的初始化函数
export const createFns: {
  [key: string]: (meta2d: any, pen: Pen) => HTMLElement | void;
} = {};

// 图元属性变化前
export const beforeUpdateFns: {
  [key: string]: (meta2d: any, newVal: Pen, oldPen: Pen) => boolean;
} = {};

// 图元属性变化后
export const afterUpdateFns: {
  [key: string]: (meta2d: any, pen: Pen, value: any) => void;
} = {};

// 图元鼠标交互。返回false，仅执行pen自己mouse函数，阻止继续执行画布mouse函数中的后续代码
export const mouseDownFns: {
  [key: string]: (meta2d: any, pen: Pen, e: any) => boolean;
} = {};

// 图元鼠标交互。返回false，仅执行pen自己mouse函数，阻止继续执行画布mouse函数中的后续代码
export const mouseMoveFns: {
  [key: string]: (meta2d: any, pen: Pen, e: any) => boolean;
} = {};

// 图元鼠标交互。返回false，仅执行pen自己mouse函数，阻止继续执行画布mouse函数中的后续代码
export const mouseUpFns: {
  [key: string]: (meta2d: any, pen: Pen, e: any) => boolean;
} = {};

// 图元鼠标移入交互
export const mouseEnterFns: {
  [key: string]: (meta2d: any, pen: Pen) => boolean;
} = {};

// 图元鼠标移出交互
export const mouseLeaveFns: {
  [key: string]: (meta2d: any, pen: Pen) => boolean;
} = {};

// 图元自定义的输入函数。例如：下拉列表、日历等
export const inputFns: {
  [key: string]: (meta2d: any, pen: Pen, e: any) => boolean;
} = {};

// 图元滚轮交互。返回false，仅执行pen自己wheel的函数，阻止继续执行画布wheel函数中的后续代码
export const wheelFns: {
  [key: string]: (meta2d: any, pen: Pen, e: any) => boolean;
} = {};

// 画布缩放交互 主要处理dom图元
export const scaleFns: {
  [key: string]: (meta2d: any, pen: Pen, scale: number) => boolean;
} = {};

export const toPngFns: {
  [key: string]: (meta2d: any, pen: Pen) => Promise<ImageBitmap>;
} = {};

// 通知图元改变主题
export const changeThemeFns: {
  [key: string]: (meta2d: any, pen: Pen, params: any) => void;
} = {};

// 图元销毁
export const destroyFns: {
  [key: string]: (meta2d: any, pen: Pen) => void;
} = {};

export const defaultAnchorFns: {
  [key: string]: (pen: Pen) => any;
} = {};
