export * from './focus';
export * from './lifeline';

import { focus } from './focus';
import { lifeline } from './lifeline';

export function sequencePens(){
    return{
        focus,
        lifeline
    }
}