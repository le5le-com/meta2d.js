import { Pen, Rect } from '../models';

export interface Action {
  add?: Pen[];
  remove?: Pen[];
  beforeUpdate?: Pen[];
  update?: Pen[];
  beforeBoundary?: Rect;
  boundary?: Rect;
  activeIds?: string[]; // 操作发起时选中的图元，用于撤销、重做后恢复原选区
  collaborate?: boolean; // 是否在线多人协作操作
}

export enum ActionType {
  Add,
  Remove,
  Update,
}
