import {mindBoxPlugin} from "../core/MindBoxPlugin";

export function left(pen: any, recursion = true,) {
  pen.mind.direction = 'left';
  let childrenGap = mindBoxPlugin.childrenGap;
  let levelGap = mindBoxPlugin.levelGap;
  let children = pen.mind.children || [];
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
    child.mind.connect = left.connectRule(pen, child);
    child.mind.x = worldReact.x - childRect.width - +levelGap;

    if (worldReact.height > pen.mind.childHeight) {
      child.mind.y = worldReact.y + 1 / 2 * pen.mind.maxHeight + topHeight - 1 / 2 * pen.mind.childHeight + ((child.mind?.maxHeight / 2 - 1 / 2 * childRect.height) || 0);
    } else {
      child.mind.y = worldReact.y - 1 / 2 * pen.mind.maxHeight + topHeight + 1 / 2 * worldReact.height + ((child.mind?.maxHeight / 2 - 1 / 2 * childRect.height) || 0);
    }
    meta2d.setValue({
      id: child.id,
      x: child.mind.x,
      y: child.mind.y,
      color: child.mind.color
    }, {render: false});

    if (recursion) left(child, true);
  }
}

left.connectRule = (pen: any, child: any) => {
  return {
    from: pen.id,
    to: child.id,
    startIndex: 3,
    fromAnchor: pen.anchors[3],
    endIndex: 1,
    toAnchor: child.anchors[1]
  };
};
