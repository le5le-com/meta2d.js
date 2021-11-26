import { Pen } from '../../core/src/pen';
import { Point } from '../../core';

export function commonAnchors(pen: Pen) {
  const anchors: Point[] = [];
  pen.anchors = anchors;
}
