import { Topology } from '@topology/core';
import { classPens } from '../../class-diagram';
import { sequencePens } from '../../sequence-diagram';
import { activityDiagram } from '../../activity-diagram';

import { flowPens } from '../../flow-diagram';
declare const window: any;

window && (window.Topology = Topology);
export { Topology, classPens, sequencePens, activityDiagram, flowPens };
