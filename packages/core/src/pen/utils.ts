import { s8 } from '@topology/core';
import { Pen } from './model';

export function randomId(pen: Pen) {
  pen.id = s8();
  for (const pt of pen.anchors) {
    pt.id = s8();
    pt.penId = pen.id;
    if (pt.prev) {
      pt.prev.id = s8();
      pt.prev.penId = pen.id;
    }

    if (pt.next) {
      pt.next.id = s8();
      pt.next.penId = pen.id;
    }
  }

  if (pen.children && pen.calculative) {
    for (const childId of pen.children) {
      const child = pen.calculative.canvas.store[childId];
      if (!child) {
        continue;
      }
      child.parentId = pen.id;
      randomId(child);
    }
  }
}
