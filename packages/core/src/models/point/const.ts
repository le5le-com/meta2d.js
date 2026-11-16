export enum HandleType {
  Mirror, // 对称手柄，同一直线上，对称
  Smooth, // 平滑手柄，同一直线上，不对称
  Free, // 自由手柄，不一定在一直线上，不一定对称
}

export enum TwoWay {
  Both, // 允许出线和入线
  In, // 仅允许入线
  Out, // 仅允许出线
  None, // 禁止连接
}

// 方向，顺时针，上右下左
export enum Direction {
  None = -1,
  Up,
  Right,
  Bottom,
  Left,
}
