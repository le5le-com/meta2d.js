export * from './instrumentOne';
export * from './instrumentTwo';
export * from './lineChart';
export * from './pieChart';

import { instrumentOne } from './instrumentOne';
import { instrumentTwo } from './instrumentTwo';
import { lineChart } from './lineChart';
import { histogram } from './histogram';
import { pieChart } from './pieChart';

export function lechartsPens() {
  return {
    instrumentOne,
    instrumentTwo,
    lineChart,
    histogram,
    pieChart,
  };
}
