export * from './instrumentOne';
export * from './instrumentTwo';

import { instrumentOne, instrumentOnebyCtx } from './instrumentOne';
import { instrumentTwo, instrumentTwobyCtx } from './instrumentTwo';
export function lechartsPens() {
  return {
    instrumentOne,
    instrumentOnebyCtx,
    instrumentTwo,
    instrumentTwobyCtx,
  };
}
