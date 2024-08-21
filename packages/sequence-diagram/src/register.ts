import { Pen } from '../../core';
import { focus } from './focus';
import { lifeline } from './lifeline';

export function sequencePens(): Record<
  string,
  (pen: Pen, ctx?: CanvasRenderingContext2D) => Path2D
> {
  return {
    sequenceFocus: focus,
  };
}
export function sequencePensbyCtx() {
  return {
    lifeline,
  };
}
