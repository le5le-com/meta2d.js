import { Pen } from '@meta2d/core';
import { reactive } from 'vue';

export enum SelectionMode {
  File,
  Pen,
  Pens,
}

const selections = reactive<{
  mode: SelectionMode;
  pen?: Pen;
  pens?: Pen[];
}>({
  mode: SelectionMode.File,
  pen: undefined,
  pens: undefined,
});

export const useSelection = () => {
  const select = (pens?: Pen[]) => {
    if (!pens || !pens.length) {
      selections.mode = SelectionMode.File;
      selections.pen = undefined;
      selections.pens = undefined;
      return;
    }

    if (pens.length > 1) {
      selections.mode = SelectionMode.Pens;
      selections.pen = undefined;
      selections.pens = pens;
    } else {
      selections.mode = SelectionMode.Pen;
      selections.pen = structuredClone(pens[0]);
      selections.pens = undefined;
    }
  };
  return {
    selections,
    select,
  };
};
