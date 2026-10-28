import type { Pen, Point } from '@meta2d/core';
import { calcAbsPoint } from '@meta2d/core/src/models/rect/service';

type AnchorPosition = Pick<Point, 'x' | 'y'>;

const standardPositions: AnchorPosition[] = [
  { x: 0.5, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.5, y: 1 },
  { x: 0, y: 0.5 },
];

function createAnchorFn(positions: AnchorPosition[]) {
  return (pen: Pen): Point[] =>
    positions.map((position, index) => ({
      ...calcAbsPoint(pen, position),
      id: `${index}`,
    }));
}

export const defaultAnchorFn = createAnchorFn(standardPositions);
export const andGateAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 0.25, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0.75, y: 1 },
]);
export const basicEventAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 0.5, y: 1 },
]);
export const conditionalEventAnchorFn = createAnchorFn([
  { x: 0.6, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.6, y: 1 },
  { x: 0, y: 0.5 },
]);
export const forbiddenGateAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.5, y: 1 },
]);
export const orGateAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 0.2, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0.8, y: 1 },
]);
export const unexpandedEventAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 1, y: 2 / 3 },
  { x: 0.5, y: 1 },
  { x: 0, y: 2 / 3 },
]);
export const xorGateAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 0.2, y: 1 },
  { x: 0.8, y: 1 },
]);
