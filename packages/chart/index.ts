import { defaultAnchorFn } from './src/anchors';
import { gaugeDefine } from './src/gauge';
import { destroyHeatmap, heatmap } from './src/heatmap';
import { histogram } from './src/histogram';
import { lineChart } from './src/lineChart';
import { pieChart } from './src/pieChart';
import { beforeCartesianUpdate, beforeSeriesUpdate } from './src/update';

export const penDefines = [
  { type: 'lineChart', draw: lineChart, beforeUpdate: beforeCartesianUpdate, defaultAnchorFn },
  { type: 'histogram', draw: histogram, beforeUpdate: beforeCartesianUpdate, defaultAnchorFn },
  { type: 'pieChart', draw: pieChart, beforeUpdate: beforeSeriesUpdate, defaultAnchorFn },
  { ...gaugeDefine, defaultAnchorFn },
  { type: 'heatmap', draw: heatmap, destroy: destroyHeatmap, defaultAnchorFn },
];

export { scaleCompute, fixedNum, numberValid } from './src/normalizedAxis';
export type { ScaleOption, ScaleResult } from './src/normalizedAxis';
