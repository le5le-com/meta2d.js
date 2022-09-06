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

globalThis.Topology = Topology;
globalThis.registerCommonDiagram = function () {
  const topology = globalThis.topology;
  if (topology) {
    registerEcharts();
    registerHighcharts();
    registerLightningChart();
    topology.register(flowPens());
    topology.registerAnchors(flowAnchors());
    topology.register(activityDiagram());
    topology.registerCanvasDraw(activityDiagramByCtx());
    topology.register(classPens());
    topology.register(sequencePens());
    topology.registerCanvasDraw(sequencePensbyCtx());
    topology.registerCanvasDraw(formPens());
    topology.registerCanvasDraw(chartsPens());
    topology.register(ftaPens());
    topology.registerCanvasDraw(ftaPensbyCtx());
    topology.registerAnchors(ftaAnchors());
  }
};

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
