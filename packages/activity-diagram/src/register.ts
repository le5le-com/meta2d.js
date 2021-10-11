import { activityFinal } from './final';
// TODO: 该图形像个矩形，考虑删除
import { fork } from './fork';
import { swimlaneH } from './swimlaneH';
import { swimlaneV } from './swimlaneV';

export function activityDiagram() {
  return {
    activityFinal,
    forkV: fork,
    forkH: fork,
    swimlaneH,
    swimlaneV,
  };
}
