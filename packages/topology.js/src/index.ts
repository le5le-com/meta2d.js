import { Topology } from '@topology/core';
import { classPens } from '../../class-diagram';
import { sequencePens, sequencePensbyCtx } from '../../sequence-diagram';
import { activityDiagram, activityDiagramByCtx } from '../../activity-diagram';
import { flowPens, flowAnchors } from '../../flow-diagram';
import {
  register as registerEcharts,
  registerHighcharts,
  registerLightningChart,
} from '../../chart-diagram';
import { formPens } from '../../form-diagram';
import { ftaPens, ftaPensbyCtx, ftaAnchors } from '../../fta-diagram';
import { chartsPens } from '../../le5le-charts';

declare const window: any;

window && (window.Topology = Topology);
window &&
  (window.registerCommonDiagram = function () {
    if (window.topology) {
      registerEcharts();
      registerHighcharts();
      registerLightningChart();
      window.topology.register(flowPens());
      window.topology.registerAnchors(flowAnchors());
      window.topology.register(activityDiagram());
      window.topology.registerCanvasDraw(activityDiagramByCtx());
      window.topology.register(classPens());
      window.topology.register(sequencePens());
      window.topology.registerCanvasDraw(sequencePensbyCtx());
      window.topology.registerCanvasDraw(formPens());
      window.topology.registerCanvasDraw(chartsPens());
      window.topology.register(ftaPens());
      window.topology.registerCanvasDraw(ftaPensbyCtx());
      window.topology.registerAnchors(ftaAnchors());
    }
  });

export {
  Topology,
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
