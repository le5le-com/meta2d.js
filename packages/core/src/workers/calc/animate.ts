import { WorkerMessage } from '../../types';
import { Animation, ConnectLine, Frame, Pen, PenCategory, Rect, scaleRect, updateNodeLines } from '../../models';
import { boundaryScan, getCells, getPensInPenBoundary, updatePenCell } from './pick';
import { options, penMap, view, viewWorld } from './vars';
import { probe } from '../../perf/probe';

let animateTimer: number | null = null;
let lastAnimate = 0;

/**
 * 动画背压：同一时间只有一批 RenderAnimation 在途。render 画完回 AnimRendered（经主线程转来），
 * 收到之前的趟直接跳过（不算也不发）。原来按 rAF 节奏只管发：render 一批画得比 calc 发得慢
 * （窗口失焦后两边都慢一倍时就是这样），消息队列无界积压，十几秒后画面几乎不动（与 setValue 那次同一个模式）。
 * 跳过的趟不丢进度：节点动画按时间算插值，连线动画只是流动变慢。
 */
let animSeq = 0;
/** 在途那一批的序号；0 = 没有在途 */
let animInFlight = 0;
let animSentAt = 0;
/** 回执丢了（render 重建 / 换数据）也不能永远停下：超过这么久当作已画完 */
const AnimAckTimeout = 1000;

export function onAnimRendered(e: MessageEvent) {
  if (e.data.seq === animInFlight) {
    animInFlight = 0;
  }
}

/**
 * 判视口时在图元矩形外再放的余量（屏幕像素）：盖住描边、箭头、阴影、文字外溢这些伸出矩形的墨迹。
 * 判错的代价：放少了 ⇒ 视口边上的动画少画一帧（下一趟进了余量就画）；放多了只是少省一点。
 */
const OffViewPad = 64;

/**
 * 这一组几何（动画图元的新旧位置、跟着动的连线）是否**整个**在视口外。
 * 整个在视口外 ⇒ 这一趟不用算重绘区、也不用让 render 画（画了也全被裁掉）。
 */
function offView(pens: Pen[], extra = 0) {
  if (!viewWorld.ok || options.animViewportCull === false) {
    return false;
  }
  const v = viewWorld;
  const base = OffViewPad / (view.scale || 1) + extra;
  for (const p of pens) {
    if (p.x == undefined || p.y == undefined) {
      return false;
    }
    const w = p.width || 0;
    const h = p.height || 0;
    // 旋转后的墨迹不超出以中心为圆心、半对角线为半径的圆 ⇒ 每边再放 max(w, h) / 2 一定够
    const pad = base + (p.lineWidth || 0) + (p.rotate ? Math.max(w, h) / 2 : 0);
    if (p.x + w + pad > v.x0 && p.x - pad < v.x1 && p.y + h + pad > v.y0 && p.y - pad < v.y1) {
      return false;
    }
  }
  return true;
}

export interface Player {
  play: boolean;
  pen: Pen;
  animation?: Animation;
  currentFrame?: Frame;
  currentFrameIndex?: number;
  originalState?: Pen; // 原始状态
  initState?: Pen; // 当前帧的初始动画值
  lastState?: Pen; // 当前帧的上一个动画值
  currentState?: Pen; // 当前帧的当前动画值
  counter: number;
  lastTime: number;

  connectedLines?: ConnectLine[];
}

// 动画播放器
let players: { [penId: string]: Player } = {};

export function onStartAnimate(e: MessageEvent) {
  const { penIds, animationMap, connectedLines } = e.data;
  if (!penIds || penIds.length === 0) {
    return;
  }

  if (!animateTimer) {
    animateTimer = requestAnimationFrame(animate);
  }

  for (const id of penIds) {
    // 继续播放
    if (players[id]) {
      players[id].play = true;
      continue;
    }

    const pen = penMap.get(id);
    const animation = animationMap[pen.id];
    if (!pen || !animation) {
      continue;
    }

    players[id] = {
      play: true,
      pen: structuredClone(pen) as Pen,
      animation,
      counter: 1,
      lastTime: 0,
    };

    if (connectedLines[id]) {
      players[id].connectedLines = connectedLines[id];
    }

    if (pen.category === PenCategory.Line) {
      players[id].animation.lineAnimation.position = 0;
    } else {
      players[id].currentFrame = players[id].animation.frames[0];
      players[id].currentFrameIndex = 0;
      const initState = {} as Pen;
      for (const key in players[id].currentFrame.properties) {
        initState[key] = pen[key];
        if (key === 'scale') {
          initState[key] = 1;
        }
      }

      // 所有动画帧属性初始值
      for (const item of players[id].animation.frames) {
        for (let key in item.properties) {
          if (initState[key] === undefined) {
            if (['x', 'y'].includes(key)) {
              initState[key] = 0;
            } else if (key === 'scale') {
              initState[key] = 1;
            } else {
              initState[key] = pen[key];
            }
          }
        }
      }

      players[id].initState = initState;
      players[id].originalState = { ...initState }; // 原始状态
      players[id].currentState = { ...initState } as Pen;
      players[id].lastState = { ...initState } as Pen; // 初始化 lastState 以清除第一帧的旧位置
      players[id].lastTime = performance.now();
    }
  }
}

export function onPauseAnimate(e: MessageEvent) {
  const { penIds } = e.data;
  if (!penIds || penIds.length === 0) {
    return;
  }

  for (const id of penIds) {
    if (players[id]) {
      players[id].play = false;
    }
  }
}

export function onStopAnimate(e: MessageEvent) {
  const { penIds } = e.data;
  if (!penIds || penIds.length === 0) {
    return;
  }

  // 一次停多个图元时，每个播放器各发一条「恢复初始状态」的重画（emitAnim 趟外逐条立即发）。
  // render 逐条处理：每条都 renderPens 一遍自己的区域，400 个图元 ≈ 400 次、render 卡 ~2.5s，
  // 期间到的 Patch / 视口全排在后面（实测：停动画后立刻 setValue，2.9s 后才画出来）。
  // 和 animate() 的一趟一样攒成一批发，render 走合并绘制（drawMergedAnim）一次画完。
  const batching = !animBatch && options.animBatch !== false && penIds.length > 1;
  if (batching) {
    animBatch = [];
  }
  try {
    stopPlayers(penIds);
  } finally {
    if (batching) {
      const batch = animBatch;
      animBatch = null;
      batch.length && self.postMessage({ action: WorkerMessage.RenderAnimation, batch });
    }
  }
}

function stopPlayers(penIds: string[]) {
  for (const id of penIds) {
    const player = players[id];
    if (player?.animation?.lineAnimation) {
      // 连线动画停止：linePosition 归零并按连线区域清空重画一次，把最后一帧的动画画面擦掉。
      // render 那边 onUpdateAnimateState 不再自己重画 —— 它拿不到这条线的区域，沿用上一次的 boundary
      // 不清屏（或只清一部分）就叠画，半透明连线整条/局部变深。
      player.animation.lineAnimation.position = 0;
      updateLineProperties(player);
    } else if (player?.animation && !player.animation.keepAnimationState) {
      // 恢复到初始状态
      if (player.originalState) {
        player.currentState = { ...player.originalState };
        if (player.originalState.x !== undefined) {
          player.currentState.x = player.pen.x;
        }
        if (player.originalState.y !== undefined) {
          player.currentState.y = player.pen.y;
        }
        updateNodeProperties(player, pens);
      }
    }
    delete players[id];
  }

  if (Object.keys(players).length === 0) {
    cancalAnimation();
  }
}

/**
 * 用户在动画播放期间改了图元的几何 ⇒ 把改动并进动画的基准（动画跟着走）。
 *
 * x / y 的动画是**相对量**：start = initState[key]，end = 帧里的值 + initState[key]，
 * 而 initState 在动画开始时就定死了 ⇒ 不并进来的话，图元被拖到哪里都还围着原位跳，
 * 与主线程和控制框对不上（设计文档 D39 / 第三十七轮）。
 *
 * 做法：位移量取 update − beforeUpdate（两边都来自主线程的图元，主线程不应用动画 ⇒ 都是基准值，
 * 减出来就是用户这次的真实位移，不受图元此刻跳到哪里影响），加到动画的每一份基准上；
 * 宽高 / 旋转直接写进 player.pen（有 scale 动画时 player.pen 是缩放的基准，也因此对了）。
 */
export function rebaseAnimate(before: Pen | undefined, after: Pen) {
  const player = players[after.id];
  if (!player || !before || player.animation?.lineAnimation) {
    return;
  }
  const dx = after.x != undefined && before.x != undefined ? after.x - before.x : 0;
  const dy = after.y != undefined && before.y != undefined ? after.y - before.y : 0;
  if (dx || dy) {
    for (const s of [player.pen, player.initState, player.originalState, player.currentState, player.lastState]) {
      if (!s) {
        continue;
      }
      if (s.x != undefined) {
        s.x += dx;
      }
      if (s.y != undefined) {
        s.y += dy;
      }
    }
  }
  for (const key of ['width', 'height', 'rotate'] as const) {
    if (after[key] != undefined) {
      (player.pen as any)[key] = after[key];
    }
  }
  if (player.pen.x != undefined && player.pen.width != undefined) {
    player.pen.ex = player.pen.x + player.pen.width;
  }
  if (player.pen.y != undefined && player.pen.height != undefined) {
    player.pen.ey = player.pen.y + player.pen.height;
  }
}

/** 这个图元现在是否挂着动画播放器（播放或暂停都算 —— 两种情况下 render 都画在动画几何上） */
export function isAnimating(id: string) {
  return !!players[id];
}

/**
 * 同步正在播放的动画配置。
 *
 * 主线程修改 animations 后，calc Worker 会收到新的图元快照；播放器原先保存的是
 * startAnimate 时的动画对象，若不替换，连线动画会继续读取旧的 span。替换时保留
 * 当前 position，避免改配置导致动画跳回起点或因 position 缺失变成 NaN。
 */
export function updateAnimate(pen: Pen) {
  const player = players[pen.id];
  if (!player || !pen.animations?.length) {
    return;
  }

  const animation = pen.animations[pen.currentAnimation ?? 0];
  if (!animation || !player.animation?.lineAnimation || !animation.lineAnimation) {
    return;
  }

  const position = player.animation?.lineAnimation?.position;
  player.animation = animation;
  animation.lineAnimation.position = position ?? 0;
}

export function removeAnimate(id: string) {
  delete players[id];
  if (Object.keys(players).length === 0) {
    cancalAnimation();
  }
}

/** 换数据（open）时调用：旧图元的播放器全部作废，否则会继续为已不存在的图元发 RenderAnimation */
export function clearAnimate() {
  players = {};
  animInFlight = 0;
  cancalAnimation();
}

export function cancalAnimation() {
  if (animateTimer) {
    cancelAnimationFrame(animateTimer);
    animateTimer = null;
  }
}

const pens: Pen[] = []; // 需要更新的图元列表
/** 第 5.25 步：「动画写回原值」诊断在控制台最多打印的条数计数 */
let clobberLogged = 0;

/**
 * 一趟动画里攒下的 RenderAnimation 更新（M4 按帧合并）；null = 不在攒（逐条立即发）。
 * 只在 animate() 的一趟里开；onStopAnimate 等趟外调用仍逐条立即发。
 */
let animBatch: any[] | null = null;

/** 发一条动画更新：在攒就放进批次，否则立即 postMessage */
function emitAnim(msg: any) {
  if (animBatch) {
    // ⚠ updatedPens 是模块级、所有播放器共用的数组，处理下一个播放器前会被清空 ——
    // 原来逐条 postMessage 当场就克隆走了，攒到帧末再发就必须在这里复制一份。
    if (msg.updatedPens) {
      msg.updatedPens = msg.updatedPens.slice();
    }
    animBatch.push(msg);
    return;
  }
  self.postMessage(msg);
}
const updatedPens: Pen[] = []; // 需要更新的图元列表

/**
 * 这个 rAF 循环不经过 self.onmessage，`handle:*` 量不到它 ⇒ 单独报 `anim:loop` / `anim:players` / `anim:msgs`
 * （设计文档第十五 ~ 十六轮）。
 */
let frameMsgs = 0;

/**
 * `anim:loop` 的拆分（ms，每趟累加，出口处以 µs 发样本）：
 * - `anim:loopBoundary`：`getPensInPenBoundary`（每条消息查一次格子）
 * - `anim:loopPost`：`self.postMessage`（结构化克隆 + 探针的 postMessage 钩子）
 * - `anim:loopProbe`：`probeAnimMsg` 自己 —— **探针的开销也在 anim:loop 里**，单独报出来才能减掉
 * 剩下的 = 插值 / `updatePenCell` 等逐播放器的计算，面板用 loop 减三段得出。
 *
 * ⚠ `performance.now()` 在 worker 里只有 100µs 粒度，单次读数只会是 0 或 100；累加多次的期望无偏，
 * 但「剩余」可能被读成负数，面板会标出来。
 */
let frameBoundaryMs = 0;
let framePostMs = 0;
let frameProbeMs = 0;
/** 第 5.15 步：趟开始时 boundaryScan 的快照，趟结束时取差值（见 pick.ts 那段注释） */
const scan0 = { ...boundaryScan };

/** 每条 `RenderAnimation` 发出时记一笔，供 `animate()` 在一趟结束时汇总 */
function probeAnimMsg() {
  frameMsgs++;
}

/** 记 boundary 那一段，再把 probeAnimMsg 自己的耗时单独记下（它也落在 anim:loop 里） */
function probeAnimSplit(tB: number) {
  const tP = performance.now();
  frameBoundaryMs += tP - tB;
  probeAnimMsg();
  frameProbeMs += performance.now() - tP;
}

function animate() {
  const now = performance.now();

  // 背压：上一批 render 还没画完就不开这一趟（见 animInFlight）
  if (animInFlight && now - animSentAt < AnimAckTimeout) {
    probe.count('anim:held');
    animateTimer && (animateTimer = requestAnimationFrame(animate));
    return;
  }
  if (animInFlight) {
    probe.count('anim:ackTimeout');
    animInFlight = 0;
  }

  if (now - lastAnimate > options.animateInterval) {
    lastAnimate = now;
    const _tLoop = probe.now();
    let playerCount = 0;
    animBatch = options.animBatch === false ? null : [];
    if (probe.on) {
      frameMsgs = 0;
      frameBoundaryMs = 0;
      framePostMs = 0;
      frameProbeMs = 0;
      Object.assign(scan0, boundaryScan);
    }

    for (const penId in players) {
      if (!players[penId].play) {
        continue;
      }
      playerCount++;

      pens.length = 0;
      updatedPens.length = 0;
      const player = players[penId];

      // 连线动画
      if (player.animation.lineAnimation) {
        // 连线动画无需初始化帧
        if (player.animation.lineAnimation.position > player.pen.length) {
          ++player.counter;
          // 连线动画，属性值回到初始状态继续循环播放
          player.animation.lineAnimation.position = 0;
        } else {
          player.animation.lineAnimation.position += player.animation.lineAnimation.span ?? 5;
        }

        updateLineProperties(player);

        if (player.animation.cycle && player.counter > player.animation.cycle) {
          delete players[penId];
          if (Object.keys(players).length === 0) {
            cancalAnimation();
          }
        }

        continue;
      }

      // 图元动画
      // 动画帧到达末端
      if (now - player.lastTime > player.currentFrame.duration) {
        // 计算图元动画的下一帧属性值
        if (player.currentFrameIndex === player.animation.frames.length - 1) {
          ++player.counter;

          const initState = {} as Pen;
          //恢复到原始状态
          for (const key in player.originalState) {
            initState[key] = player.originalState[key];
            player.currentState[key] = player.originalState[key];
          }
          player.initState = initState;
        } else {
          player.initState = { ...player.currentState };
        }

        player.currentFrameIndex = (player.currentFrameIndex + 1) % player.animation.frames.length;
        player.currentFrame = player.animation.frames[player.currentFrameIndex];

        player.lastTime = now;

        // 动画播放结束
        if (player.animation.cycle && player.counter > player.animation.cycle) {
          const lastFrame = player.animation.frames[player.animation.frames.length - 1];

          // 确保最后一帧渲染到最终状态，避免残影
          if (lastFrame.transitional) {
            for (const key in lastFrame.properties) {
              if (lastFrame.transitional[key]) {
                let end = lastFrame.properties[key];
                if (key === 'x' || key === 'y') {
                  end += player.initState[key];
                }
                player.currentState[key] = end;
              } else {
                player.currentState[key] = lastFrame.properties[key];
              }
            }
          } else {
            Object.assign(player.currentState, lastFrame.properties);
          }

          if (player.animation.keepAnimationState) {
            // 计算最终状态
            const p: Pen = { id: player.pen.id };
            const keys = Object.keys(player.originalState);
            let scale = 0;
            for (const frame of player.animation.frames) {
              for (const key of keys) {
                if (key === 'x' || key === 'y') {
                  if (p[key] === undefined) {
                    p[key] = player.pen[key];
                  }
                  p[key] += frame.properties[key] ?? 0;
                } else {
                  if (frame.properties[key] !== undefined) {
                    p[key] = frame.properties[key];
                    if (key === 'scale') {
                      scale = frame.properties[key];
                    }
                  }
                }
              }
            }

            player.currentState = { ...p };
            delete player.currentState.id;

            if (scale) {
              p.x = player.currentState.x ?? player.pen.x;
              p.y = player.currentState.y ?? player.pen.y;
              p.width = player.currentState.width ?? player.pen.width;
              p.height = player.currentState.height ?? player.pen.height;
              p.ex = p.x + p.width;
              p.ey = p.y + p.height;
              if (!p.pivot) {
                p.pivot = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
              }
              scaleRect(p, player.currentState.scale, p.pivot);
            }

            updatedPens.push(p);
          } else if (player.initState) {
            // 还原到动画前状态
            for (const key in player.originalState) {
              player.currentState[key] = player.pen[key];
              if (key === 'scale') {
                player.currentState[key] = 1;
              }
            }
          }

          // 下一个动画
          if (player.animation.next) {
            self.postMessage({
              action: WorkerMessage.NextAnimation,
              idorTag: player.animation.next,
              currentAnimation: player.animation.nextAnimation ?? 0,
            });
          }

          delete players[penId];
          if (Object.keys(players).length === 0) {
            cancalAnimation();
          }

          updateNodeProperties(player, pens, updatedPens);
          continue;
        }
      }

      // 计算图元动画属性值更新到lastState
      const progress = (now - player.lastTime) / player.currentFrame.duration;

      // 过渡属性
      if (player.currentFrame.transitional) {
        for (const key in player.currentFrame.properties) {
          if (player.currentFrame.transitional[key]) {
            // 计算图元动画过渡属性值
            const start = player.initState[key];
            let end = player.currentFrame.properties[key];
            if (key === 'x' || key === 'y') {
              end += player.initState[key];
            }
            if (player.currentFrameIndex === 0) {
              // 非第一帧 存在x,y属性
              if (player.currentFrame.properties.x === undefined && player.initState.x !== undefined) {
                player.currentState.x = player.pen.x;
              }
              if (player.currentFrame.properties.y === undefined && player.initState.y !== undefined) {
                player.currentState.y = player.pen.y;
              }
            }
            player.currentState[key] = start + (end - start) * progress;
            continue;
          }

          // 非过渡属性
          player.currentState[key] = player.currentFrame.properties[key];
        }
      } else {
        // 没有过渡属性
        Object.assign(player.currentState, player.currentFrame.properties);
      }

      // 更新属性并计算重绘列表
      updateNodeProperties(player, pens);
    }

    // M4 第 1 步：整趟的更新合成一条发出
    if (animBatch) {
      const batch = animBatch;
      animBatch = null;
      if (batch.length) {
        const _tS = probe.now();
        // animSeq：render 画完按它回 AnimRendered（背压）；sentAt：render 用它量这一批排了多久（anim:lag）
        animInFlight = ++animSeq;
        animSentAt = now;
        self.postMessage({
          action: WorkerMessage.RenderAnimation,
          batch,
          animSeq: animInFlight,
          sentAt: probe.on ? Date.now() : undefined,
        });
        if (probe.on) {
          framePostMs += performance.now() - _tS;
        }
      }
    }

    if (probe.on) {
      probe.time('anim:loop', _tLoop);
      probe.sample('anim:loopBoundary', frameBoundaryMs * 1000);
      probe.sample('anim:loopPost', framePostMs * 1000);
      probe.sample('anim:loopProbe', frameProbeMs * 1000);
      // 每趟的扫描量（差值）。自检：calls 必须等于 anim:msgs（每条消息查一次）
      probe.sample('anim:bCalls', boundaryScan.calls - scan0.calls);
      probe.sample('anim:bCells', boundaryScan.cells - scan0.cells);
      probe.sample('anim:bCellItems', boundaryScan.cellItems - scan0.cellItems);
      probe.sample('anim:bRotated', boundaryScan.rotated - scan0.rotated);
      probe.sample('anim:bOverflow', boundaryScan.overflowItems - scan0.overflowItems);
      probe.sample('anim:bText', boundaryScan.textItems - scan0.textItems);
      probe.sample('anim:bHits', boundaryScan.hits - scan0.hits);
      probe.sample('anim:bTextFallback', boundaryScan.textFallback - scan0.textFallback);
      probe.sample('anim:bShadow', boundaryScan.shadowItems - scan0.shadowItems);
      probe.sample('anim:players', playerCount);
      probe.sample('anim:msgs', frameMsgs);
    }
  }

  // 必须把新 id 记回 animateTimer：原来裸调 requestAnimationFrame，cancalAnimation 只能取消最初那一帧，
  // 循环永远停不下来，之后每次 onStartAnimate 还会再叠一条循环。
  // 这一趟里若已 cancalAnimation（最后一个播放器结束）⇒ animateTimer 为 null，就此停下。
  if (animateTimer) {
    animateTimer = requestAnimationFrame(animate);
  }
}

// 根据连线动画计算重绘列表
function updateLineProperties(player: Player) {
  const changedProperties: { [penId: string]: Pen } = {};

  // 添加到重绘列表
  changedProperties[player.pen.id] = { linePosition: player.animation.lineAnimation.position };

  // 几何取 penMap 里的当前值，而不是动画开始时的克隆 player.pen：rebaseAnimate 不处理连线动画，
  // 连线被拖走后克隆还停在原位 ⇒ 重绘区按旧矩形算，render 只在新旧矩形重叠的那一段画动画（一半有一半没有）。
  let pen = penMap.get(player.pen.id) || player.pen;
  if (player.animation.lineAnimation.lineWidth > 0) {
    pen = {
      id: pen.id,
      x: pen.x,
      y: pen.y,
      width: pen.width,
      height: pen.height,
      lineWidth: player.animation.lineAnimation.lineWidth,
    };
  }
  if (player.animation.lineAnimation.shadow) {
    pen = {
      ...pen,
      shadowColor: player.animation.lineAnimation.shadowColor || player.animation.lineAnimation.color,
      shadowBlur: player.animation.lineAnimation.shadowBlur || 6,
    };
  }
  // 整条线在视口外：流动位置留在 calc（player 里），不发 —— render 只有画它时才用得着这个值，
  // 进视口后下一趟就会带上最新位置
  if (offView([pen], (pen.shadowBlur || 0) + (player.animation.lineAnimation.lineWidth || 0))) {
    probe.count('anim:culled');
    return;
  }

  // 计算图元覆盖了多少个其他图元，需要一起重绘
  const _tB = probe.now();
  const { penIds, boundary } = getPensInPenBoundary(pen);
  probe.on && probeAnimSplit(_tB);
  // 通知主线程重绘
  const _tS = probe.now();
  emitAnim({
    action: WorkerMessage.RenderAnimation,
    penIds,
    boundary,
    changedProperties,
  });
  if (probe.on) {
    framePostMs += performance.now() - _tS;
  }
}

// 根据节点动画状态更新属性并计算重绘列表
function updateNodeProperties(player: Player, pens: Pen[], updatedPens?: Pen[]) {
  const changedProperties: { [penId: string]: Pen } = {};

  // 添加到重绘列表
  changedProperties[player.pen.id] = player.currentState;

  // 没被动画的几何取 penMap 里的当前值，而不是动画**开始时**的克隆 player.pen：
  // 用户在动画期间改了尺寸 / 旋转 / 位置的话，取克隆会每帧把 calc 写回原值，
  // 而 render 照画用户改过的样子 ⇒ 重绘区与控制框算错（设计文档 D39）。
  // 例外：有 scale 动画时仍取开始时的克隆 —— 当前值本身就是上一帧缩放后的结果，
  // 拿它再缩会逐帧累乘。这一支保持原行为（用户在缩放动画期间改尺寸仍会被写回，已知局限）。
  const base: Pen = player.currentState.scale ? player.pen : penMap.get(player.pen.id) || player.pen;
  let p: Pen = {
    id: player.pen.id,
    x: player.currentState.x ?? base.x,
    y: player.currentState.y ?? base.y,
    width: player.currentState.width ?? base.width,
    height: player.currentState.height ?? base.height,
    lineWidth: player.currentState.lineWidth ?? base.lineWidth,
    rotate: player.currentState.rotate ?? base.rotate,
  };
  p.ex = p.x + p.width;
  p.ey = p.y + p.height;

  // 更新中心点
  if (Object.keys(player.currentState).filter((item) => ['x', 'y', 'width', 'height'].includes(item))) {
    p.pivot = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
    changedProperties[player.pen.id].pivot = p.pivot;
  }

  if (player.currentState.scale) {
    if (!p.pivot) {
      p.pivot = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
    }
    scaleRect(p, player.currentState.scale, p.pivot);

    changedProperties[player.pen.id] = {
      ...player.currentState,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
    };
  }

  pens.push(p);

  // 更新图元关联的连线
  if (player.connectedLines?.length) {
    const lines = updateNodeLines(penMap, p);
    if (lines?.length) {
      lines.forEach((line) => {
        changedProperties[line.id] = { anchors: line.anchors };
        const existingPen = pens.find((pen) => pen.id === line.id);
        if (existingPen) {
          Object.assign(existingPen, line);
        } else {
          pens.push(line);
        }
      });
    }
  }

  // 「有没有动画几何」必须逐个判 != undefined：写成 `x ?? y ?? … ?? false` 的话，
  // 某个值恰好是 0（顶行图元跳回 y = 0）时整个表达式为假，这一帧不擦上一帧的位置（D50）。
  const st = player.currentState;
  if (
    st.x != undefined ||
    st.y != undefined ||
    st.width != undefined ||
    st.height != undefined ||
    st.scale != undefined ||
    st.rotate != undefined
  ) {
    // 更新grid网格
    // 以网格里登记的 penMap 那个对象为准：先按它**当前（登记时）的几何**取旧格子，再把新几何写进它、
    // 用它更新网格。不能用上面新建的临时对象 p —— 拿新位置找旧格子会漏删，push 进去的也会是副本（D38）。
    const reg: Pen = penMap.get(p.id) || p;
    const oldCells = getCells(reg);

    // ⚠ 这里原来按比例重算：x: p.x + p.x * p.container.x …，而临时对象 p 上根本没有 container ⇒
    // 带 container 的图元一进这个分支就抛异常（这段从没成功跑过，没有要保留的旧行为）。
    // calc 里的 container 早在 makePen / onPatch 时就按主线程给的比例算成了**绝对矩形**，比例没留下 ⇒
    // 改为把现有的绝对矩形跟着图元平移、尺寸变了就按比例缩放，写到 penMap 那个对象上
    // （拾取 / 停靠读的是它，不是 player.pen）。
    if (reg !== p && reg.container && reg.x != undefined && reg.y != undefined) {
      const c = reg.container;
      const sx = reg.width ? p.width / reg.width : 1;
      const sy = reg.height ? p.height / reg.height : 1;
      const container: Rect = {
        x: p.x + (c.x - reg.x) * sx,
        y: p.y + (c.y - reg.y) * sy,
        ex: p.x + (c.ex - reg.x) * sx,
        ey: p.y + (c.ey - reg.y) * sy,
      };
      container.width = container.ex - container.x;
      container.height = container.ey - container.y;
      reg.container = container;
    }
    if (reg !== p) {
      // 诊断：动画本身不改宽高 / 旋转，这一行却要把它们写成与当前值不同的数 ⇒ 是在写回原值（D39 那类缺陷）。
      const cs = player.currentState;
      if (
        cs.width == undefined &&
        cs.height == undefined &&
        cs.rotate == undefined &&
        !cs.scale &&
        (reg.width !== p.width || reg.height !== p.height || (reg.rotate || 0) !== (p.rotate || 0))
      ) {
        probe.count('anim:clobber');
        if (clobberLogged < 20) {
          clobberLogged++;
          console.warn('[anim clobber] 动画把没被动画的几何写回了原值', {
            id: reg.id,
            now: { width: reg.width, height: reg.height, rotate: reg.rotate },
            writtenBack: { width: p.width, height: p.height, rotate: p.rotate },
          });
        }
      }
      Object.assign(reg, p);
    }
    updatePenCell(reg, oldCells);

    if (player.lastState) {
      p = {
        id: player.pen.id,
        // 上一帧位置（用于擦旧位置）：没被动画的几何同样取 base，否则旧位置也擦不够大
        x: player.lastState.x ?? base.x,
        y: player.lastState.y ?? base.y,
        width: player.lastState.width ?? base.width,
        height: player.lastState.height ?? base.height,
        lineWidth: player.currentState.lineWidth ?? base.lineWidth,
        rotate: player.lastState.rotate ?? base.rotate,
      };
      p.ex = p.x + p.width;
      p.ey = p.y + p.height;
      // 上一帧要带上一帧自己的中心：不带的话 getCompletePens 会补上**当前帧**的 pivot，
      // 旋转图元的旧位置就算偏了，顶角每帧漏擦一点（截图 5-1）。
      p.pivot = { x: p.x + p.width / 2, y: p.y + p.height / 2 };

      if (player.lastState.scale) {
        scaleRect(p, player.lastState.scale, p.pivot);
      }

      pens.push(p);
    }
  }

  player.lastState = { ...player.currentState };

  // 新旧位置（和跟着动的连线）整个在视口外：不算重绘区、不画，只把属性带给 render / hover
  // （cull: true）—— 它们手里的几何必须跟上，否则进视口后从旧位置擦起，留下残影
  if (offView(pens)) {
    probe.count('anim:culled');
    emitAnim({
      action: WorkerMessage.RenderAnimation,
      cull: true,
      changedProperties,
      updatedPens,
    });
    return;
  }

  // 计算图元覆盖了多少个其他图元，需要一起重绘
  const _tB = probe.now();
  const { penIds, boundary } = getPensInPenBoundary(pens);
  probe.on && probeAnimSplit(_tB);
  // 通知主线程重绘
  const _tS = probe.now();
  emitAnim({
    action: WorkerMessage.RenderAnimation,
    penIds,
    boundary,
    changedProperties,
    updatedPens,
  });
  if (probe.on) {
    framePostMs += performance.now() - _tS;
  }
}
