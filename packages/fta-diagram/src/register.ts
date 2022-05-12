import { Pen } from '@topology/core';
import { andGate, andGateAnchors } from './andGate';
import { basicEvent, basicEventAnchors } from './basicEvent';
import { conditionalEvent, conditionalEventAnchors } from './conditionalEvent';
import { event } from './event';
import { forbiddenGate, forbiddenGateAnchors } from './forbiddenGate';
import { orGate, orGateAnchors } from './orGate';
import { priorityAndGate } from './priorityAndGate';
import { switchEvent } from './switchEvent';
import { transferSymbol } from './transferSymbol';
import { unexpandedEvent, unexpandedEventAnchors } from './unexpandedEvent';
import { votingGate } from './votingGate';
import { xorGate, xorGateAnchors } from './xorGate';

export function ftaPens(): Record<
  string,
  (pen: Pen, ctx?: CanvasRenderingContext2D) => Path2D
> {
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
  };
}

export function ftaPensbyCtx() {
  return {
    votingGate,
  };
}

export function ftaAnchors() {
  return {
    andGate: andGateAnchors,
    orGate: orGateAnchors,
    priorityAndGate: andGateAnchors,
    votingGate: orGateAnchors,
    xorGate: xorGateAnchors,
    forbiddenGate: forbiddenGateAnchors,
    basicEvent: basicEventAnchors,
    unexpandedEvent: unexpandedEventAnchors,
    conditionalEvent: conditionalEventAnchors,
    transferSymbol: basicEventAnchors,
  };
}
