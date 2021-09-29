export * from './instrumentOne';
export * from './instrumentTwo';

import { instrumentOne } from './instrumentOne';
import { instrumentTwo } from './instrumentTwo';
export function lechartsPens() {
  return {
    instrumentOne,
    instrumentTwo,
  };
}
