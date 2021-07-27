export * from './airvalve';
export * from './circular';
export * from './coolingtowerfan';
export * from './electricvalve';
export * from './elevatordoor';
export * from './escalator';
export * from './fan';
export * from './filter';
export * from './pool';
export * from './progress';
export * from './thermometer';
export * from './watermeter';
export * from './waterpumpbody';

import { airvalve } from './airvalve';
import { circular } from './circular';
import { coolingtowerfan } from './coolingtowerfan';
import { electricvalve } from './electricvalve';
import { elevatordoor } from './elevatordoor';
import { escalator } from './escalator';
import { fan } from './fan';
import { filter } from './filter';
import { pool } from './pool';
import { progress } from './progress';
import { thermometer ,thermometerDrawScaleByCtx} from './thermometer';
import { watermeter ,watermeterScaleByCtx} from './watermeter';
import { waterpumpbody } from './waterpumpbody';


export function iotPens(){
    return {
        airvalve,
        circular,
        coolingtowerfan,
        electricvalve,
        elevatordoor,
        escalator,
        fan,
        filter,
        pool,
        progress,
        thermometer,
        thermometerDrawScaleByCtx,
        watermeter,
        watermeterScaleByCtx,
        waterpumpbody
    }
}