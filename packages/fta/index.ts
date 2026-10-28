import { andGate } from './src/andGate';
import {
  andGateAnchorFn,
  basicEventAnchorFn,
  conditionalEventAnchorFn,
  defaultAnchorFn,
  forbiddenGateAnchorFn,
  orGateAnchorFn,
  unexpandedEventAnchorFn,
  xorGateAnchorFn,
} from './src/anchors';
import { basicEvent } from './src/basicEvent';
import { conditionalEvent } from './src/conditionalEvent';
import { event } from './src/event';
import { forbiddenGate } from './src/forbiddenGate';
import { orGate } from './src/orGate';
import { priorityAndGate } from './src/priorityAndGate';
import { switchEvent } from './src/switchEvent';
import { transferSymbol } from './src/transferSymbol';
import { unexpandedEvent } from './src/unexpandedEvent';
import { votingGate } from './src/votingGate';
import { xorGate } from './src/xorGate';

export const penDefines = [
  { type: 'andGate', draw: andGate, defaultAnchorFn: andGateAnchorFn },
  { type: 'basicEvent', draw: basicEvent, defaultAnchorFn: basicEventAnchorFn },
  { type: 'conditionalEvent', draw: conditionalEvent, defaultAnchorFn: conditionalEventAnchorFn },
  { type: 'event', draw: event, defaultAnchorFn },
  { type: 'forbiddenGate', draw: forbiddenGate, defaultAnchorFn: forbiddenGateAnchorFn },
  { type: 'orGate', draw: orGate, defaultAnchorFn: orGateAnchorFn },
  { type: 'priorityAndGate', draw: priorityAndGate, defaultAnchorFn: andGateAnchorFn },
  { type: 'switchEvent', draw: switchEvent, defaultAnchorFn },
  { type: 'transferSymbol', draw: transferSymbol, defaultAnchorFn: basicEventAnchorFn },
  { type: 'unexpandedEvent', draw: unexpandedEvent, defaultAnchorFn: unexpandedEventAnchorFn },
  { type: 'votingGate', draw: votingGate, defaultAnchorFn: orGateAnchorFn },
  { type: 'xorGate', draw: xorGate, defaultAnchorFn: xorGateAnchorFn },
];
