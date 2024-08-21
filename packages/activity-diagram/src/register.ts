import { Pen } from '../../core';
import { rectangle } from '../../core/src/diagrams';
import { activityFinal } from './final';
import { swimlaneH } from './swimlaneH';
import { swimlaneV } from './swimlaneV';

export function activityDiagram(): Record<
  string,
  (pen: Pen, ctx?: CanvasRenderingContext2D) => Path2D
> {
  return {
    forkV: rectangle,
    forkH: rectangle,
    swimlaneH,
    swimlaneV,
  };
}

export function activityDiagramByCtx() {
  return {
    activityFinal,
  };
}
