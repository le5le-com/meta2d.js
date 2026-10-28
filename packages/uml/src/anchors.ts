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
export const flowCommentAnchorFn = createAnchorFn([
  { x: 0.25, y: 0 },
  { x: 0.25, y: 1 },
  { x: 0, y: 0.5 },
]);
export const flowDataAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 13 / 14, y: 0.5 },
  { x: 0.5, y: 1 },
  { x: 1 / 14, y: 0.5 },
]);
export const flowDocumentAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.5, y: 6 / 7 },
  { x: 0, y: 0.5 },
]);
export const flowManuallyAnchorFn = createAnchorFn([
  { x: 0.5, y: 0.125 },
  { x: 1, y: 0.5 },
  { x: 0.5, y: 1 },
  { x: 0, y: 0.5 },
]);
export const flowParallelAnchorFn = createAnchorFn([
  { x: 0.5, y: 0 },
  { x: 0.5, y: 1 },
]);
