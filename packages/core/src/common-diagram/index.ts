export * from './rectangle';
export * from './circle';

import { rectangle } from './rectangle';
import { circle } from './circle';

export function commonPens() {
  return {
    rectangle,
    circle
  };
}
