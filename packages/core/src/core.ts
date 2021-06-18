import pkg from '../package.json';
import { options } from './options';
import { useStore } from './store';
import { s8 } from './utils';

export class Topology {
  version: string = pkg.version;
  id = s8();
  store: any = useStore(this.id);
  options = options;
  parentElem: HTMLElement;
}
