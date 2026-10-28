import { Point } from '../point';

export interface Rect {
  x?: number;
  y?: number;
  ex?: number;
  ey?: number;
  width?: number;
  height?: number;
  rotate?: number;
  pivot?: Point; //旋转中心

  box?: Rect; // 包围盒。旋转和文字溢出等因素会导致包围盒比原始rect大

  // 临时变量
  index?: number;
  _rotate?: number; // 拖拽旋转或动态变化前，临时备份旧值
  _rect?: Rect; // 新大小
  pathVals?: any; // 路径方式访问的数据值
}
