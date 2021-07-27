import { Topology } from '@topology/core';
import { ftaPens } from'../../fta-diagram';
import { iotPens } from'../../iot-diagram';
import { classPens } from '../../class-diagram';
import { sequencePens } from '../../sequence-diagram';
import { activityDiagram } from '../../activity-diagram';

declare const window: any;

window.Topology = Topology;
window.ftaPens = ftaPens;
window.iotPens = iotPens;
window.classPens = classPens;
window.sequencePens = sequencePens;
window.activityDiagram = activityDiagram;
export {
  Topology,
  ftaPens,
  iotPens,
  classPens,
  sequencePens,
  activityDiagram
};
