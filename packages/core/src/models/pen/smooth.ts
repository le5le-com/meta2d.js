import { HandleType, Point } from '../point';

// 使用RDP算法，简化路径点数
export function simplify(points: Point[], tolerance = 3, start = 0, end = points.length - 1) {
  if (end <= start + 1) {
    // 区间内没有中间点，直接返回起点和终点
    return [points[start], points[end]];
  }

  const startPt = points[start];
  const endPt = points[end];
  const dx = endPt.x - startPt.x;
  const dy = endPt.y - startPt.y;
  const distSq = dx * dx + dy * dy;

  const toleranceSq = tolerance * tolerance;

  let maxDistSq = 0;
  let index = -1;

  // 找出距离线段最远的点
  for (let i = start + 1; i < end; i++) {
    const p = points[i];
    let distSqToLine;

    if (distSq > 0) {
      // 计算点到线段的投影参数t
      const t = ((p.x - startPt.x) * dx + (p.y - startPt.y) * dy) / distSq;
      let closestX, closestY;

      if (t < 0) {
        closestX = startPt.x;
        closestY = startPt.y;
      } else if (t > 1) {
        closestX = endPt.x;
        closestY = endPt.y;
      } else {
        closestX = startPt.x + t * dx;
        closestY = startPt.y + t * dy;
      }

      const diffX = p.x - closestX;
      const diffY = p.y - closestY;
      distSqToLine = diffX * diffX + diffY * diffY;
    } else {
      // 起点和终点重合，距离就是点到起点的距离
      const diffX = p.x - startPt.x;
      const diffY = p.y - startPt.y;
      distSqToLine = diffX * diffX + diffY * diffY;
    }

    if (distSqToLine > maxDistSq) {
      maxDistSq = distSqToLine;
      index = i;
    }
  }

  // 如果最大距离超过阈值，递归细化
  if (maxDistSq > toleranceSq && index !== -1) {
    // 分别递归简化起点到最远点，最远点到终点
    const leftSimplified = simplify(points, tolerance, start, index);
    const rightSimplified = simplify(points, tolerance, index, end);

    // 合并结果，避免重复添加index点
    return [...leftSimplified.slice(0, -1), ...rightSimplified];
  } else {
    // 不需要细化，直接返回起点和终点
    return [startPt, endPt];
  }
}

export function smoothLine(points: Point[], cornerThres = 0.5, match = false) {
  if (points.length < 3) {
    return points;
  }

  // adds bezier control points at points if lines have angle less than thres
  let p1, p2, p3, dist1, dist2, x, y, endP, len, angle, newPoints, aLen, nx1, nx2, ny1, ny2;
  const dot = (x, y, xx, yy) => {
    dist1 = Math.sqrt(x * x + y * y);
    if (dist1 > 0) {
      // normalise
      nx1 = x / dist1;
      ny1 = y / dist1;
    } else {
      nx1 = 1; // need to have something so this will do as good as anything
      ny1 = 0;
    }
    dist2 = Math.sqrt(xx * xx + yy * yy);
    if (dist2 > 0) {
      nx2 = xx / dist2;
      ny2 = yy / dist2;
    } else {
      nx2 = 1;
      ny2 = 0;
    }
    return Math.acos(nx1 * nx2 + ny1 * ny2);
  };
  newPoints = [];
  aLen = points.length;
  p1 = points[0];
  endP = points[aLen - 1];
  newPoints.push({ ...points[0] });
  for (let i = 0; i < aLen - 1; i++) {
    p2 = points[i];
    p3 = points[i + 1];
    angle = Math.abs(dot(p2.x - p1.x, p2.y - p1.y, p3.x - p2.x, p3.y - p2.y));
    if (dist1) {
      // dist1 and dist2 come from dot function
      if (angle < cornerThres * 3.14) {
        // bend it if angle between lines is small
        if (match) {
          dist1 = Math.min(dist1, dist2);
          dist2 = dist1;
        }
        // use the two normalized vectors along the lines to create the tangent vector
        x = (nx1 + nx2) / 2;
        y = (ny1 + ny2) / 2;
        len = Math.sqrt(x * x + y * y); // normalise the tangent
        if (len === 0) {
          newPoints.push({ ...p2 });
        } else {
          x /= len;
          y /= len;
          const pt: Point = { ...p2 };
          pt.handleType = HandleType.Smooth;
          pt.cp1 = {
            x: p2.x + x * dist2 * 0.25,
            y: p2.y + y * dist2 * 0.25,
          };
          pt.cp2 = {
            x: p2.x - x * dist1 * 0.25,
            y: p2.y - y * dist1 * 0.25,
          };

          newPoints.push(pt);
        }
      } else {
        newPoints.push({ ...p2 });
      }
    }
    p1 = p2;
  }
  newPoints.push({ ...points[points.length - 1] });
  return newPoints;
}
