import {generateColor} from "../config/default";
import {Meta2d} from "@meta2d/core";
declare const meta2d:Meta2d;
function defaultColorRule(pen: any, recursion = true) {
  let children = pen.mind.children || [];
  let generateColorFunc = generateColor();
  for (let i = 0; i < children.length; i++) {
    let child: any = meta2d.store.pens[children[i]];
    if (!child) continue;
    let nodeColor = undefined;
    if (pen.mind.level === 0) {
      let nextColor = generateColorFunc.next().value;
      nodeColor = child.mind.color || nextColor;
    } else {
      nodeColor = child.mind.color || pen.mind.color || pen.color;
    }
    meta2d.setValue({
      id: child.id,
      color: nodeColor
    }, {render: false});

    if (recursion) defaultColorRule(child, true);
  }
}

export default defaultColorRule;
