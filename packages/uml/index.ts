import {
  defaultAnchorFn,
  flowCommentAnchorFn,
  flowDataAnchorFn,
  flowDocumentAnchorFn,
  flowManuallyAnchorFn,
  flowParallelAnchorFn,
} from './src/anchors';
import { flowComment } from './src/comment';
import { flowData } from './src/data';
import { flowDb } from './src/db';
import { flowDisplay } from './src/display';
import { flowDocument } from './src/document';
import { flowExternStorage } from './src/externStorage';
import { final } from './src/final';
import { focus } from './src/focus';
import { fork } from './src/fork';
import { flowInternalStorage } from './src/internalStorage';
import { interfaceClass } from './src/interfaceClass';
import { lifeline } from './src/lifeline';
import { flowManually } from './src/manually';
import { flowParallel } from './src/parallel';
import { flowQueue } from './src/queue';
import { simpleClass } from './src/simpleClass';
import { flowSubprocess } from './src/subprocess';
import { swimlaneH } from './src/swimlaneH';
import { swimlaneV } from './src/swimlaneV';

export const penDefines = [
  { type: 'flowComment', draw: flowComment, defaultAnchorFn: flowCommentAnchorFn },
  { type: 'flowData', draw: flowData, defaultAnchorFn: flowDataAnchorFn },
  { type: 'flowDisplay', draw: flowDisplay, defaultAnchorFn },
  { type: 'flowDb', draw: flowDb, defaultAnchorFn },
  { type: 'flowDocument', draw: flowDocument, defaultAnchorFn: flowDocumentAnchorFn },
  { type: 'flowExternStorage', draw: flowExternStorage, defaultAnchorFn },
  { type: 'flowInternalStorage', draw: flowInternalStorage, defaultAnchorFn },
  { type: 'flowManually', draw: flowManually, defaultAnchorFn: flowManuallyAnchorFn },
  { type: 'flowParallel', draw: flowParallel, defaultAnchorFn: flowParallelAnchorFn },
  { type: 'flowQueue', draw: flowQueue, defaultAnchorFn },
  { type: 'flowSubprocess', draw: flowSubprocess, defaultAnchorFn },
  { type: 'swimlaneH', draw: swimlaneH, defaultAnchorFn },
  { type: 'swimlaneV', draw: swimlaneV, defaultAnchorFn },
  { type: 'activityFinal', draw: final, defaultAnchorFn },
  { type: 'forkV', draw: fork, defaultAnchorFn },
  { type: 'forkH', draw: fork, defaultAnchorFn },
  { type: 'lifeline', draw: lifeline, defaultAnchorFn },
  { type: 'sequenceFocus', draw: focus, defaultAnchorFn },
  { type: 'interfaceClass', draw: interfaceClass, defaultAnchorFn },
  { type: 'simpleClass', draw: simpleClass, defaultAnchorFn },
];
