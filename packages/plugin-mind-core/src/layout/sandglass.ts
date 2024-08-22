import {mindBoxPlugin} from "../core/MindBoxPlugin";
import {top} from "./top";
import {bottom} from "./bottom";
import {Meta2d} from "@meta2d/core";
declare const meta2d: Meta2d;

export function sandglass(pen: any, recursion = true) {
  pen.mind.direction = 'sandglass';
  let childrenGap = mindBoxPlugin.childrenGap;
  let levelGap = mindBoxPlugin.levelGap;
  let children = JSON.parse(JSON.stringify(pen.mind.children || []));
  let worldReact = meta2d.getPenRect(pen); //获取该节点的世界坐标宽度信息
  let topHeight = 0;
  let topWidth = 0;
  let bottomChildren = pen.mind.children.splice(0, sandglass.MAXLENGTH);
  let leftChildren = pen.mind.children;
  pen.mind.children = bottomChildren;
  mindBoxPlugin.calcChildWandH(pen);
  // let childrenLen = children.length;
  // let cutValue = childrenLen / 2
  for (let i = 0; i < children.length; i++) {
    let child: any = meta2d.store.pens[children[i]];
    if (!child) continue;
    let childRect = meta2d.getPenRect(child);
    if (i < sandglass.MAXLENGTH) {

      child.mind.connect = sandglass.connectRule(pen, child, i);
      topHeight += (((meta2d.store.pens[children[i - 1]] as any)?.mind?.maxHeight) || 0) + (meta2d.store.pens[children[i - 1]] ? (+childrenGap) : 0);
      topWidth += (((meta2d.store.pens[children[i - 1]] as any)?.mind?.maxWidth) || 0) + (meta2d.store.pens[children[i - 1]] ? (+childrenGap) : 0);
      child.mind.x = worldReact.x - 1 / 2 * pen.mind.maxWidth + topWidth + 1 / 2 * worldReact.width + ((child.mind?.maxWidth / 2 - 1 / 2 * childRect.width) || 0);
      child.mind.y = worldReact.y - 1 / 2 * meta2d.getPenRect(child).height + +levelGap;
      meta2d.setValue({
        id: child.id,
        x: child.mind.x,
        y: child.mind.y,
        color: child.mind.color
      }, {render: false});

      if (recursion) bottom(child, recursion);
      if (i === sandglass.MAXLENGTH - 1) {
        topHeight = 0;
        topWidth = 0;
        pen.mind.children = leftChildren;
        mindBoxPlugin.calcChildWandH(pen);
      }
    } else {
      topHeight += (((meta2d.store.pens[children[i - 1]] as any)?.mind?.maxHeight) || 0) + (meta2d.store.pens[children[i - 1]] ? (+childrenGap) : 0);
      topWidth += (((meta2d.store.pens[children[i - 1]] as any)?.mind?.maxWidth) || 0) + (meta2d.store.pens[children[i - 1]] ? (+childrenGap) : 0);
      if (i === sandglass.MAXLENGTH) {
        topHeight = 0;
        topWidth = 0;
      }
      child.mind.connect = sandglass.connectRule(pen, child, i);
      child.mind.x = worldReact.x - 1 / 2 * pen.mind.maxWidth + topWidth + 1 / 2 * worldReact.width + ((child.mind?.maxWidth / 2 - 1 / 2 * childRect.width) || 0);
      child.mind.y = worldReact.y - 1 / 2 * meta2d.getPenRect(child).height - +levelGap;

      if (child.mind.visible) {
        meta2d.setValue({
          id: child.id,
          x: child.mind.x,
          y: child.mind.y,
          color: child.mind.color
        }, {render: false});
        // meta2d.setVisible(child,true,false);
      } else {
        meta2d.setVisible(child, false, false);
      }
      if (recursion) top(child, recursion);
    }
    pen.mind.children = children;

  }
}

sandglass.connectRule = (pen: any, child: any, index: number) => {
  return index < sandglass.MAXLENGTH ? bottom.connectRule(pen, child) : top.connectRule(pen, child);
};
sandglass.MAXLENGTH = 8;
