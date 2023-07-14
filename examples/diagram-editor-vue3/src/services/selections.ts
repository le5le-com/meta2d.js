import { Pen } from '@meta2d/core';
import { reactive } from 'vue';

export enum SelectionMode {
  File,
  Pen,
}

const selections = reactive<{
  mode: SelectionMode;
  pen?: Pen;
}>({
  // 选中对象类型：0 - 画布；1 - 单个图元
  mode: SelectionMode.File,
  pen: undefined,
});

export const useSelection = () => {
  const select = (pens?: Pen[]) => {
    if (!pens || pens.length !== 1) {
      selections.mode = SelectionMode.File;
      selections.pen = undefined;
      return;
    }

    selections.mode = SelectionMode.Pen;
    selections.pen = pens[0];
  };
  return {
    selections,
    select,
  };
};
