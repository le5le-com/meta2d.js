import { Topology } from '@topology/core';
import { ftaPens } from'../../fta-diagram';
import { iotPens } from'../../iot-diagram';
import { classPens } from '../../class-diagram';

declare const window: any;

window.Topology = Topology;
window.ftaPens = ftaPens;
window.iotPens = iotPens;
window.classPens = classPens;
export {
  Topology,
  ftaPens,
  iotPens,
  classPens
};
