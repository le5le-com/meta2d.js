export * from './rectangle';
export * from './circle';
export * from './svgPath';
export * from './diamond';
export * from './triangle';
export * from './pentagon';
export * from './pentagram';
export * from './hexagon';
export * from './arrow';
export * from './message';
export * from './cloud';
export * from './file';
export * from './cube';
export * from './people';
export * from './line';
export * from './iframe';
export * from './video';

import { rectangle } from './rectangle';
import { circle } from './circle';
import { svgPath } from './svgPath';
import { diamond } from './diamond';
import { triangle } from './triangle';
import { pentagon } from './pentagon';
import { pentagram } from './pentagram';
import { hexagon } from './hexagon';
import { leftArrow, rightArrow, twowayArrow } from './arrow';
import { message } from './message';
import { cloud } from './cloud';
import { file } from './file';
import { cube } from './cube';
import { people } from './people';
import { line } from './line';
import { iframe } from './iframe';
import { video } from './video';

export function commonPens() {
  return {
    rectangle,
    circle,
    svgPath,
    diamond,
    triangle,
    pentagon,
    pentagram,
    hexagon,
    leftArrow,
    rightArrow,
    twowayArrow,
    message,
    cloud,
    file,
    cube,
    people,
    line,
    iframe,
    video,
  };
}
