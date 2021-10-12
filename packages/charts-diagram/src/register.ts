import { lineChart } from './lineChart';
import { histogram } from './histogram';
import { pieChart } from './pieChart';
import { gauge } from './gauge';

export function chartsPens() {
  return {
    lineChart,
    histogram,
    pieChart,
    gauge,
  };
}
