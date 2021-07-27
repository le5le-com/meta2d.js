export * from './interfaceClass';
export * from './simpleClass';

import { interfaceClass } from './interfaceClass';
import { simpleClass } from './simpleClass';

export function classPens(){
    return {
        interfaceClass,
        simpleClass
    }
}