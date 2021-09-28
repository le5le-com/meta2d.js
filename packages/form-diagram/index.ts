export * from './table';
export * from './checkbox';

import { table } from './table';
import { checkbox } from './checkbox';
import { radio } from './radio';
export function formPens() {
  return {
    table,
    checkbox,
    radio,
  };
}
