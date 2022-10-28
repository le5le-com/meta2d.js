import { register as topologyRegister } from '@topology/core';

import { echarts } from './echarts';
import { highcharts } from './highcharts';
import { lightningCharts } from './LightningChart';

export function register(_echarts?: any) {
  _echarts && (globalThis.echarts = _echarts);
  topologyRegister({ echarts });
}

export function registerHighcharts(_highcharts?: any) {
  _highcharts && (globalThis.Highcharts = _highcharts);
  topologyRegister({ highcharts });
}

export function registerLightningChart(_lightningCharts?: any) {
  _lightningCharts && (globalThis.lcjs = _lightningCharts);
  topologyRegister({ lightningCharts });
}
