import {Point} from "./types";
import {Vector3D} from "./math";

/**
 * @description 透视变换
 * 令z轴为0
 * */
export function perspectiveTransform(
  points: Point[],
  center: Point,
  angleX: number,
  angleY: number,
  angleZ: number,
  dist: number
) {

  return points.map(point => {
    let x = point.x - center.x;
    let y = point.y - center.y;

    const radX = (angleX * Math.PI) / 180;
    const radY = (angleY * Math.PI) / 180;
    const radZ = (angleZ * Math.PI) / 180;
    let vec = new Vector3D(x, y, 0)

    vec = vec.rotateX(radX).rotateY(radY).rotateZ(radZ)

    const scale = dist / (dist + vec.z);
    const projectedX = vec.x * scale;
    const projectedY = vec.y * scale;
    const near = dist * 0.1; // 或一个固定值

    const depth = dist + vec.z;
    if (depth < near) {
      return {
        ...point,
        visible: false,
        scale: 0
      };
    }

    return {
      ...point,
      x: projectedX + center.x,
      y: projectedY + center.y,
      scale: scale,
    };
  });
}
