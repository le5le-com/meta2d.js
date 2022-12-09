import { Pen } from '@meta2d/core';
import { flowComment, flowCommentAnchors } from './comment';
import { flowData } from './data';
import { flowDb } from './db';
import { flowDisplay } from './display';
import { flowDocument, flowDocumentAnchors } from './document';
import { flowExternStorage } from './externStorage';
import { flowInternalStorage } from './internalStorage';
import { flowManually, flowManuallyAnchors } from './manually';
import { flowParallel, flowParallelAnchors } from './parallel';
import { flowQueue } from './queue';
import { flowSubprocess } from './subprocess';

export function flowPens(): Record<
  string,
  (pen: Pen, ctx?: CanvasRenderingContext2D) => Path2D
> {
  return {
    flowComment,
    flowData,
    flowDb,
    flowDisplay,
    flowDocument,
    flowExternStorage,
    flowInternalStorage,
    flowManually,
    flowParallel,
    flowQueue,
    flowSubprocess,
  };
}

export function flowAnchors() {
  return {
    flowDocument: flowDocumentAnchors,
    flowManually: flowManuallyAnchors,
    flowParallel: flowParallelAnchors,
    flowComment: flowCommentAnchors,
  };
}
