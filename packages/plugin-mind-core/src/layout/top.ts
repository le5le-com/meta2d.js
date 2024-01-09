import {mindBoxPlugin} from "../core/MindBoxPlugin";
import {Meta2d} from "@meta2d/core";
declare const meta2d: Meta2d;

export function top(pen: any, recursion = true,) {
  pen.mind.direction = 'top';
  let childrenGap = mindBoxPlugin.childrenGap;
  let levelGap = mindBoxPlugin.levelGap;
  let children = pen.mind.children;
  let worldReact = meta2d.getPenRect(pen); //获取该节点的世界坐标宽度信息
  let topHeight = 0;
  let topWidth = 0;
  mindBoxPlugin.calcChildWandH(pen);
  for (let i = 0; i < children.length; i++) {
    let child: any = meta2d.store.pens[children[i]];
    if (!child) continue;
    let childRect = meta2d.getPenRect(child);
    topHeight += (((meta2d.store.pens[children[i - 1]] as any)?.mind?.maxHeight) || 0) + (meta2d.store.pens[children[i - 1]] ? (+childrenGap) : 0);
    topWidth += (((meta2d.store.pens[children[i - 1]] as any)?.mind?.maxWidth) || 0) + (meta2d.store.pens[children[i - 1]] ? (+childrenGap) : 0);
    child.mind.connect = top.connectRule(pen, child);
    if (worldReact.width > pen.mind.childWidth) {
      child.mind.x = worldReact.x + 1 / 2 * pen.mind.maxWidth + topWidth - 1 / 2 * pen.mind.childWidth + ((child.mind?.maxWidth / 2 - 1 / 2 * childRect.width) || 0);
    } else {
      child.mind.x = worldReact.x - 1 / 2 * pen.mind.maxWidth + topWidth + 1 / 2 * worldReact.width + ((child.mind?.maxWidth / 2 - 1 / 2 * childRect.width) || 0);
    }
    // child.mind.x = worldReact.x - 1 / 2 * pen.mind.maxWidth + topWidth + 1/2 * worldReact.width + ((child.mind?.maxWidth / 2 - 1 / 2 * childRect.width) || 0);
    child.mind.y = worldReact.y - 1 / 2 * meta2d.getPenRect(child).height - +levelGap;
    meta2d.setValue({
      id: child.id,
      x: child.mind.x,
      y: child.mind.y,
      color: child.mind.color
    }, {render: false});
    if (recursion) top(child, true);
  }
}

top.connectRule = (pen: any, child: any) => {
  return {
    from: pen.id,
    to: child.id,
    startIndex: 0,
    fromAnchor: pen.anchors[0],
    endIndex: 2,
    toAnchor: child.anchors[2]
  };
};
