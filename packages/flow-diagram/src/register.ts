import { flowComment } from './comment';
import { flowData } from './data';
import { flowDb } from './db';
import { flowDisplay } from './display';
import { flowDocument } from './document';
import { flowExternStorage } from './externStorage';
import { flowInternalStorage } from './internalStorage';
import { flowManually } from './manually';
import { flowParallel } from './parallel';
import { flowQueue } from './queue';
import { flowSubprocess } from './subprocess';

export function flowPens() {
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
