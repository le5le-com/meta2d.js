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
