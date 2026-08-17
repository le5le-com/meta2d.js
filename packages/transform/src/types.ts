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
 * 当前视角状态（x/y/z 旋转角度 + 视距）
 */
export interface ViewState {
  x: number;
  y: number;
  z: number;
  dist: number;
}

export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/**
 * 视角变换动画配置
 */
export interface AnimationOptions {
  duration?: number; // 动画时长（毫秒），默认 500
  easing?: EasingName | ((t: number) => number); // 缓动函数，默认 'ease-in-out'
  onUpdate?: (view: ViewState) => void; // 每帧回调当前视角（可用于同步生成背景网格）
  onComplete?: () => void; // 动画结束回调
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
  animation?: boolean | AnimationOptions; // 视角切换动画：从当前视角平滑过渡到目标视角，true 使用默认配置
}

/**
 * 背景网格生成参数（视角参数与 PerspectiveOptions 一致，
 * 传入与 transformPens 相同的 x/y/z/dist/center 即可保持同一视角）
 */
export interface GridBackgroundOptions extends PerspectiveOptions {
  width: number; // 输出图片宽度（像素）
  height: number; // 输出图片高度（像素）
  spacing?: number; // 网格间距（世界坐标），默认 60
  lineColor?: string; // 网格线颜色，默认 'rgba(140,170,230,0.35)'
  lineWidth?: number; // 网格线宽，默认 1
  background?: string; // 背景底色，默认 '#060c22'
  glow?: boolean; // 是否绘制中心光晕，默认 true
  glowColor?: string; // 中心光晕颜色，默认 'rgba(80,120,200,0.55)'
  glowRadius?: number; // 光晕半径系数（相对画面半径），越小中心亮区越集中，默认 0.6
  vignette?: boolean; // 是否边缘压暗（网格向四周渐隐），默认 true
  vignetteStart?: number; // 暗角起始半径系数（相对画面半径），越小暗角范围越大，默认 0.25
  vignetteStrength?: number; // 暗角边缘最大不透明度 0~1，越大四周越暗，默认 0.97
}
