import {collapseChildPlugin} from "./core/CollapseChildPlugin";
import {Meta2d} from "@meta2d/core";
import {isIntersection} from "@meta2d/plugin-mind-core";
declare const meta2d: Meta2d;
export function error(message) {
  console.error(`plugin-mind-collapse: ${message}`);
}

export function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      func.apply(context, args);
    }, wait);
  };
}

export function isCollapsePen(pen) {
  let root = meta2d.findOne(pen.mind?.rootId);
  return pen.mind?.type === 'node' && (collapseChildPlugin.target.includes(root.id) || collapseChildPlugin.target.includes(root.name) || isIntersection(collapseChildPlugin.target, root.tags));
}
