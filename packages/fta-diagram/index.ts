export * from './andGate';
export * from './basicEvent';
export * from './conditionalEvent';
export * from './event';
export * from './forbiddenGate';
export * from './orGate';
export * from './priorityAndGate';
export * from './switchEvent';
export * from './transferSymbol';
export * from './unexpandedEvent';
export * from './xorGate';
export * from './votingGate';

import { andGate } from './andGate';
import { basicEvent } from './basicEvent';
import { conditionalEvent } from './conditionalEvent';
import { event } from './event';
import { forbiddenGate } from './forbiddenGate';
import { orGate } from './orGate';
import { priorityAndGate } from './priorityAndGate';
import { switchEvent } from './switchEvent';
import { transferSymbol } from './transferSymbol';
import { unexpandedEvent } from './unexpandedEvent';
import { votingGate ,votingGateChartByCtx} from './votingGate';
import { xorGate } from './xorGate';

export function ftaPens() {
  return {
    andGate,
    basicEvent,
    conditionalEvent,
    event,
    forbiddenGate,
    orGate,
    priorityAndGate,
    switchEvent,
    transferSymbol,
    unexpandedEvent,
    xorGate,
    votingGate,
    votingGateChartByCtx
  };
}