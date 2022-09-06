import { register as topologyRegister } from '@topology/core';

import { echarts, echartsList } from './echarts';
import { highcharts, highchartsList } from './highcharts';
import { lightningCharts, lightningChartsList } from './LightningChart';

export function register(_echarts?: any) {
  echartsList.echarts = _echarts;
  topologyRegister({ echarts });
}

export function registerHighcharts(_highcharts?: any) {
  highchartsList.highcharts = _highcharts;
  topologyRegister({ highcharts });
}

export function registerLightningChart(_lightningCharts?: any) {
  lightningChartsList.lightningChart = _lightningCharts;
  topologyRegister({ lightningCharts });
}
