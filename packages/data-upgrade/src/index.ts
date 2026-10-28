import { intPenCoordinates, Meta2dData } from '@meta2d/core';
import { buildMeta2dData } from './canvas';
import { convertPens } from './pen';

export function dataUpgrade(data: any) {
  calcCoordinates(data);
  return buildMeta2dData(data, convertPens(data.pens));
}

export function componentsUpgrade(data: any) {
  const origin = data.origin;
  const scale = data.scale;

  data.componentDatas.forEach((pen: any) => {
    if (!pen.parentId) {
      pen.x = (pen.x - origin.x) / scale;
      pen.y = (pen.y - origin.y) / scale;
      pen.width /= scale;
      pen.height /= scale;
      intPenCoordinates(pen);
      delete pen.ex;
      delete pen.ey;
      delete pen.center;
      deepgetRect(pen, data.componentDatas);
    }
  });

  data.origin = {
    x: 0,
    y: 0,
  };
  data.scale = 1;
  // convertPens 会生成新版图元数组，必须回写，否则原图元的 type 已在转换过程中被删除。
  data.componentDatas = convertPens(data.componentDatas);
  return data;
}

function calcCoordinates(data: any) {
  const origin = data.origin;
  const scale = data.scale;

  data.pens.forEach((pen: any) => {
    if (!pen.parentId) {
      pen.x = (pen.x - origin.x) / scale;
      pen.y = (pen.y - origin.y) / scale;
      pen.width /= scale;
      pen.height /= scale;
      intPenCoordinates(pen);
      delete pen.ex;
      delete pen.ey;
      delete pen.center;
      deepgetRect(pen, data.pens);
    }
  });

  data.origin = {
    x: 0,
    y: 0,
  };
  data.scale = 1;
}

function deepgetRect(pen: any, pens: any[]) {
  if (pen.children?.length) {
    pens
      .filter((item: any) => pen.children.includes(item.id) || item.parentId === pen.id)
      .forEach((cpen) => {
        cpen.x = pen.x + cpen.x * pen.width;
        cpen.y = pen.y + cpen.y * pen.height;
        cpen.width = cpen.width * pen.width;
        cpen.height = cpen.height * pen.height;
        delete cpen.ex;
        delete cpen.ey;
        delete cpen.center;
        intPenCoordinates(cpen);
        deepgetRect(cpen, pens);
      });
  }
}

export function versionIsBefore(version1: string, version2: string = '2.0.0') {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);

  if (v1[0] !== v2[0]) {
    return v1[0] < v2[0];
  }
  return false;
}

export type { Meta2dData };
