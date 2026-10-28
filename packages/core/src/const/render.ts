// 正上开始顺时针旋转8个大小控制点
export const ResizePoints = [
  { x: 0.5, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0.5 },
  { x: 1, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0, y: 1 },
  { x: 0, y: 0.5 },
  { x: 0, y: 0 },
] as const;

export const ResizeCursors = [
  'ns-resize',
  'nesw-resize',
  'ew-resize',
  'nwse-resize',
  'ns-resize',
  'nesw-resize',
  'ew-resize',
  'nwse-resize',
];

export const RotateCursors = [
  `url('rotate1.svg') 12 12, grabbing`,
  `url('rotate2.svg') 12 12, grabbing`,
  `url('rotate3.svg') 12 12, grabbing`,
  `url('rotate4.svg') 12 12, grabbing`,
];
