import { lineChart } from './lineChart';
import { histogram } from './histogram';
import { pieChart } from './pieChart';
import { gauge } from './gauge';
import { heatmap } from './heatmap';


export function chartsPens() {
  return {
    lineChart,
    histogram,
    pieChart,
    gauge,
    heatmap,
  };
}
