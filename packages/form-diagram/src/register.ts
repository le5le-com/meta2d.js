import { table } from './table';
import { le5leSwitch } from './switch';
import { slider } from './slider';
import { checkbox } from './checkbox';
import { radio } from './radio';
import { table2 } from './table2';
import { time } from './time';

export function formPens() {
  return {
    radio,
    switch: le5leSwitch,
    slider,
    checkbox,
    table,
    table2,
  };
}

export function formPath2DPens() {
  return {
    time,
  };
}
