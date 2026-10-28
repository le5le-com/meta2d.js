import { s8 } from '../../utils';
import { Direction } from './const';
import { Point } from './point';

export function scalePoint(pt: Point, scale: number, center: Point) {
  pt.x = center.x - (center.x - pt.x) * scale;
  pt.y = center.y - (center.y - pt.y) * scale;
}

export function rotatePoint(pt: Point, angle: number, pivot: Point) {
  if (!angle) {
    return;
  }
  const a = (angle * Math.PI) / 180;
  const dx = pt.x - pivot.x;
  const dy = pt.y - pivot.y;
  const x = dx * Math.cos(a) - dy * Math.sin(a) + pivot.x;
  const y = dx * Math.sin(a) + dy * Math.cos(a) + pivot.y;

  pt.x = x;
  pt.y = y;

  pt.cp1 && rotatePoint(pt.cp1, angle, pivot);
  pt.cp2 && rotatePoint(pt.cp2, angle, pivot);
}

export function pointInVertices(point: Point, vertices: Point[]): boolean {
  if (vertices.length < 3) {
    return false;
  }
  let isIn = false;
  let last = vertices[vertices.length - 1];
  for (const item of vertices) {
    if (last.y > point.y !== item.y > point.y) {
      if (item.x + ((point.y - item.y) * (last.x - item.x)) / (last.y - item.y) > point.x) {
        isIn = !isIn;
      }
    }

    last = item;
  }

  return isIn;
}

export function calcRotate(pt: Point, pivot: Point) {
  if (pt.x === pivot.x) {
    return pt.y <= pivot.y ? 0 : 180;
  }

  if (pt.y === pivot.y) {
    return pt.x < pivot.x ? 270 : 90;
  }

  const x = pt.x - pivot.x;
  const y = pt.y - pivot.y;
  let angle = (Math.atan(Math.abs(x / y)) / (2 * Math.PI)) * 360;
  if (x > 0 && y > 0) {
    angle = 180 - angle;
  } else if (x < 0 && y > 0) {
    angle += 180;
  } else if (x < 0 && y < 0) {
    angle = 360 - angle;
  }

  return angle | 0;
}

// 以pivot为基准点，计算在直线上src的镜像点
export function getMirrorPoint(src: Point, pivot: Point, length = 50) {
  const dx = src.x - pivot.x;
  const dy = src.y - pivot.y;

  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) {
    return src;
  }

  return {
    x: pivot.x - (dx / dist) * length,
    y: pivot.y - (dy / dist) * length,
  };
}

// 根据pt1到pt2的连线角度，计算方向（上右下左0123）
export function getDirection(pt1: Point, pt2: Point) {
  const dx = pt2.x - pt1.x;
  const dy = pt2.y - pt1.y;

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const deg = (angle + 360) % 360;

  if (deg >= 315 || deg < 45) {
    return 1; // 右
  }

  if (deg >= 45 && deg < 135) {
    return 2; // 下
  }

  if (deg >= 135 && deg < 225) {
    return 3; // 左
  }

  return 0;
}

// 根据连线终点和临时点，计算正交线的新的终点
export function getOrthogonalPoint(pt: Point, temp: Point) {
  const pts = [];

  if (pt.x === temp.x && pt.direction === Direction.Up && temp.direction === Direction.Bottom && pt.y > temp.y) {
    return [temp];
  }
  if (pt.x === temp.x && pt.direction === Direction.Bottom && temp.direction === Direction.Up && pt.y < temp.y) {
    return [temp];
  }
  if (pt.y === temp.y && pt.direction === Direction.Right && temp.direction === Direction.Left && pt.x < temp.x) {
    return [temp];
  }
  if (pt.y === temp.y && pt.direction === Direction.Left && temp.direction === Direction.Right && pt.x > temp.x) {
    return [temp];
  }

  let cp1: Point;
  let cp2: Point;

  let left: number;
  let right: number;
  let top: number;
  let bottom: number;

  if (pt.direction == undefined) {
    cp1 = pt;
  } else {
    let direction: number;
    if (pt.host) {
      direction = pt.direction;
      left = pt.x - pt.host.x;
      right = pt.host.ex - pt.x;
      top = pt.y - pt.host.y;
      bottom = pt.host.ey - pt.y;
    } else if (pt.direction % 2) {
      direction = temp.y < pt.y ? 0 : 2;
    } else {
      direction = temp.x > pt.x ? 1 : 3;
    }

    if (direction === 0) {
      cp1 = { id: s8(), x: pt.x, y: pt.y - 20, direction, temp: temp.temp };
    } else if (direction === 1) {
      cp1 = { id: s8(), x: pt.x + 20, y: pt.y, direction, temp: temp.temp };
    } else if (direction === 2) {
      cp1 = { id: s8(), x: pt.x, y: pt.y + 20, direction, temp: temp.temp };
    } else if (direction === 3) {
      cp1 = { id: s8(), x: pt.x - 20, y: pt.y, direction, temp: temp.temp };
    } else {
      cp1 = pt;
    }
  }

  if (temp.direction === Direction.Up) {
    cp2 = { id: s8(), x: temp.x, y: temp.y - 20, direction: 0, temp: temp.temp };
  } else if (temp.direction === Direction.Right) {
    cp2 = { id: s8(), x: temp.x + 20, y: temp.y, direction: 1, temp: temp.temp };
  } else if (temp.direction === Direction.Bottom) {
    cp2 = { id: s8(), x: temp.x, y: temp.y + 20, direction: 2, temp: temp.temp };
  } else if (temp.direction === Direction.Left) {
    cp2 = { id: s8(), x: temp.x - 20, y: temp.y, direction: 3, temp: temp.temp };
  } else {
    cp2 = temp;
  }

  if (cp1.x === cp2.x) {
    // 起点
    if (cp1.direction == undefined) {
      if (cp2.direction != undefined && cp2.direction % 2 === 0) {
        if (
          (cp2.direction === Direction.Up && cp1.y < cp2.y) ||
          (cp2.direction === Direction.Bottom && cp1.y > cp2.y)
        ) {
          cp2.y = cp1.y;
        } else {
          pts.push(
            { id: s8(), x: cp1.x + 20, y: cp1.y, temp: temp.temp },
            { id: s8(), x: cp1.x + 20, y: cp2.y, temp: temp.temp }
          );
        }
      }
    } else if (cp2.direction == undefined) {
      if (cp1.direction % 2 === 0) {
        if (
          (cp1.direction === Direction.Up && cp2.y < cp1.y) ||
          (cp1.direction === Direction.Bottom && cp2.y > cp1.y)
        ) {
          cp1.y = cp2.y;
        } else {
          pts.push(
            { id: s8(), x: cp1.x + 20, y: cp1.y, temp: temp.temp },
            { id: s8(), x: cp1.x + 20, y: cp2.y, temp: temp.temp }
          );
        }
      }
    } else {
      if (cp1.direction === Direction.Up) {
        if (cp2.direction === Direction.Up) {
          pts.push(
            { id: s8(), x: cp1.x + 20, y: cp1.y, temp: temp.temp },
            { id: s8(), x: cp1.x + 20, y: cp2.y, temp: temp.temp }
          );
        } else {
          if (cp1.y >= cp2.y) {
            cp1.y = cp2.y;
          } else {
            pts.push(
              { id: s8(), x: cp1.x + 20, y: cp1.y, temp: temp.temp },
              { id: s8(), x: cp1.x + 20, y: cp2.y, temp: temp.temp }
            );
          }
        }
      } else if (cp1.direction === Direction.Right) {
        if (cp2.direction === Direction.Up) {
          if (cp1.y < cp2.y) {
            cp2.y = cp1.y;
          } else {
            cp1.x += 20;
            pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Bottom) {
          if (cp1.y >= cp2.y) {
            cp2.y = cp1.y;
          } else {
            cp1.x += 20;
            pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
          }
        }
      } else if (cp1.direction === Direction.Bottom) {
        if (cp2.direction === Direction.Bottom) {
          pts.push(
            { id: s8(), x: cp1.x + 20, y: cp1.y, temp: temp.temp },
            { id: s8(), x: cp1.x + 20, y: cp2.y, temp: temp.temp }
          );
        } else {
          if (cp1.y <= cp2.y) {
            cp1.y = cp2.y;
          } else {
            pts.push(
              { id: s8(), x: cp1.x + 20, y: cp1.y, temp: temp.temp },
              { id: s8(), x: cp1.x + 20, y: cp2.y, temp: temp.temp }
            );
          }
        }
      } else {
        if (cp2.direction === Direction.Up) {
          if (cp1.y < cp2.y) {
            cp2.y = cp1.y;
          } else {
            cp1.x -= 20;
            pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Bottom) {
          if (cp1.y >= cp2.y) {
            cp2.y = cp1.y;
          } else {
            cp1.x -= 20;
            pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
          }
        }
      }
    }
  } else if (cp1.y === cp2.y) {
    // 起点
    if (cp1.direction == undefined) {
      if (cp2.direction != undefined && cp2.direction % 2) {
        if (
          (cp2.direction === Direction.Right && cp1.x > cp2.x) ||
          (cp2.direction === Direction.Left && cp1.x < cp2.x)
        ) {
          cp2.x = cp1.x;
        } else {
          pts.push(
            { id: s8(), x: cp1.x, y: cp1.y - 20, temp: temp.temp },
            { id: s8(), x: cp2.x, y: cp1.y - 20, temp: temp.temp }
          );
        }
      }
    } else if (cp2.direction == undefined) {
      if (cp1.direction % 2) {
        if (
          (cp1.direction === Direction.Right && cp2.x > cp1.x) ||
          (cp1.direction === Direction.Left && cp2.x < cp1.x)
        ) {
          cp1.x = cp2.x;
        } else {
          pts.push(
            { id: s8(), x: cp1.x, y: cp1.y - 20, temp: temp.temp },
            { id: s8(), x: cp2.x, y: cp1.y - 20, temp: temp.temp }
          );
        }
      }
    } else {
      if (cp1.direction === Direction.Up) {
        if (cp2.direction === Direction.Right) {
          if (cp1.x > cp2.x) {
            cp2.x = cp1.x;
          } else {
            cp1.y -= 20;
            pts.push({ id: s8(), x: cp1.x, y: cp2.y - 20, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Left) {
          if (cp1.x < cp2.x) {
            cp2.x = cp1.x;
          } else {
            cp1.y -= 20;
            pts.push({ id: s8(), x: cp1.x, y: cp2.y - 20, temp: temp.temp });
          }
        }
      } else if (cp1.direction === Direction.Right) {
        if (cp1.x < cp2.x) {
          if (cp2.direction === Direction.Right) {
            pts.push(
              { id: s8(), x: cp1.x, y: cp1.y - 20, temp: temp.temp },
              { id: s8(), x: cp2.x, y: cp2.y - 20, temp: temp.temp }
            );
          } else {
            cp1.x = cp2.x;
          }
        } else {
          if (cp2.direction === Direction.Bottom) {
            pts.push(
              { id: s8(), x: cp1.x, y: cp1.y + 20, temp: temp.temp },
              { id: s8(), x: cp2.x, y: cp1.y + 20, temp: temp.temp }
            );
          } else {
            pts.push(
              { id: s8(), x: cp1.x, y: cp1.y - 20, temp: temp.temp },
              { id: s8(), x: cp2.x, y: cp2.y - 20, temp: temp.temp }
            );
          }
        }
      } else if (cp1.direction === Direction.Bottom) {
        if (cp2.direction === Direction.Right) {
          if (cp1.x > cp2.x) {
            cp2.x = cp1.x;
          } else {
            cp1.y += 20;
            pts.push({ id: s8(), x: cp1.x, y: cp2.y + 20, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Left) {
          if (cp1.x < cp2.x) {
            cp2.x = cp1.x;
          } else {
            cp1.y += 20;
            pts.push({ id: s8(), x: cp1.x, y: cp2.y + 20, temp: temp.temp });
          }
        }
      } else {
        if (cp1.x > cp2.x) {
          if (cp2.direction === Direction.Left) {
            pts.push(
              { id: s8(), x: cp1.x, y: cp1.y - 20, temp: temp.temp },
              { id: s8(), x: cp2.x, y: cp2.y - 20, temp: temp.temp }
            );
          } else {
            cp1.x = cp2.x;
          }
        } else {
          if (cp2.direction === Direction.Bottom) {
            pts.push(
              { id: s8(), x: cp1.x, y: cp1.y + 20, temp: temp.temp },
              { id: s8(), x: cp2.x, y: cp1.y + 20, temp: temp.temp }
            );
          } else {
            pts.push(
              { id: s8(), x: cp1.x, y: cp1.y - 20, temp: temp.temp },
              { id: s8(), x: cp2.x, y: cp2.y - 20, temp: temp.temp }
            );
          }
        }
      }
    }
  } else {
    // 起点
    if (cp1.direction == undefined) {
      if (cp2.direction == undefined) {
        if (Math.abs(cp1.y - cp2.y) < 10) {
          pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
        } else {
          pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
        }
      } else {
        if (
          (cp2.direction === Direction.Up && cp1.y < cp2.y) ||
          (cp2.direction === Direction.Bottom && cp1.y > cp2.y)
        ) {
          cp2.y = cp1.y;
        } else if (
          (cp2.direction === Direction.Right && cp1.x > cp2.x) ||
          (cp2.direction === Direction.Left && cp1.x < cp2.x)
        ) {
          cp2.x = cp1.x;
        } else if (cp2.direction % 2 === 0) {
          pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
        } else {
          pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
        }
      }
    } else if (cp2.direction == undefined) {
      if (cp1.direction === Direction.Up) {
        // 点在上面（
        if (cp2.y < cp1.y) {
          cp1.y = cp2.y;
        } else if (cp2.y <= cp1.y + bottom + 20 && cp2.y > cp1.y) {
          pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
        } else if (cp2.x < cp1.x && cp2.x > cp1.x - left) {
          pts.push(
            { id: s8(), x: cp1.x - left - 20, y: cp1.y, temp: temp.temp },
            { id: s8(), x: cp1.x - left - 20, y: cp2.y, temp: temp.temp }
          );
        } else if (cp2.x > cp1.x && cp2.x < cp1.x + right) {
          pts.push(
            { id: s8(), x: cp1.x + right + 20, y: cp1.y, temp: temp.temp },
            { id: s8(), x: cp1.x + right + 20, y: cp2.y, temp: temp.temp }
          );
        } else {
          pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
        }
      } else if (cp1.direction === Direction.Right) {
        if (cp2.x > cp1.x) {
          cp1.x = cp2.x;
        } else if (cp2.x >= cp1.x - left - 20 && cp2.x < cp1.x) {
          pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
        } else if (cp2.y < cp1.y && cp2.y > cp1.y - top) {
          pts.push(
            { id: s8(), x: cp1.x, y: cp1.y - top - 20, temp: temp.temp },
            { id: s8(), x: cp2.x, y: cp1.y - top - 20, temp: temp.temp }
          );
        } else if (cp2.y > cp1.y && cp2.y < cp1.y + bottom) {
          pts.push(
            { id: s8(), x: cp1.x, y: cp1.y + bottom + 20, temp: temp.temp },
            { id: s8(), x: cp2.x, y: cp1.y + bottom + 20, temp: temp.temp }
          );
        } else {
          pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
        }
      } else if (cp1.direction === Direction.Bottom) {
        // 点在下面
        if (cp2.y > cp1.y) {
          cp1.y = cp2.y;
        } else if (cp2.y >= cp1.y - top - 20 && cp2.y < cp1.y) {
          pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
        } else if (cp2.x < cp1.x && cp2.x > cp1.x - left) {
          pts.push(
            { id: s8(), x: cp1.x - left - 20, y: cp1.y, temp: temp.temp },
            { id: s8(), x: cp1.x - left - 20, y: cp2.y, temp: temp.temp }
          );
        } else if (cp2.x > cp1.x && cp2.x < cp1.x + right) {
          pts.push(
            { id: s8(), x: cp1.x + right + 20, y: cp1.y, temp: temp.temp },
            { id: s8(), x: cp1.x + right + 20, y: cp2.y, temp: temp.temp }
          );
        } else {
          pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
        }
      } else {
        if (cp2.x < cp1.x) {
          cp1.x = cp2.x;
        } else if (cp2.x <= cp1.x + right + 20 && cp2.x > cp1.x) {
          pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
        } else if (cp2.y < cp1.y && cp2.y > cp1.y - top) {
          pts.push(
            { id: s8(), x: cp1.x, y: cp1.y - top - 20, temp: temp.temp },
            { id: s8(), x: cp2.x, y: cp1.y - top - 20, temp: temp.temp }
          );
        } else if (cp2.y > cp1.y && cp2.y < cp1.y + bottom) {
          pts.push(
            { id: s8(), x: cp1.x, y: cp1.y + bottom + 20, temp: temp.temp },
            { id: s8(), x: cp2.x, y: cp1.y + bottom + 20, temp: temp.temp }
          );
        } else {
          pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
        }
      }
    } else {
      if (cp1.direction === Direction.Up) {
        if (cp2.direction === Direction.Up) {
          if (cp1.y > cp2.y) {
            cp1.y = cp2.y;
          } else {
            cp2.y = cp1.y;
          }
        } else if (cp2.direction === Direction.Right) {
          if (cp2.x < cp1.x && cp2.y < cp1.y) {
            cp1.y = cp2.y;
          } else {
            pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Bottom) {
          if (cp1.y > cp2.y) {
            cp1.y = cp2.y;
          } else {
            let x = Math.round(Math.abs(cp1.x - cp2.x) / 2);
            x = cp1.x < cp2.x ? cp1.x + x : cp2.x + x;
            pts.push({ id: s8(), x, y: cp1.y, temp: temp.temp }, { id: s8(), x, y: cp2.y, temp: temp.temp });
          }
        } else {
          // cp2.direction === Direction.Left
          pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
        }
      } else if (cp1.direction === Direction.Right) {
        if (cp2.direction === Direction.Up) {
          if (cp2.x > cp1.x && cp2.y > cp1.y) {
            cp1.x = cp2.x;
          } else {
            pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Right) {
          if (cp1.x < cp2.x) {
            cp1.x = cp2.x;
          } else {
            cp2.x = cp1.x;
          }
        } else if (cp2.direction === Direction.Bottom) {
          if (cp1.x < cp2.x && cp1.y > cp2.y) {
            cp1.x = cp2.x;
          } else {
            pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
          }
        } else {
          if (cp1.x < cp2.x) {
            cp2.x = cp1.x;
          } else {
            let y = Math.round(Math.abs(cp1.y - cp2.y) / 2);
            y = cp1.y < cp2.y ? cp1.y + y : cp2.y + y;
            pts.push({ id: s8(), x: cp1.x, y, temp: temp.temp }, { id: s8(), x: cp2.x, y, temp: temp.temp });
          }
        }
      } else if (cp1.direction === Direction.Bottom) {
        if (cp2.direction === Direction.Up) {
          if (cp1.y < cp2.y) {
            cp1.y = cp2.y;
          } else {
            let x = Math.round(Math.abs(cp1.x - cp2.x) / 2);
            x = cp1.x < cp2.x ? cp1.x + x : cp2.x + x;
            pts.push({ id: s8(), x, y: cp1.y, temp: temp.temp }, { id: s8(), x, y: cp2.y, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Right) {
          if (cp2.x < cp1.x && cp2.y > cp1.y) {
            cp1.y = cp2.y;
          } else {
            pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Bottom) {
          if (cp1.y < cp2.y) {
            cp1.y = cp2.y;
          } else {
            pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
          }
        } else {
          // cp2.direction === Direction.Left
          if (cp1.y < cp2.y && cp1.x < cp2.x) {
            cp1.y = cp2.y;
          } else {
            pts.push({ id: s8(), x: cp2.x, y: cp1.y, temp: temp.temp });
          }
        }
      } else {
        if (cp2.direction === Direction.Up) {
          if (cp2.x < cp1.x && cp2.y > cp1.y) {
            cp1.x = cp2.x;
          } else {
            pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Right) {
          if (cp1.x > cp2.x) {
            cp2.x = cp1.x;
          } else {
            let y = Math.round(Math.abs(cp1.y - cp2.y) / 2);
            y = cp1.y < cp2.y ? cp1.y + y : cp2.y + y;
            pts.push({ id: s8(), x: cp1.x, y, temp: temp.temp }, { id: s8(), x: cp2.x, y, temp: temp.temp });
          }
        } else if (cp2.direction === Direction.Bottom) {
          if (cp1.x > cp2.x && cp1.y > cp2.y) {
            cp1.x = cp2.x;
          } else {
            pts.push({ id: s8(), x: cp1.x, y: cp2.y, temp: temp.temp });
          }
        } else {
          if (cp1.x < cp2.x) {
            cp2.x = cp1.x;
          } else {
            cp1.x = cp2.x;
          }
        }
      }
    }
  }

  if (cp1 !== pt) {
    pts.unshift(cp1);
  }

  if (cp2 !== temp) {
    pts.push(cp2);
  }

  const end = pts.length - 1;
  if (end < 0) {
    return pts;
  }

  const dx = temp.x - pts[end].x;
  const dy = temp.y - pts[end].y;
  if (dx * dx + dy * dy >= 100) {
    if (temp.id == undefined) {
      temp.id = s8();
    }
    pts.push(temp);
  }

  return pts;
}

export function simplifyOrthogonalPoints(pts: Point[]): Point[] {
  if (!pts || pts.length <= 2) {
    return pts;
  }

  let prev = pts[0];
  let current = pts[1];

  const result = [prev, current];
  let index = 1;
  let isHorizontal = prev.y === current.y;

  for (let i = 2; i < pts.length; i++) {
    prev = current;
    current = pts[i];

    const isNextHorizontal = prev.y === current.y;
    if (isHorizontal === isNextHorizontal) {
      // 当前位置点和前面的点在同一水平线上，替换数组末尾的点为最新的点
      const temp = result[index].temp;
      result[index] = current;
      temp && (result[index].temp = temp);
      continue;
    }

    // 拐弯
    isHorizontal = isNextHorizontal;
    result.push(current);
    ++index;
  }

  if (
    result.length > 2 &&
    Math.abs(result[result.length - 1].x - result[result.length - 2].x) < 5 &&
    Math.abs(result[result.length - 1].y - result[result.length - 2].y) < 5
  ) {
    // 如果最后两个点距离过近，移除最后一个点
    result.pop();
  }

  return result;
}

// 拖拽正交线的锚点，计算正交线的点数组。add - 是否直接新点；
// endHorizontal - 拖首尾时第一段（端点 → 相邻锚点）是否为横段，由调用方按拖动开始时的连线算好传入，不传则按当前点推断
export function dragOrthogonalPoint(
  anchors: Point[],
  anchor: Point,
  temp: Point,
  add = false,
  endHorizontal?: boolean,
): Point[] {
  const result: Point[] = [];
  let index = 0;
  let i = 0;
  for (const pt of anchors) {
    if (pt.temp) {
      continue;
    }

    result.push(pt);
    if (anchor.id === pt.id) {
      index = i;
    }

    ++i;
  }

  // 首尾锚点（只有未连接图元的首尾才会走到这里，见 meta2d-mouse handleLineAnchorDown）：
  // 端点直接跟到鼠标，相邻锚点跟着挪与端点共用的那一维，保持第一段仍是横 / 竖，不新增锚点；
  // 相邻锚点的另一维与再下一个锚点共用、不动，所以第二段也仍是横 / 竖。
  // 第一段的方向在整个拖动中不变（只挪共用的那一维），优先用调用方按拖动开始时算好的 endHorizontal：
  // 端点自由移动时，端点、相邻锚点、再下一个锚点可能恰好叠在一点，这时从当前点什么也推断不出来。
  if (index === 0 || index === i - 1) {
    const nb = index === 0 ? result[1] : result[i - 2];
    let horizontal = endHorizontal ?? (nb && nb.y === anchor.y);
    // 没有 endHorizontal 时：端点滑过相邻锚点（鼠标坐标取整，很容易恰好落在它上面）两点重合，从这一段本身看不出是横是竖。
    // 这时若按「y 相等 = 横」判，竖段会被当成横段，相邻锚点从此跟着端点走，松手后化简掉一个拐点、出现斜线。
    // 正交线相邻两段互相垂直 ⇒ 改看下一段；没有下一段就按这次拖动的方向。
    if (endHorizontal == undefined && nb && nb.x === anchor.x && nb.y === anchor.y) {
      const nb2 = index === 0 ? result[2] : result[i - 3];
      horizontal = nb2 ? nb2.x === nb.x : temp.y === anchor.y;
    }
    anchor.x = temp.x;
    anchor.y = temp.y;
    if (nb) {
      horizontal ? (nb.y = temp.y) : (nb.x = temp.x);
    }
    return result;
  }

  // 第 2 个 / 倒数第 2 个锚点：原来一律强制插入新锚点，只为让首尾不动。
  // 现在只有首尾**连着图元**时才需要保住它：让拖动只沿那一段的方向走（那一段的端点就不用动），
  // 不插锚点；首尾没连接时按普通锚点拖，首尾跟着沿垂直方向滑。
  // 按住 shift（add = true）仍是原来的插入行为；两头都连着且两段互相垂直时锁不住任何方向，也退回插入。
  if (!add && (index === 1 || index === i - 2)) {
    const lockX = (end: Point, seg: Point) => end?.connectedPen && end.x === seg.x; // 竖直段：只能上下
    const lockY = (end: Point, seg: Point) => end?.connectedPen && end.y === seg.y; // 水平段：只能左右
    const first = index === 1 ? result[0] : undefined;
    const last = index === i - 2 ? result[i - 1] : undefined;
    const fixX = lockX(first, anchor) || lockX(last, anchor);
    const fixY = lockY(first, anchor) || lockY(last, anchor);
    if (fixX && fixY) {
      add = true;
    } else {
      fixX && (temp.x = anchor.x);
      fixY && (temp.y = anchor.y);
    }
  }

  const prev = result[index - 1];
  const next = result[index + 1];

  if (add) {
    let t = 0;
    if (Math.abs(temp.x - anchor.x) < 10) {
      temp.x = anchor.x;
      t = 1;
    }
    if (Math.abs(temp.y - anchor.y) < 10) {
      temp.y = anchor.y;
      t += 2;
    }

    // 移回原位
    if (t > 2) {
      result[index] = anchor;
      return result;
    }

    // 水平移动
    if (t === 2) {
      if (prev.y === anchor.y) {
        const y = next.y > anchor.y ? anchor.y + 10 : anchor.y - 10;
        result.splice(index + 1, 0, { id: s8(), x: temp.x, y, temp: true });
        result.splice(index + 2, 0, { id: s8(), x: next.x, y, temp: true });
      } else {
        const y = prev.y > anchor.y ? anchor.y + 10 : anchor.y - 10;
        result.splice(index++, 0, { id: s8(), x: prev.x, y, temp: true });
        result.splice(index++, 0, { id: s8(), x: temp.x, y, temp: true });
      }

      temp.id = result[index].id;
      temp.temp = undefined;
      result[index] = temp;

      return result;
    }
    // 垂直移动
    if (t === 1) {
      if (prev.x === anchor.x) {
        const x = next.x > anchor.x ? anchor.x + 10 : anchor.x - 10;
        result.splice(index + 1, 0, { id: s8(), x, y: temp.y, temp: true });
        result.splice(index + 2, 0, { id: s8(), x, y: next.y, temp: true });
      } else {
        const x = prev.x > anchor.x ? anchor.x + 10 : anchor.x - 10;
        result.splice(index++, 0, { id: s8(), x, y: prev.y, temp: true });
        result.splice(index++, 0, { id: s8(), x, y: temp.y, temp: true });
      }

      temp.id = result[index].id;
      temp.temp = undefined;
      result[index] = temp;
      return result;
    }

    const inside = pointInAngle(prev, anchor, next, temp);
    if (inside) {
      // 水平
      if (prev.y === anchor.y) {
        result.splice(index++, 0, { id: s8(), x: temp.x, y: prev.y, temp: true });
        result.splice(index + 1, 0, { id: s8(), x: next.x, y: temp.y, temp: true });
      } else {
        result.splice(index++, 0, { id: s8(), x: prev.x, y: temp.y, temp: true });
        result.splice(index + 1, 0, { id: s8(), x: temp.x, y: next.y, temp: true });
      }
    } else {
      if (prev.y === anchor.y) {
        // 水平
        if (prev.x < anchor.x) {
          if (temp.x > anchor.x) {
            if ((anchor.y > next.y && anchor.y > temp.y) || (anchor.y < next.y && anchor.y < temp.y)) {
              result.splice(index++, 0, { id: s8(), x: temp.x, y: prev.y, temp: true });
              result.splice(index + 1, 0, { id: s8(), x: next.x, y: temp.y, temp: true });
            } else {
              const y = next.y > anchor.y ? anchor.y + 10 : anchor.y - 10;
              result.splice(index++, 0, { id: s8(), x: anchor.x - 10, y: prev.y, temp: true });
              result.splice(index++, 0, { id: s8(), x: anchor.x - 10, y: temp.y, temp: true });
              result.splice(index + 1, 0, { id: s8(), x: temp.x, y, temp: true });
              result.splice(index + 2, 0, { id: s8(), x: next.x, y, temp: true });
            }
          } else {
            result.splice(index++, 0, { id: s8(), x: temp.x, y: prev.y, temp: true });
            result.splice(index + 1, 0, { id: s8(), x: next.x, y: temp.y, temp: true });
          }
        } else {
          if (temp.x < anchor.x) {
            if ((anchor.y > next.y && anchor.y > temp.y) || (anchor.y < next.y && anchor.y < temp.y)) {
              result.splice(index++, 0, { id: s8(), x: temp.x, y: prev.y, temp: true });
              result.splice(index + 1, 0, { id: s8(), x: next.x, y: temp.y, temp: true });
            } else {
              const y = next.y > anchor.y ? anchor.y + 10 : anchor.y - 10;
              result.splice(index++, 0, { id: s8(), x: anchor.x + 10, y: prev.y, temp: true });
              result.splice(index++, 0, { id: s8(), x: anchor.x + 10, y: temp.y, temp: true });
              result.splice(index + 1, 0, { id: s8(), x: temp.x, y, temp: true });
              result.splice(index + 2, 0, { id: s8(), x: next.x, y, temp: true });
            }
          } else {
            result.splice(index++, 0, { id: s8(), x: temp.x, y: prev.y, temp: true });
            result.splice(index + 1, 0, { id: s8(), x: next.x, y: temp.y, temp: true });
          }
        }
      } else {
        // 垂直
        if (prev.y < anchor.y) {
          if (temp.y > anchor.y) {
            if ((anchor.x > next.x && anchor.x > temp.x) || (anchor.x < next.x && anchor.x < temp.x)) {
              result.splice(index++, 0, { id: s8(), x: prev.x, y: temp.y, temp: true });
              result.splice(index + 1, 0, { id: s8(), x: temp.x, y: next.y, temp: true });
            } else {
              const x = next.x > anchor.x ? anchor.x + 10 : anchor.x - 10;
              result.splice(index++, 0, { id: s8(), x: prev.x, y: anchor.y - 10, temp: true });
              result.splice(index++, 0, { id: s8(), x: temp.x, y: anchor.y - 10, temp: true });
              result.splice(index + 1, 0, { id: s8(), x, y: temp.y, temp: true });
              result.splice(index + 2, 0, { id: s8(), x, y: next.y, temp: true });
            }
          } else {
            result.splice(index++, 0, { id: s8(), x: prev.x, y: temp.y, temp: true });
            result.splice(index + 1, 0, { id: s8(), x: temp.x, y: next.y, temp: true });
          }
        } else {
          if (temp.y < anchor.y) {
            if ((anchor.x > next.x && anchor.x > temp.x) || (anchor.x < next.x && anchor.x < temp.x)) {
              result.splice(index++, 0, { id: s8(), x: prev.x, y: temp.y, temp: true });
              result.splice(index + 1, 0, { id: s8(), x: temp.x, y: next.y, temp: true });
            } else {
              const x = next.x > anchor.x ? anchor.x + 10 : anchor.x - 10;
              result.splice(index++, 0, { id: s8(), x: prev.x, y: anchor.y + 10, temp: true });
              result.splice(index++, 0, { id: s8(), x: temp.x, y: anchor.y + 10, temp: true });
              result.splice(index + 1, 0, { id: s8(), x, y: temp.y, temp: true });
              result.splice(index + 2, 0, { id: s8(), x, y: next.y, temp: true });
            }
          } else {
            result.splice(index++, 0, { id: s8(), x: prev.x, y: temp.y, temp: true });
            result.splice(index + 1, 0, { id: s8(), x: temp.x, y: next.y, temp: true });
          }
        }
      }
    }

    temp.id = result[index].id;
    temp.temp = undefined;
    result[index] = temp;

    return result;
  }

  // 水平
  if (prev.y === anchor.y) {
    anchor.x = temp.x;
    anchor.y = temp.y;
    prev.y = temp.y;
    next.x = temp.x;
  } else {
    anchor.x = temp.x;
    anchor.y = temp.y;
    prev.x = temp.x;
    next.y = temp.y;
  }

  return result;
}

function pointInAngle(p1: Point, p2: Point, p3: Point, p: Point) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const vp = { x: p.x - p2.x, y: p.y - p2.y };

  const d1 = vp.x * v1.x + vp.y * v1.y;
  const d2 = vp.x * v2.x + vp.y * v2.y;

  return d1 >= 0 && d2 >= 0;
}
