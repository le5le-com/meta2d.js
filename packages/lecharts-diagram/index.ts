export * from './instrumentOne';
export * from './instrumentTwo';
export * from './lineChart';

import { instrumentOne } from './instrumentOne';
import { instrumentTwo } from './instrumentTwo';
import { lineChart } from './lineChart';
import { histogram } from './histogram';

export function lechartsPens() {
  return {
    instrumentOne,
    instrumentTwo,
    lineChart,
    histogram,
  };
}
