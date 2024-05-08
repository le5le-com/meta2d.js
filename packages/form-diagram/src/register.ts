import { table } from './table';
import { le5leSwitch } from './switch';
import { slider } from './slider';
import { checkbox } from './checkbox';
import { radio } from './radio';
import { table2 } from './table2';
import { time } from './time';
import { table3 } from './table3';

export function formPens() {
  return {
    radio,
    switch: le5leSwitch,
    slider,
    checkbox,
    table:table3,
    table2:table3,
  };
}

export function formPath2DPens() {
  return {
    time,
  };
}
