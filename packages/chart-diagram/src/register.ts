import { register as topologyRegister } from '@topology/core';

import { echarts, echartsList } from './echarts';

declare const topology: any;

export function register(_echarts?: any) {
  echartsList.echarts = _echarts;
  if (!echartsList.echarts && !(echarts as any)) {
    const loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src = 'https://cdn.bootcdn.net/ajax/libs/echarts/5.1.2/echarts.min.js';
    loaderScript.addEventListener('load', () => {
      topology.render(Infinity);
    });
    document.body.appendChild(loaderScript);
  }
  topologyRegister({ echarts });
}
