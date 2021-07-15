export * from './rectangle';
export * from './circle';
export * from './svgPath';

import { rectangle } from './rectangle';
import { circle } from './circle';
import { svgPath } from './svgPath';

export function commonPens() {
  return {
    rectangle,
    circle,
    svgPath,
  };
}
