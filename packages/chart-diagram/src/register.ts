import { register as topologyRegister } from '@topology/core';

import { echarts, echartsList } from './echarts';
import { highcharts, highchartsList } from './highcharts';
import { lightningCharts, lightningChartsList } from './LightningChart';
declare const topology: any;

export function register(_echarts?: any) {
  echartsList.echarts = _echarts;
  if (!echartsList.echarts && !(echarts as any)) {
    const loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src =
      'https://cdn.bootcdn.net/ajax/libs/echarts/5.1.2/echarts.min.js';
    loaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(loaderScript);
  }
  topologyRegister({ echarts });
}

export function registerHighcharts(_highcharts?: any) {
  highchartsList.hightcharts = _highcharts;
  if (!highchartsList.highcharts && !(highcharts as any)) {
    const loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src = 'http://cdn.highcharts.com.cn/highcharts/highcharts.js';
    loaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(loaderScript);

    // const mloaderScript = document.createElement('script');
    // mloaderScript.type = 'text/javascript';
    // mloaderScript.src =
    //   'https://cdn.highcharts.com.cn/highcharts/highcharts-more.js';
    // mloaderScript.addEventListener('load', () => {
    //   topology.render(Infinity);
    // });
    // document.body.appendChild(mloaderScript);
    // const loaderScriptexport = document.createElement('script');
    // loaderScriptexport.type = 'text/javascript';
    // loaderScriptexport.src =
    //   'http://cdn.highcharts.com.cn/highcharts/9.2.2/modules/exporting.js';
    // loaderScriptexport.addEventListener('load', () => {
    //   topology.render(Infinity);
    // });
    // document.body.appendChild(loaderScriptexport);

    // const loaderScriptoffline = document.createElement('script');
    // loaderScriptoffline.type = 'text/javascript';
    // loaderScriptoffline.src =
    //   'http://cdn.highcharts.com.cn/highcharts/9.2.2/modules/offline-exporting.js';
    // loaderScriptoffline.addEventListener('load', () => {
    //   topology.render(Infinity);
    // });
    // document.body.appendChild(loaderScriptoffline);
  }
  topologyRegister({ highcharts });
}

export function registerLightningChart(_lightningCharts?: any) {
  lightningChartsList.lightningChart = _lightningCharts;
  if (!lightningChartsList.lightningChart && !(lightningCharts as any)) {
    const loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src = 'lcjs.iife.js';
    loaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(loaderScript);
  }
  topologyRegister({ lightningCharts });
}
