import { focus } from './focus';
import { lifeline } from './lifeline';

export function sequencePens() {
  return {
    sequenceFocus: focus,
  };
}
export function sequencePensbyCtx() {
  return {
    lifeline,
  };
}
