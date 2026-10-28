import type { Pen, Point } from '@meta2d/core';
import { calcAbsPoint } from '@meta2d/core/src/models/rect/service';

const positions = [
  { x: 0.5, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.5, y: 1 },
  { x: 0, y: 0.5 },
];

export function defaultAnchorFn(pen: Pen): Point[] {
  return positions.map((position, index) => ({
    ...calcAbsPoint(pen, position),
    id: `${index}`,
  }));
}
