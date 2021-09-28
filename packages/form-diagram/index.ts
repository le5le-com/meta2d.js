export * from './table';
export * from './checkbox';

import { table } from './table';
import { checkbox, checkboxTextByCtx } from './checkbox';
import { radio, radioTextByCtx } from './radio';
export function formPens() {
  return {
    table,
    checkbox,
    checkboxTextByCtx,
    radio,
    radioTextByCtx,
  };
}
