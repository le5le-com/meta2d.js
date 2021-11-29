import { table } from './table';
import { checkboxItem } from './checkboxItem';
import { radioItem } from './radioItem';
import { checkbox } from './checkbox';
import { radio } from './radio';
import { leSwitch } from './leSwitch';
import { slider } from './slider';
import { button } from './button';
import { commonAnchors } from './commonAnchors';
export function formPens() {
  return {
    radio,
    switch: leSwitch,
    slider,
    checkbox,
    table,
    radioItem,
    checkboxItem,
    // button,
  };
}

export function formPensbyNew() {
  return {
    button,
  };
}

export function formCommonAnchors() {
  return {
    radio: commonAnchors,
    leSwitch: commonAnchors,
    slider: commonAnchors,
    checkbox: commonAnchors,
    table: commonAnchors,
    radioItem: commonAnchors,
    checkboxItem: commonAnchors,
    button: commonAnchors,
  };
}
