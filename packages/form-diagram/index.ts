export * from './table';
export * from './checkbox';
export * from './leSwitch';
export * from './progress';
import { table } from './table';
import { checkbox } from './checkbox';
import { radio } from './radio';
import { leSwitch } from './leSwitch';
import { progress } from './progress';

export function formPens() {
  return {
    table,
    checkbox,
    radio,
    leSwitch,
    progress,
  };
}
