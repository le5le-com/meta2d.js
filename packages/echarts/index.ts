import { beforeUpdate, afterUpdate, changeTheme, create, toPng, destroy, scale } from './src/echarts';

export const penDefines = [
  {
    type: 'echarts',
    create,
    beforeUpdate,
    afterUpdate,
    toPng,
    destroy,
    scale,
    changeTheme,
  },
];
