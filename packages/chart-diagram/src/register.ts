import { register as meta2dRegister } from '@meta2d/core';

import { echarts } from './echarts';
import { highcharts } from './highcharts';
import { lightningCharts } from './LightningChart';

export function register(_echarts?: any) {
  _echarts && (globalThis.echarts = _echarts);
  meta2dRegister({ echarts });
}

export function registerHighcharts(_highcharts?: any) {
  _highcharts && (globalThis.Highcharts = _highcharts);
  meta2dRegister({ highcharts });
}

export function registerLightningChart(_lightningCharts?: any) {
  _lightningCharts && (globalThis.lcjs = _lightningCharts);
  meta2dRegister({ lightningCharts });
}
