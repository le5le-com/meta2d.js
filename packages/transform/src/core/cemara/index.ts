import { Point } from "../../types";
import { Vector3D } from "../math";

/**
 * @description
 * Canvas 伪 3D 视角切换（相机绕物体旋转）
 * - 所有点初始在 z = 0 平面
 * - center 是“观察中心 / 旋转中心”
 * - angleX/Y/Z 表示【相机】的旋转角度（单位：度）
 * - dist 是相机到投影平面的距离
 */
export function cameraTransform(
  points: Point[],
  center: Point,
  angleX: number,
  angleY: number,
  angleZ: number,
  dist: number
) {
  const radX = (angleX * Math.PI) / 180;
  const radY = (angleY * Math.PI) / 180;
  const radZ = (angleZ * Math.PI) / 180;

  const cameraZ = -dist;

  return points.map(point => {
    const x = point.x - center.x;
    const y = point.y - center.y;

    let v = new Vector3D(x, y, 0);

    v = v
      .rotateZ(-radZ)
      .rotateY(-radY)
      .rotateX(-radX);

    const z = v.z - cameraZ;

    if (z <= 0.0001) {
      return {
        ...point,
        x: point.x,
        y: point.y,
        scale: 0,
        visible: false,
      };
    }

    const scale = dist / z;
    const projectedX = v.x * scale;
    const projectedY = v.y * scale;

    return {
      ...point,
      x: projectedX + center.x,
      y: projectedY + center.y,
      scale,
      visible: true,
    };
  });
}
