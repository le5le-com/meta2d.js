/*
 * 相交线弯曲效果处理模块
 * 提供处理、清除和更新相交线弯曲效果的功能
 * 
 * 核心功能：
 * 1. 检测直线和折线的相交点
 * 2. 为相交点创建弯曲效果（只有最上层的线弯曲）
 * 3. 合并相近的相交点，创建更大的弯曲包含多个相交点
 * 4. 高性能实现，支持大量线条
 * 
 * date: 2024
 */

import { s8 } from '@meta2d/core';

enum PenType {
  Node,
  Line,
}

enum PrevNextType {
  Mirror,
  Bilateral,
  Free,
}

interface PurePoint {
  x: number;
  y: number;
}

interface Anchor {
  id: string;
  penId: string;
  x: number;
  y: number;
  intersect?: boolean;  // 标记是否为相交弯曲效果添加的锚点，清除时根据此字段判断
  hidden?: boolean;
  locked?: number;
  lastAnchorIndex: string;
  brotherId: string;
  next?: {
    penId: string;
    x: number;
    y: number;
  };
  prev?: {
    penId: string;
    x: number;
    y: number;
  };
  prevNextType?: PrevNextType;
}

// 相交点的弯曲半径
let radius = 1;
// 判断点在线上的偏移值
const dotHitOffset = 2;
// 判断多个相交点是否为同一点的距离阈值（考虑误差）
const intersectionTolerance = 5;
// 判断多个相交点是否应该合并的距离阈值
// 当一条线与多条线相交，且相交点之间距离小于此值时，会合并为一个更大的弯曲
// 可以根据实际需要调整此值：值越大，越容易合并；值越小，越保持独立弯曲
const mergeDistanceThreshold = 20;
// 锚点坐标误差偏移值,用于去掉重复锚点
const anchorOffsetXY = 0.000001;
// 锚点数组
let anchors: Anchor[] = [];
// 支持的线条类型
const crossLines = ['line', 'polyline'];

// 相交点信息接口
interface IntersectionPoint {
  x: number;
  y: number;
  segmentStart: any;  // 线段起点
  segmentEnd: any;    // 线段终点
  segmentIndex: number; // 线段索引
  radius: number;     // 计算出的半径
}

/**
 * 处理所有直线和折线的相交弯曲效果
 * 
 * 核心逻辑：
 * 1. 从后往前遍历线条（后面的线在上层）
 * 2. 使用容差范围判断多个相交点是否为同一点（避免精度问题）
 * 3. 多条线相交于一点时，只有最上层的线弯曲
 * 4. 合并相近的相交点（距离 < mergeDistanceThreshold）
 * 5. 为合并后的相交点组创建更大的弯曲半径
 * 6. 只处理直线和折线，不处理曲线
 */
export function processLineIntersections(): void {
  if (!(window as any).meta2d) {
    console.warn('meta2d 未初始化');
    return;
  }

  // 获取所有直线和折线 - 使用 Set 提高查找性能
  const crossLinesSet = new Set(crossLines);
  const allLines = (window as any).meta2d.store.data.pens.filter(pen => 
    pen.type === PenType.Line && crossLinesSet.has(pen.lineName)
  );

  if (allLines.length === 0) {
    return;
  }

  // 先清除所有现有的相交效果
  clearAllIntersections();

  // 存储已处理的相交点（使用 Map 存储坐标，提高查找性能）
  const processedIntersections = new Map<string, { x: number, y: number }>();

  // 从后往前处理每条线（后面的线在上层，优先弯曲）
  for (let i = allLines.length - 1; i >= 0; i--) {
    const currentLine = allLines[i];
    // 不使用 slice，直接传递索引，避免数组拷贝
    if (i === 0) continue;

    processLineIntersection(currentLine, allLines, i, processedIntersections);
  }

  // 重新渲染
  (window as any).meta2d.render();
}

/**
 * 处理单条线与其他线的相交情况
 * @param currentLine 当前处理的线
 * @param allLines 所有线条数组
 * @param currentIndex 当前线在数组中的索引
 * @param processedIntersections 已处理的相交点 Map
 */
function processLineIntersection(
  currentLine: any, 
  allLines: any[], 
  currentIndex: number,
  processedIntersections: Map<string, { x: number, y: number }>
): void {
  if (!currentLine.calculative || !currentLine.calculative.worldAnchors) {
    return;
  }
  const initiativeAnchors = currentLine.calculative.worldAnchors.filter((el: any) => !el.next && !el.prev);
  // 重置锚点数组
  anchors = [];
  
  // 预计算画布缩放比，避免重复获取
  const scale = (window as any).meta2d.store.data.scale;
  const currentLineWidth = currentLine.lineWidth || 1;
  
  // 收集当前线的所有相交点（按线段分组）
  const segmentIntersections = new Map<number, IntersectionPoint[]>();
  
  for (let m = 0; m < initiativeAnchors.length - 1; m++) {
    const l1 = initiativeAnchors[m];
    const l11 = initiativeAnchors[m + 1];
    const currentSegmentIntersections: IntersectionPoint[] = [];

    // 只遍历索引 < currentIndex 的线（前面的线）
    for (let j = 0; j < currentIndex; j++) {
      const otherLine = allLines[j];
      if (!otherLine.calculative || !otherLine.calculative.worldAnchors) {
        continue;
      }

      // 预计算半径，避免在内层循环重复计算
      const otherLineWidth = otherLine.lineWidth || 1;
      const calculatedRadius = (3 + (otherLineWidth / currentLineWidth) * currentLineWidth) * scale;

      const passiveAnchors = otherLine.calculative.worldAnchors.filter((el: any) => !el.next && !el.prev);
      
      for (let n = 0; n < passiveAnchors.length - 1; n++) {
        const l2 = passiveAnchors[n];
        const l22 = passiveAnchors[n + 1];

        // 判断两条直线是否相交
        const { onLine1, onLine2, x, y } = checkLineIntersection(
          l1.x, l1.y, l11.x, l11.y, 
          l2.x, l2.y, l22.x, l22.y
        );
        
        if (onLine1 && onLine2) {
          // 使用网格化键快速检查附近是否有已处理的相交点
          let alreadyProcessed = false;
          const gridSize = intersectionTolerance  * scale;
          const gridX = Math.floor(x / gridSize);
          const gridY = Math.floor(y / gridSize);
          
          // 检查当前网格及相邻8个网格
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const key = `${gridX + dx},${gridY + dy}`;
              const processed = processedIntersections.get(key);
              if (processed && getDistance(x, y, processed.x, processed.y) < intersectionTolerance * scale) {
                alreadyProcessed = true;
                break;
              }
            }
            if (alreadyProcessed) break;
          }
          
          if (alreadyProcessed) {
            continue;
          }
          
          // 标记这个相交点已被处理（使用网格键存储）
          const key = `${gridX},${gridY}`;
          processedIntersections.set(key, { x, y });

          // 收集相交点信息，而不是立即创建锚点
          currentSegmentIntersections.push({
            x,
            y,
            segmentStart: l1,
            segmentEnd: l11,
            segmentIndex: m,
            radius: calculatedRadius
          });
        }
      }
    }
    
    // 如果当前线段有相交点，存储起来
    if (currentSegmentIntersections.length > 0) {
      segmentIntersections.set(m, currentSegmentIntersections);
    }
  }

  // 处理收集到的相交点：合并相近的相交点
  for (const [segmentIndex, intersections] of segmentIntersections) {
    const mergedGroups = mergeNearbyIntersections(intersections);
    
    // 为每组相交点创建弯曲锚点
    for (const group of mergedGroups) {
      createBendAnchorsForGroup(currentLine, group, initiativeAnchors);
    }
  }

  // 处理并插入锚点
  if (anchors.length > 0) {
    processAndInsertAnchors(currentLine);
  }
}

/**
 * 合并相近的相交点
 * @param intersections 相交点数组
 * @returns 合并后的相交点组数组
 */
function mergeNearbyIntersections(intersections: IntersectionPoint[]): IntersectionPoint[][] {
  if (intersections.length === 0) return [];
  if (intersections.length === 1) return [intersections];
  
  // 按照在线段上的位置排序
  const sorted = [...intersections].sort((a, b) => {
    const distA = getDistance(a.x, a.y, a.segmentStart.x, a.segmentStart.y);
    const distB = getDistance(b.x, b.y, b.segmentStart.x, b.segmentStart.y);
    return distA - distB;
  });
  
  const groups: IntersectionPoint[][] = [];
  let currentGroup: IntersectionPoint[] = [sorted[0]];
  
  const scale = (window as any).meta2d.store.data.scale || 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const distance = getDistance(prev.x, prev.y, curr.x, curr.y);
    // 如果距离小于阈值，合并到当前组
    if (distance < mergeDistanceThreshold * scale) {
      currentGroup.push(curr);
    } else {
      // 否则，保存当前组并开始新组
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  
  // 添加最后一组
  groups.push(currentGroup);
  
  return groups;
}

/**
 * 为一组相交点创建弯曲锚点
 * @param line 当前线
 * @param group 相交点组
 * @param initiativeAnchors 主动锚点数组
 */
function createBendAnchorsForGroup(line: any, group: IntersectionPoint[], initiativeAnchors: any[]): void {
  if (group.length === 0) return;
  
  // 计算组的中心点
  const centerX = group.reduce((sum, p) => sum + p.x, 0) / group.length;
  const centerY = group.reduce((sum, p) => sum + p.y, 0) / group.length;
  
  // 计算组的范围，确定弯曲半径
  // 使用最大半径，并根据组内相交点数量和分布范围适当增大
  const maxRadius = Math.max(...group.map(p => p.radius));
  
  // 计算组的跨度（最远两点的距离）
  let maxSpan = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const span = getDistance(group[i].x, group[i].y, group[j].x, group[j].y);
      maxSpan = Math.max(maxSpan, span);
    }
  }
  
  // 合并后的半径：基础半径 + 跨度的一半 + 额外的缓冲
  const mergedRadius = maxRadius + (maxSpan / 2) + 5;
  
  // 使用第一个点的线段信息
  const firstPoint = group[0];
  const l1 = firstPoint.segmentStart;
  const l11 = firstPoint.segmentEnd;
  
  // 设置全局半径并创建弯曲
  radius = mergedRadius;
  createBendAnchors(line, l1, l11, { x: centerX, y: centerY }, initiativeAnchors);
}

/**
 * 创建弯曲锚点
 */
function createBendAnchors(line: any, l1: any, l11: any, intersection: { x: number, y: number }, initiativeAnchors: any[]): void {
  // 算出拖动线条的直线方程式
  const { a, b, c } = lineFromPoints(l1, l11);
  const k = -(a / b);

  // 求出经过圆心的直线与圆的两个交点
  const ret = inteceptCircleLineSeg({ radius, x: intersection.x, y: intersection.y }, { p1: l1, p2: l11 });

  if (ret.length === 2) {
    let k1 = 1;
    if (a !== 0) {
      k1 = b / a;
    } else {
      k1 = intersection.y;
    }

    const deltaX1 = Math.sqrt((radius * radius) / (k1 * k1 + 1));
    const deltaY1 = k1 * deltaX1;

    let p4: PurePoint = { x: 0, y: 0 }, p5: PurePoint = { x: 0, y: 0 };

    if (-k1 < 0) {
      p4.x = ret[0].x - deltaX1;
      p4.y = ret[0].y - deltaY1;
      p5.x = ret[1].x - deltaX1;
      p5.y = ret[1].y - deltaY1;
    } else {
      p4.x = ret[0].x + deltaX1;
      p4.y = ret[0].y + deltaY1;
      p5.x = ret[1].x + deltaX1;
      p5.y = ret[1].y + deltaY1;
    }

    // 找到相交点所在正确的线段
    let l3 = { x: 0, y: 0, id: '' };
    for (let u = 0; u < initiativeAnchors.length; u++) {
      if (u !== initiativeAnchors.length - 1) {
        const u1 = initiativeAnchors[u];
        const u11 = initiativeAnchors[u + 1];
        const cross = calcIsInsideThickLineSegment(u1, u11, intersection, dotHitOffset);
        if (cross) {
          l3.x = u1.x;
          l3.y = u1.y;
          l3.id = u1.id;
          break;
        }
      }
    }
    const an1: Anchor = {
      id: s8(),
      penId: line.id,
      x: ret[0].x,
      y: ret[0].y,
      intersect: true,
      hidden: true,
      locked: 2,
      lastAnchorIndex: l3.id,
      brotherId: "",
      next: {
        penId: line.id,
        x: p4.x,
        y: p4.y,
      },
      prev: {
        penId: line.id,
        x: ret[0].x,
        y: ret[0].y,
      },
      prevNextType: PrevNextType.Bilateral
    };

    const an2: Anchor = {
      id: s8(),
      penId: line.id,
      x: ret[1].x,
      y: ret[1].y,
      intersect: true,
      hidden: true,
      locked: 2,
      lastAnchorIndex: l3.id,
      brotherId: "",
      next: {
        penId: line.id,
        x: ret[1].x,
        y: ret[1].y,
      },
      prev: {
        penId: line.id,
        x: p5.x,
        y: p5.y,
      },
      prevNextType: PrevNextType.Bilateral
    };

    an1.brotherId = an2.id;
    an2.brotherId = an1.id;
    anchors.push(...[an1, an2]);
  }
}

/**
 * 处理并插入锚点到线条中
 */
function processAndInsertAnchors(line: any): void {
  const worldAnchors = line.calculative.worldAnchors;
  
  // 预先构建 id -> anchor 的 Map，避免重复 find
  const anchorMap = new Map<string, any>();
  for (const anchor of worldAnchors) {
    if (anchor.id) {
      anchorMap.set(anchor.id, anchor);
    }
  }
  
  // 对所有的相交锚点按照相对参考锚点的距离大小排序
  anchors.sort((a, b) => {
    if (a.lastAnchorIndex === b.lastAnchorIndex) {
      const l3 = anchorMap.get(a.lastAnchorIndex);
      if (l3) {
        return getDistance(a.x, a.y, l3.x, l3.y) - getDistance(b.x, b.y, l3.x, l3.y);
      }
    }
    return 0;
  });

  // 由于已经在全局层面通过 processedIntersections 避免了多条线在同一点的重复处理
  // 这里不再需要移除相邻锚点的逻辑

  // X,Y坐标相近的锚点成对去重 - 使用 Map 优化
  const brotherMap = new Map<string, Anchor>();
  for (const anchor of anchors) {
    brotherMap.set(anchor.id, anchor);
  }
  
  const toRemove = new Set<number>();
  for (let p = 0; p < anchors.length; p++) {
    if (toRemove.has(p)) continue;
    const an1 = anchors[p];
    
    for (let o = p + 1; o < anchors.length; o++) {
      if (toRemove.has(o)) continue;
      const an2 = anchors[o];
      
      if (getDistance(an1.x, an1.y, an2.x, an2.y) <= anchorOffsetXY) {
        toRemove.add(o);
        // 找到兄弟节点并标记删除
        const brotherIndex = anchors.findIndex((el, idx) => el.id === an2.brotherId && !toRemove.has(idx));
        if (brotherIndex !== -1) {
          toRemove.add(brotherIndex);
        }
      }
    }
  }
  
  // 一次性删除所有标记的锚点
  const filteredAnchors = anchors.filter((_, idx) => !toRemove.has(idx));
  anchors.length = 0;
  anchors.push(...filteredAnchors);

  // 预先构建 id -> index 的 Map，避免重复 findIndex
  const indexMap = new Map<string, number>();
  for (let i = 0; i < worldAnchors.length; i++) {
    if (worldAnchors[i].id) {
      indexMap.set(worldAnchors[i].id, i);
    }
  }

  // 对每个新增锚点按照正确的顺序插入到worldAnchors数组中
  let lastIndex: string | null = null;
  let index = -1;
  let count = 0;
  
  for (const an of anchors) {
    if (lastIndex === null || lastIndex !== an.lastAnchorIndex) {
      index = indexMap.get(an.lastAnchorIndex) ?? -1;
      count = 0;
    } else {
      count++;
    }
    
    if (index !== -1) {
      // 检查是否已存在相同坐标的锚点
      const insertIndex = index + count + 1;
      const exists = worldAnchors.some((el: any) => 
        el.x === an.x && el.y === an.y && el.penId === an.penId
      );
      
      if (!exists) {
        worldAnchors.splice(insertIndex, 0, an);
        // 更新 indexMap 中受影响的索引
        for (let i = insertIndex; i < worldAnchors.length; i++) {
          if (worldAnchors[i].id) {
            indexMap.set(worldAnchors[i].id, i);
          }
        }
        lastIndex = an.lastAnchorIndex;
      }
    }
  }

  (window as any).meta2d.canvas.updateLines(line);
  (window as any).meta2d.canvas.initLineRect(line);
}

/**
 * 清除所有相交线弯曲效果
 * 通过 intersect 字段识别并删除弯曲锚点
 */
export function clearAllIntersections(): void {
  if (!(window as any).meta2d) {
    console.warn('meta2d 未初始化');
    return;
  }

  const allLines = (window as any).meta2d.store.data.pens.filter((pen: any) => 
    pen.type === PenType.Line && crossLines.indexOf(pen.lineName) !== -1
  );

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    
    if (line.calculative && line.calculative.worldAnchors) {
      const worldAnchors = line.calculative.worldAnchors;
      // 删除所有标记为相交弯曲的锚点（intersect: true）
      for (let j = worldAnchors.length - 1; j >= 0; j--) {
        const anchor = worldAnchors[j];
        if (anchor.intersect === true) {
          worldAnchors.splice(j, 1);
        }
      }
      
      // 如果删除了锚点，需要重新计算线条的矩形范围
      if (worldAnchors.length >= 2) {
        (window as any).meta2d.canvas.initLineRect(line);
      }
    }
  }

  // 清空锚点数组
  anchors = [];
  
  // 重新渲染
  (window as any).meta2d.render();
}

/**
 * 更新所有相交点弯曲位置
 * 采用先清除所有弯曲效果，再重新处理所有相交点弯曲的方案
 */
export function updateIntersectionBends(): void {
  if (!(window as any).meta2d) {
    console.warn('meta2d 未初始化');
    return;
  }

  // 先清除所有现有的相交效果
  clearAllIntersections();
  
  // 重新处理所有相交点弯曲
  processLineIntersections();
}

// 以下是辅助函数，从原代码中复制

/**
 * 判断一个点是否在一条有厚度的线段内
 * @param line1 线段起点
 * @param line2 线段终点
 * @param pnt 待检测的点
 * @param lineThickness 线段厚度（半径）
 * @returns 是否在线段内
 */
function calcIsInsideThickLineSegment(line1: any, line2: any, pnt: any, lineThickness: number): boolean {
  const dx = line2.x - line1.x;
  const dy = line2.y - line1.y;
  const lengthSquared = dx * dx + dy * dy;
  
  // 线段长度为0（起点和终点重合）
  if (lengthSquared === 0) {
    return getDistance(line1.x, line1.y, pnt.x, pnt.y) <= lineThickness;
  }
  
  // 计算点在线段上的投影参数 t（0表示起点，1表示终点）
  const t = ((pnt.x - line1.x) * dx + (pnt.y - line1.y) * dy) / lengthSquared;
  
  if (t < 0) {
    // 投影在起点之前，计算到起点的距离
    return getDistance(line1.x, line1.y, pnt.x, pnt.y) <= lineThickness;
  } else if (t > 1) {
    // 投影在终点之后，计算到终点的距离
    return getDistance(line2.x, line2.y, pnt.x, pnt.y) <= lineThickness;
  } else {
    // 投影在线段范围内，计算垂直距离
    const projX = line1.x + t * dx;
    const projY = line1.y + t * dy;
    return getDistance(projX, projY, pnt.x, pnt.y) <= lineThickness;
  }
}

/**
 * 求出一条直线与圆的交点（仅返回在线段范围内的交点）
 * @param circle 圆对象 {x, y, radius}
 * @param line 线段对象 {p1, p2}
 * @returns 交点数组（0-2个交点）
 */
function inteceptCircleLineSeg(circle: any, line: any): PurePoint[] {
  // 线段方向向量
  const dx = line.p2.x - line.p1.x;
  const dy = line.p2.y - line.p1.y;
  
  // 线段起点到圆心的向量
  const fx = line.p1.x - circle.x;
  const fy = line.p1.y - circle.y;
  
  // 二次方程系数: a*t^2 + b*t + c = 0
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - circle.radius * circle.radius;
  
  // 判别式
  const discriminant = b * b - 4 * a * c;
  
  // 无交点
  if (discriminant < 0) {
    return [];
  }
  
  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  
  const result: PurePoint[] = [];
  
  // 检查 t1 是否在线段范围内 [0, 1]
  if (t1 >= 0 && t1 <= 1) {
    result.push({
      x: line.p1.x + dx * t1,
      y: line.p1.y + dy * t1
    });
  }
  
  // 检查 t2 是否在线段范围内 [0, 1]（且不与 t1 重复）
  if (t2 >= 0 && t2 <= 1 && t2 !== t1) {
    result.push({
      x: line.p1.x + dx * t2,
      y: line.p1.y + dy * t2
    });
  }
  
  return result;
}

/**
 * 根据两个点返回一条直线的表达式 ax + by = c
 * @param p1 第一个点
 * @param p2 第二个点
 * @returns 直线方程的系数 {a, b, c}
 */
function lineFromPoints(p1: PurePoint, p2: PurePoint): { a: number, b: number, c: number } {
  const a = p2.y - p1.y;
  const b = p1.x - p2.x;
  const c = a * p1.x + b * p1.y;
  return { a, b, c };
}

/**
 * 计算两点之间的欧几里得距离
 */
function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 检测两条线段是否相交，并返回交点信息
 * @returns {x, y, onLine1, onLine2} 交点坐标和是否在线段范围内的标志
 */
function checkLineIntersection(
  line1StartX: number, line1StartY: number, line1EndX: number, line1EndY: number,
  line2StartX: number, line2StartY: number, line2EndX: number, line2EndY: number
): { x: number, y: number, onLine1: boolean, onLine2: boolean } {
  // 线段1和线段2的方向向量
  const dx1 = line1EndX - line1StartX;
  const dy1 = line1EndY - line1StartY;
  const dx2 = line2EndX - line2StartX;
  const dy2 = line2EndY - line2StartY;
  
  // 计算行列式（判断是否平行）
  const denominator = dy2 * dx1 - dx2 * dy1;
  
  // 平行或重合，无交点
  if (denominator === 0) {
    return { x: 0, y: 0, onLine1: false, onLine2: false };
  }
  
  // 计算参数 t1 和 t2
  const diffX = line1StartX - line2StartX;
  const diffY = line1StartY - line2StartY;
  const t1 = (dx2 * diffY - dy2 * diffX) / denominator;
  const t2 = (dx1 * diffY - dy1 * diffX) / denominator;
  
  // 计算交点坐标
  const x = line1StartX + t1 * dx1;
  const y = line1StartY + t1 * dy1;
  
  // 判断交点是否在两条线段范围内（不包括端点）
  return {
    x,
    y,
    onLine1: t1 > 0 && t1 < 1,
    onLine2: t2 > 0 && t2 < 1
  };
}
