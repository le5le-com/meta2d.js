export * from './comment';
export * from './data';
export * from './display';
export * from './document';
export * from './externStorage';
export * from './internalStorage';
export * from './manually';
export * from './parallel';
export * from './queue';
export * from './subprocess';

import { comment } from './comment';
import { data } from './data';
import { db } from './db';
import { display } from './display';
import { document } from './document';
import { flowExternStorage } from './externStorage';
import { flowInternalStorage } from './internalStorage';
import { flowManually } from './manually';
import { flowParallel } from './parallel';
import { flowQueue } from './queue';
import { flowSubprocess } from './subprocess';


export function flowPens(){
    return {
        comment,
        data,
        db,
        display,
        document,
        flowExternStorage,
        flowInternalStorage,
        flowManually,
        flowParallel,
        flowQueue,
        flowSubprocess
    }
}