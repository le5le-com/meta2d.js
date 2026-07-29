export type Point = {
  x: number;
  y: number;
}

export interface PlateForm  { // 核心库平台

}

export interface Node {

}

export interface Engine {

}

export interface Options {
  onlyLine?: boolean; // 仅仅处理连线
}

export interface Inject {
  isLine: (node:Node)=> boolean
}

export interface TransformData {
  coordinate: 'canvas' // 坐标系统
  dim: 2 | 3 // 维度
  x: number, // x轴旋转
  y: number, // y轴旋转
  z: number, // z轴旋转
  center: Point, // 环绕中心点
  dist: number // 视距
}

/**
 * 视角变换参数
 */
export interface PerspectiveOptions {
  x?: number; // 绕 x 轴旋转角度（度）
  y?: number; // 绕 y 轴旋转角度（度）
  z?: number; // 绕 z 轴旋转角度（度）
  dist?: number; // 视距，默认 1000，越小透视变形越强
  center?: Point; // 环绕中心点（画布世界坐标），缺省时取所有目标图元原始位置的总包围盒中心（统一中心）
  rotate?: boolean; // 普通图元是否应用视角产生的旋转（取投影四边形顶边倾角的近似值），默认 true；仅对普通图元生效
}
