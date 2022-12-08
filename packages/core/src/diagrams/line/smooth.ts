import { Point, PrevNextType } from '../../point';

export function simplify(points: Point[], length: number, start: number, end: number) {
  const newPoints: Point[] = [];
  let maxDist, index, xx, yy, dx, dy, ddx, ddy, p1, p2, p, t, dist, dist1;
  p1 = points[start];
  p2 = points[end];
  xx = p1.x;
  yy = p1.y;
  ddx = p2.x - xx;
  ddy = p2.y - yy;
  dist1 = ddx * ddx + ddy * ddy;
  maxDist = length;
  for (let i = start + 1; i < end; i++) {
    p = points[i];
    if (ddx !== 0 || ddy !== 0) {
      t = ((p.x - xx) * ddx + (p.y - yy) * ddy) / dist1;
      if (t > 1) {
        dx = p.x - p2.x;
        dy = p.y - p2.y;
      } else if (t > 0) {
        dx = p.x - (xx + ddx * t);
        dy = p.y - (yy + ddy * t);
      } else {
        dx = p.x - xx;
        dy = p.y - yy;
      }
    } else {
      dx = p.x - xx;
      dy = p.y - yy;
    }
    dist = dx * dx + dy * dy;
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }

  if (maxDist > length) {
    // continue simplification while maxDist > length
    if (index - start > 1) {
      newPoints.push(...simplify(points, length, start, index));
    }
    newPoints.push({
      id: points[index].id,
      penId: points[index].penId,
      x: points[index].x,
      y: points[index].y,
    });
    if (end - index > 1) {
      newPoints.push(...simplify(points, length, index, end));
    }
  }

  return newPoints;
}

export function smoothLine(points: Point[], cornerThres = 0.8, match = false) {
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
          pt.prevNextType = PrevNextType.Bilateral;
          pt.prev = {
            penId: pt.penId,
            x: p2.x - x * dist1 * 0.25,
            y: p2.y - y * dist1 * 0.25,
          };
          pt.next = {
            penId: pt.penId,
            x: p2.x + x * dist2 * 0.25,
            y: p2.y + y * dist2 * 0.25,
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
