export enum HandleType {
  Mirror, // 对称手柄，同一直线上，对称
  Smooth, // 平滑手柄，同一直线上，不对称
  Free, // 自由手柄，不一定在一直线上，不一定对称
}

export enum TwoWay {
  Both,
  In,
  Out,
  None,
}

// 方向，顺时针，上右下左
export enum Direction {
  None = -1,
  Up,
  Right,
  Bottom,
  Left,
}
