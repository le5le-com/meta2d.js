import { instrumentOne } from './instrumentOne';
import { instrumentTwo } from './instrumentTwo';
import { lineChart } from './lineChart';
import { histogram } from './histogram';
import { pieChart } from './pieChart';

export function chartsPens() {
  return {
    instrumentOne,
    instrumentTwo,
    lineChart,
    histogram,
    pieChart,
  };
}
