import { table } from './table';
import { checkboxItem } from './checkboxItem';
import { radioItem } from './radioItem';
import { checkbox } from './checkbox';
import { radio } from './radio';
import { leSwitch } from './leSwitch';
import { progress } from './progress';
import { button } from './button';

export function formPens() {
  return {
    radio,
    leSwitch,
    progress,
    checkbox,
    table,
    radioItem,
    checkboxItem,
    button,
  };
}
