import { TopologyStore } from '../store';

export function lockedError(store: TopologyStore) {
  if (store.data.locked) {
    throw new Error('canvas is locked');
  }
}
