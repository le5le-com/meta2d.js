import { register as topologyRegister } from '@topology/core';

import { echarts, echartsObjs } from './echarts';

declare const topology: any;

export function register(_echarts?: any) {
  echartsObjs.echarts = _echarts;
  if (!echartsObjs.echarts && !(echarts as any)) {
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
