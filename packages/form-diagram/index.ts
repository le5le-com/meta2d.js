export * from './table';
export * from './checkbox';
export * from './radio';
export * from './leSwitch';
export * from './progress';
export * from './radioItem';
export * from './checkboxItem';

import { table } from './table';
import { checkboxItem } from './checkboxItem';
import { radioItem } from './radioItem';
import { checkbox } from './checkbox';
import { radio } from './radio';
import { leSwitch } from './leSwitch';
import { progress } from './progress';

export function formPens() {
  return {
    radio,
    leSwitch,
    progress,
    checkbox,
    table,
    radioItem,
    checkboxItem,
  };
}
