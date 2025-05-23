import { Meta2d } from '@meta2d/core';
import { classPens } from '@meta2d/class-diagram';
import { sequencePens, sequencePensbyCtx } from '@meta2d/sequence-diagram';
import {
  activityDiagram,
  activityDiagramByCtx,
} from '@meta2d/activity-diagram';
import { flowPens, flowAnchors } from '@meta2d/flow-diagram';
import {
  register as registerEcharts,
  registerHighcharts,
  registerLightningChart,
} from '@meta2d/chart-diagram';
import { formPens } from '@meta2d/form-diagram';
import { ftaPens, ftaPensbyCtx, ftaAnchors } from '@meta2d/fta-diagram';
import { chartsPens } from '@meta2d/le5le-charts';
export * from "@meta2d/core"

globalThis.Meta2d = Meta2d;
globalThis.registerCommonDiagram = function () {
  const meta2d = globalThis.meta2d;
  if (meta2d) {
    registerEcharts();
    registerHighcharts();
    registerLightningChart();
    meta2d.register(flowPens());
    meta2d.registerAnchors(flowAnchors());
    meta2d.register(activityDiagram());
    meta2d.registerCanvasDraw(activityDiagramByCtx());
    meta2d.register(classPens());
    meta2d.register(sequencePens());
    meta2d.registerCanvasDraw(sequencePensbyCtx());
    meta2d.registerCanvasDraw(formPens());
    meta2d.registerCanvasDraw(chartsPens());
    meta2d.register(ftaPens());
    meta2d.registerCanvasDraw(ftaPensbyCtx());
    meta2d.registerAnchors(ftaAnchors());
  }
};

export {
  Meta2d,
  classPens,
  sequencePens,
  activityDiagram,
  flowPens,
  sequencePensbyCtx,
  activityDiagramByCtx,
  formPens,
  ftaPens,
  ftaPensbyCtx,
  ftaAnchors,
  chartsPens,
  flowAnchors,
  registerEcharts,
  registerHighcharts,
  registerLightningChart,
};
