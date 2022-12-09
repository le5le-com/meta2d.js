import { Meta2dStore } from '../store';

export function lockedError(store: Meta2dStore) {
  if (store.data.locked) {
    throw new Error('canvas is locked');
  }
}
