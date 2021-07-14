export * from './rectangle';
export * from './circle';
export * from './svg/svgPath';

import { rectangle } from './rectangle';
import { circle } from './circle';
import { svgPath } from './svg/svgPath';

export function commonPens() {
  return {
    rectangle,
    circle,
    svgPath,
  };
}
