import {
  Animation,
  ColorType,
  Condition,
  ConditionType,
  cssToCanvasLinerGradient,
  cssToCanvasRadialGradient,
  deepClone,
  EventType,
  LineAnimationType,
  Pen,
  PenAction,
  PenActionType,
  pSBC,
  TargetType,
  BackgroundType,
} from '@meta2d/core';
import { applyPenRules } from './pen-rules';
import { upgradeScript } from './script';

const delProps = ['props','canvasLayer','zIndex'];

const convertFrames = (frames: any[], linear: boolean) => {
  return frames.map((item: any) => {
    const frame = deepClone(item);
    const duration = frame.duration;
    delete frame.duration;
    return {
      duration,
      transitional: Object.fromEntries(
        Object.keys(frame).map((key) => [
          key,
          ['x', 'y', 'width', 'height', 'rotate', 'scale', 'globalAlpha'].includes(key) ? (linear ?? true) : false,
        ]),
      ),
      properties: frame,
      timingFunction: undefined,
    };
  });
};

const convertAnimations = (newPen: Pen, pen: any) => {
  if (!pen.animations?.length) {
    if (!pen.type && pen.frames?.length) {
      newPen.animations = [
        {
          name: '动画1',
          cycle: pen.animateCycle,
          keepAnimationState: pen.keepAnimateState,
          next: pen.nextAnimate,
          animate: 'custom',
          frames: convertFrames(pen.frames, pen.linear),
        },
      ];
    } else if (pen.type && pen.lineAnimateType !== undefined) {
      newPen.animations = [
        {
          name: '动画1',
          lineAnimation: {
            type: pen.lineAnimateType,
            color: pen.animateColor,
            lineWidth: pen.animateLineWidth || pen.animateDotSize,
            span: pen.animateSpan || 1,
            lineDash: pen.animateLineDash,
            reverse: pen.animateReverse,
            markerSpacing: pen.animateInterval,
            shadow: pen.animateShadow,
            shadowColor: pen.animateShadowColor,
            shadowBlur: pen.animateShadowBlur,
          },
          cycle: pen.animateCycle,
          keepAnimationState: pen.keepAnimateState,
          next: pen.nextAnimate,
          animate: 'custom',
        },
      ];
    }
    newPen.autoPlay = pen.autoPlay;
    if (pen.autoPlay) {
      newPen.currentAnimation = 0;
    }
  } else if (pen.type) {
    newPen.animations = pen.animations.map((item: any, index: number) => {
      const animation: Animation = {
        name: item.name,
        lineAnimation: {
          color: item.animateColor,
          lineWidth: item.animateLineWidth || item.animateDotSize,
          span: item.animateSpan || 1,
          lineDash: item.animateLineDash,
          reverse: item.animateReverse,
          markerSpacing: item.animateInterval,
          shadow: item.animateShadow,
          shadowColor: item.animateShadowColor,
          shadowBlur: item.animateShadowBlur,
          count: item.lineAnimateElementCount,
        },
        cycle: pen.animateCycle,
        keepAnimationState: pen.keepAnimateState,
        next: pen.nextAnimate,
      };
      if (animation.lineAnimation) {
        if (item.lineAnimateType === 5) {
          if (item.lineAnimateTargetType === 0) {
            animation.animate = '图片';
            animation.lineAnimation.type = LineAnimationType.Image;
            animation.lineAnimation.image = pen.lineAnimateImages[index];
          } else if (item.lineAnimateTargetType === 1) {
            animation.animate = '图标';
            animation.lineAnimation.type = LineAnimationType.Icon;
            animation.lineAnimation.icon = item.lineAnimateIcon;
            animation.lineAnimation.iconFamily = pen.iconFamily;
          } else if (item.lineAnimateTargetType === 2) {
            animation.animate = '图元';
            animation.lineAnimation.type = LineAnimationType.Pen;
            animation.lineAnimation.target = item.lineAnimatePens;
            animation.lineAnimation.targetType = item.temType === 'id' ? TargetType.Pen : TargetType.Tag;
          } else if (item.lineAnimateTargetType === 3) {
            animation.animate = '代码';
            animation.lineAnimation.type = LineAnimationType.Element;
          }
          animation.lineAnimation.lineDash = item.lineAnimateDash;
          animation.lineAnimation.lineWidth = item.lineAnimateElementWidth;
        } else {
          animation.lineAnimation.type = item.lineAnimateType;
        }
      }
      if (item.autoPlay) {
        newPen.currentAnimation = index;
        newPen.autoPlay = true;
      }
      return animation;
    });
  } else {
    newPen.animations = pen.animations.filter((item: any) => item.frames?.length).map((item: any, index: number) => {
      const animation = {
        name: item.name,
        cycle: item.animateCycle,
        keepAnimationState: item.keepAnimateState,
        nextType: item.temType === 'id' ? TargetType.Pen : TargetType.Tag,
        next: item.nextAnimate,
        animate: item.animate,
        frames: convertFrames(item.frames, item.linear),
      };
      if (item.autoPlay) {
        newPen.currentAnimation = index;
        newPen.autoPlay = true;
      }
      return animation;
    });
  }
  if (pen.name === 'gif') {
    newPen.autoPlay = true;
  }
  const propsToDelete = [
    'animations',
    'animateCycle',
    'keepAnimateState',
    'nextAnimate',
    'iframes',
    'linear',
    'lineAnimateType',
    'animateAnimateType',
    'animateColor',
    'animateLineWidth',
    'animateDotSize',
    'animateSpan',
    'animateLineDash',
    'animateReverse',
    'animateInterval',
    'animateShadow',
    'animateShadowColor',
    'animateShadowBlur',
    'animateCount',
    'animatePosition',
    'autoPlay',
    'lineAnimateElementCount',
    'lineAnimateImages',
    'lineAnimateIcon',
    'lineAnimatePens',
    'lineAnimateType',
    'lineAnimateDash',
    'lineAnimateElementWidth',
    'lineAnimateElementHeight',
  ];

  propsToDelete.forEach((prop) => delete pen[prop]);
};

const convertNetworkToDatasource = (network: any): any => {
  if (!network) {
    return undefined;
  }

  // 参考 convertDatasources 的转换逻辑
  if (network.protocol === 'http') {
    return {
      name: network.name || 'HTTP',
      type: 'HTTP',
      connectConfig: {
        url: network.url,
        headers: network.headers,
        method: network.method,
        body: network.body,
        // interval: network.once ? undefined : network.interval || 1000,
      },
      enable: network.enable,
    };
  } else if (network.protocol === 'mqtt') {
    return {
      name: network.name || 'MQTT',
      type: 'MQTT',
      connectConfig: {
        topics: network.topics,
        options: network.options,
        url: network.url,
      },
      enable: network.enable,
    };
  } else if (network.protocol === 'websocket') {
    return {
      name: network.name || 'WebSocket',
      type: 'WebSocket',
      connectConfig: {
        url: network.url,
        protocols: network.protocols,
      },
      enable: network.enable,
    };
  } else if (network.protocol === 'SSE') {
    return {
      name: network.name,
      type: 'SSE',
      connectConfig: {
        url: network.url,
        withCredentials: network.withCredentials,
      },
      enable: network.enable,
    };
  }

  // 如果未识别的协议，返回原始对象
  return network;
};

const transformAction = (action: any): PenAction => {
  switch (action.action) {
    case PenActionType.Link:
      return {
        type: PenActionType.Link,
        payload: {
          value: action.value,
          params: action.params,
        },
      };
    case PenActionType.SetProps:
      return {
        type: PenActionType.SetProps,
        payload: {
          value: action.value,
        },
        target: action.params,
        targetType: action.targetType === 'tag' ? TargetType.Tag : TargetType.Pen,
      };
    case PenActionType.StartAnimate:
    case PenActionType.PauseAnimate:
    case PenActionType.StopAnimate:
      return {
        type: action.action,
        payload: {
          params: action.params,
        },
        target: action.value,
        targetType: action.targetType === 'tag' ? TargetType.Tag : TargetType.Pen,
      };
    case PenActionType.GlobalFn:
    case PenActionType.Emit:
      return {
        type: action.action,
        payload: {
          value: action.value,
          params: action.params,
        },
      };
    case PenActionType.JS:
      return {
        type: action.action,
        payload: {
          value: upgradeScript(action.value),
          params: action.params,
        },
      };
    case PenActionType.StartVideo:
    case PenActionType.PauseVideo:
    case PenActionType.StopVideo:
      return {
        type: action.action,
        target: action.value,
        targetType: action.targetType === 'tag' ? TargetType.Tag : TargetType.Pen,
      };
    case PenActionType.Navigator:
      return {
        type: PenActionType.Navigator,
        payload: {
          value: action.value,
        },
      };
    case PenActionType.Dialog:
      return {
        type: PenActionType.Dialog,
        payload: {
          params: action.params,
          value: action.value,
          mode:0,
          ...action.extend,
        },
      };
    case PenActionType.SendData:
      // 1.0: action.network (datasource), action.data (data array), action.callback
      // 2.0: payload.datasource, payload.data, payload.callback
      const datasource = action.network ? convertNetworkToDatasource(action.network) : undefined;
      return {
        type: PenActionType.SendData,
        payload: {
          datasource, // network → datasource 格式转换
          data: action.data,
          callback: upgradeScript(action.callback),
        },
      };
    case PenActionType.PostMessage:
      return {
        type: PenActionType.PostMessage,
        target: action.params,
        payload: {
          value: action.value,
          data: action.data,
        },
      };
    case PenActionType.PostMessageToParent:
      return {
        type: PenActionType.PostMessageToParent,
        payload: {
          value: action.value,
          data: action.data,
        },
      };
    case PenActionType.MessageBox:
      return {
        type: PenActionType.MessageBox,
        payload: {
          value: action.value,
          params: action.params,
        },
      };
  }
};

const transformWhere = (where: any): Condition => {
  if (where?.type === 'custom') {
    return {
      type: ConditionType.Function,
      fn: upgradeScript(where?.fnJs),
    };
  }
  return {
    type: ConditionType.Compare,
    operator: where?.comparison,
    targetType: TargetType.Pen,
    target: where?.value,
    key: where?.key,
    label: where?.key,
  };
};

const transCondition = (condition: any): Condition => {
  if (condition.type === 'fn') {
    return {
      type: ConditionType.Function,
      fn: upgradeScript(condition.fnJs),
    };
  }

  if (condition.valueType === 'prop') {
    return {
      type: ConditionType.Compare,
      operator: condition.operator,
      key: condition.key,
      label: condition.keyLabel,
      targetType: TargetType.Pen,
      target: condition.target,
      targetKey: condition.value,
      targetLabel: condition.label,
    };
  }

  return {
    type: ConditionType.Compare,
    operator: condition.operator,
    key: condition.key,
    label: condition.keyLabel,
    targetType: TargetType.Value,
    target: condition.value,
  };
};

const EventTypeMap: Record<string, EventType> = {
  enter: EventType.Enter,
  leave: EventType.Leave,
  active: EventType.Active,
  inactive: EventType.Inactive,
  click: EventType.Click,
  mousedown: EventType.Mousedown,
  mouseup: EventType.Mouseup,
  dblclick: EventType.Dblclick,
  valueUpdate: EventType.ValueUpdate,
  message: EventType.Message,
  contextmenu: EventType.Contextmenu,
  input: EventType.Input,
  change: EventType.Change,
  submit: EventType.Submit,
  reset: EventType.Reset,
};

const convertEvents = (newPen: Pen, pen: any) => {
  if (pen.events?.length) {
    const action = pen.events[0].action;
    if (action !== undefined) {
      for (let i = 0; i < pen.events.length; i++) {
        const event = pen.events[i];

        if (event.name === 'valueUpdate') {
          if (!newPen.triggers) {
            newPen.triggers = [];
          }
          const trigger = {
            name: '联动场景',
            events: [
              {
                name: '联动1',
                conditions: [transformWhere(event.where)],
                actions: [transformAction(event)],
                isAny: false,
              },
            ],
          };

          let index = -1;
          if (event.where.key) {
            index = newPen.triggers.findIndex((el: any) => el.events[0]?.conditions?.[0]?.key === event.where.key);
          }
          if (index !== -1 && newPen.triggers[index]?.events?.length) {
            const idx = newPen.triggers[index].events.findIndex(
              (el) =>
                el.conditions?.length &&
                el.conditions[0].key === event.where.key &&
                el.conditions[0].operator === event.where.comparison &&
                el.conditions[0].target === event.where.value,
            );
            if (idx !== -1) {
              newPen.triggers[index].events[idx].actions.push(trigger.events[0].actions[0]);
            } else {
              newPen.triggers[index].events.push(trigger.events[0]);
            }
          } else {
            newPen.triggers.push(trigger);
          }
        } else {
          if (!newPen.events) {
            newPen.events = [];
          }
          newPen.events.push({
            type: EventTypeMap[event.name],
            name: event.name,
            isAny: false,
            conditions: [transformWhere(event.where)],
            actions: [transformAction(event)],
          });
        }
      }
    } else {
      const events = [];
      for (let i = 0; i < pen.events.length; i++) {
        const event = pen.events[i];
        events.push({
          type: EventTypeMap[event.name],
          name: event.name,
          isAny: event.conditionType === 'any' ? true : false,
          conditions: event.conditions?.map((item: any) => {
            return transCondition(item);
          }) || [],
          actions: event.actions
            .filter((item: any) => Object.keys(item).length > 0)
            .map((item: any) => {
              return transformAction(item);
            }),
        });
      }
      newPen.events = events;
    }
  }
  delete pen.events;
};

const convertTriggers = (newPen: Pen, pen: any) => {
  if (pen.triggers?.length) {
    const triggers = [];
    for (const trigger of pen.triggers) {
      triggers.push({
        name: trigger.name,
        events: trigger.status.map((event: any) => {
          return {
            name: event.name,
            isAny: event.conditionType === 'any' ? true : false,
            conditions: event.conditions.map((item: any) => {
              return transCondition(item);
            }),
            actions: event.actions
              .filter((item: any) => Object.keys(item).length > 0)
              .map((item: any) => {
                return transformAction(item);
              }),
          };
        }),
      });
    }
    newPen.triggers = triggers;
  }
  delete pen.triggers;
};

const convertGradientColors = (newPen: Pen, pen: any) => {
  if (pen.progressGradientColors) {
    newPen.progressColors = [
      {
        type: ColorType.LinearGradient,
        gradient: cssToCanvasLinerGradient(pen.progressGradientColors),
      },
    ];
  } else {
    newPen.progressColors = [
      {
        type: ColorType.Color,
        color: pen.progressColor,
      },
    ];
  }

  if (pen.strokeType === 1) {
    newPen.lineGradient = cssToCanvasLinerGradient(pen.lineGradientColors);
  } else if (pen.strokeType === 2) {
  } else {
    newPen.color = pen.color;
  }

  if (pen.bkType === 1&&pen.name!=='text') {
    newPen.gradient = cssToCanvasLinerGradient(pen.gradientColors);
    newPen.bkType = BackgroundType.LinearGradient;
  } else if (pen.bkType === 2&&pen.name!=='text') {
    newPen.gradient = cssToCanvasRadialGradient(pen.gradientColors);
    newPen.gradient.r1 = pen.gradientRadius;
    newPen.bkType = BackgroundType.RadialGradient;
  } else {
    newPen.background = pen.background;
    newPen.bkType = BackgroundType.Color;
  }

  if (pen.textType === 1) {
    newPen.textGradient = cssToCanvasLinerGradient(pen.textGradientColors);
  } else if (pen.textType === 2) {
    newPen.textGradient = cssToCanvasRadialGradient(pen.textGradientColors);
  } else {
    newPen.textColor = pen.textColor;
  }

  delete pen.progressGradientColors;
  delete pen.progressColor;
  delete pen.lineGradientColors;
  delete pen.color;
  delete pen.strokeType;
  delete pen.bkType;
  delete pen.gradientColors;
  delete pen.gradientRadius;
  delete pen.textType;
  delete pen.textColor;
  delete pen.textGradientColors;
};

/** 将 1.0 的普通按钮和状态按钮转换为 2.0 button 图元。 */
const convertButton = (newPen: any, pen: any, isButton: boolean, oldBkType: number | undefined) => {
  if (!isButton) {
    return;
  }

  newPen.type = 'button';
  if(newPen.gradient) {
    newPen.bkType = 1;
  }

  // 状态按钮的 onGradientColors 表示选中/按下态，2.0 统一使用 mouseDownGradient。
  if (typeof pen.onGradientColors === 'string' && pen.onGradientColors) {
    const gradient = oldBkType === 2
      ? cssToCanvasRadialGradient(pen.onGradientColors)
      : cssToCanvasLinerGradient(pen.onGradientColors);
    if (gradient) {
      if (oldBkType === 2 && pen.gradientRadius !== undefined) {
        gradient.r1 = pen.gradientRadius;
      }
      newPen.mouseDownGradient = gradient;
    }
  }
  if (pen.onBackground !== undefined) {
    newPen.mouseDownBackground = pen.onBackground;
  }

  // 1.0 普通按钮通过 mouseDownValid 自动压暗默认背景，转换为 2.0 的显式按下背景。
  if (
    pen.mouseDownValid &&
    newPen.mouseDownGradient === undefined &&
    newPen.mouseDownBackground === undefined &&
    typeof newPen.background === 'string'
  ) {
    newPen.mouseDownBackground = pSBC(-0.4, newPen.background) || newPen.background;
  }

  // 1.0 的 onGradientColors、onBackground 和 mouseDownValid 已由新版按钮协议替代。
  delete pen.onGradientColors;
  delete pen.onBackground;
  delete pen.mouseDownValid;
};

const convertTablePlus = (newPen: Pen, pen: any): Set<string> => {
  // 用于收集需要删除的子图元 ID
  const childrenToDelete = new Set<string>();

  // 仅处理滚动表格
  if (!pen.swiper || !pen.styles || !Array.isArray(pen.styles)) {
    return childrenToDelete;
  }

  // 确保 columns 存在
  if (!pen.columns || !Array.isArray(pen.columns)) {
    return childrenToDelete;
  }

  // 遍历 styles，查找仅有 col 属性且包含 pens 的项
  pen.styles.forEach((style: any) => {
    // 检查是否有 col 属性且 pens 长度为 1
    if (
      style.col !== undefined &&
      style.pens &&
      Array.isArray(style.pens) &&
      style.pens.length === 1 &&
      !style.row // 确保没有 row 属性，即仅有 col
    ) {
      const colIndex = style.col;
      const penConfig = style.pens[0];

      // 在对应的 column 中添加 type 和 rect
      if (pen.columns[colIndex]) {
        pen.columns[colIndex].type = 'button';
        pen.columns[colIndex].rect = { ...penConfig };
      }

      // 从 style 中删除 pens 属性
      delete style.pens;

      // 收集需要删除的 children
      if (pen.children && Array.isArray(pen.children)) {
        pen.children.forEach((childId: string) => {
          childrenToDelete.add(childId);
        });
      }
    }
  });

  // 如果找到了符合条件的 style，删除当前 pen 的 children 属性
  if (childrenToDelete.size > 0) {
    delete pen.children;
  }

  // 处理 data 中的对象格式数据
  if (pen.data && Array.isArray(pen.data)) {
    // 用于存储每列的样式映射：colIndex -> Map<text, styleConfig>
    const columnStyleMaps: Map<number, Map<string, any>> = new Map();

    // 遍历所有行数据
    pen.data.forEach((row: any[]) => {
      if (!Array.isArray(row)) {
        return;
      }

      row.forEach((cell: any, colIndex: number) => {
        // 检查是否为对象且包含 text 属性
        if (cell && typeof cell === 'object' && cell.text !== undefined) {
          // 先删除 visible 属性
          if (cell.visible !== undefined) {
            delete cell.visible;
          }

          // 提取样式配置（排除 text 字段）
          const styleConfig: any = {};
          Object.keys(cell).forEach((key) => {
            if (key !== 'text') {
              styleConfig[key] = cell[key];
            }
          });

          // 只有当存在样式配置时才处理（不处理只有 text 的情况）
          if (Object.keys(styleConfig).length > 0) {
            const textValue = cell.text;

            // 初始化该列的样式映射
            if (!columnStyleMaps.has(colIndex)) {
              columnStyleMaps.set(colIndex, new Map());
            }

            const styleMap = columnStyleMaps.get(colIndex)!;

            // 存储该文本值对应的样式
            styleMap.set(textValue, styleConfig);

            // 将单元格替换为纯文本
            row[colIndex] = textValue;
          } else {
            // 只有 text 属性，直接替换为文本值
            row[colIndex] = cell.text;
          }
        }
      });
    });

    // 为每个包含样式映射的列生成 fnJs
    columnStyleMaps.forEach((styleMap, colIndex) => {
      if (styleMap.size > 0 && pen.columns[colIndex]) {
        // 生成 fnJs 函数代码
        let fnJsCode = '';
        const entries = Array.from(styleMap.entries());

        entries.forEach(([textValue, styleConfig], index) => {
          const condition = index === 0 ? 'if' : 'else if';
          const styleStr = JSON.stringify({ text: 'data', ...styleConfig }, null, 2)
            .replace('"text": "data"', 'text: data');

          fnJsCode += `${condition} (data === ${JSON.stringify(textValue)}) {
  return ${styleStr};
} `;
        });

        if (fnJsCode) {
          pen.columns[colIndex].fnJs = fnJsCode.trim();
        }
      }
    });
  }

  return childrenToDelete;
}

const removeUndefinedProperties = (value: any) => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  Object.keys(value).forEach((key) => {
    if (value[key] === undefined) {
      delete value[key];
    }
  });

  return value;
};

/**
 * 在基础层级排序的结果上追加父子关系约束。
 * 父图元依赖所有子图元先输出，因此采用稳定拓扑排序；候选节点始终
 * 按基础排序位置选取，尽量保持没有父子关系的图元原有顺序。
 */
const sortPensByHierarchy = (pens: any[]) => {
  const sortedPens = pens
    .map((pen: any, originalIndex: number) => ({ pen, originalIndex }))
    .sort((item1, item2) => {
      const zIndexDiff = (item1.pen.zIndex ?? (item1.pen.externElement?5:3)) - (item2.pen.zIndex ?? (item2.pen.externElement?5:3));
      if (zIndexDiff !== 0) {
        return zIndexDiff;
      }

      const canvasLayerDiff =
        (item1.pen.canvasLayer ?? 3) - (item2.pen.canvasLayer ?? 3);
      if (canvasLayerDiff !== 0) {
        return canvasLayerDiff;
      }

      // 显式使用原始下标兜底，确保相同层级的图元始终保持原有顺序。
      return item1.originalIndex - item2.originalIndex;
    });

  type SortedPen = (typeof sortedPens)[number] & { baseIndex: number };
  const items = sortedPens.map((item, baseIndex) => ({ ...item, baseIndex }));
  const itemById = new Map<any, SortedPen>();

  // 仅使用第一个同 ID 图元建立关系，避免异常重复 ID 导致排序结果不确定。
  items.forEach((item) => {
    if (
      item.pen.id !== undefined &&
      item.pen.id !== null &&
      !itemById.has(item.pen.id)
    ) {
      itemById.set(item.pen.id, item);
    }
  });

  // pendingChildren 表示仍未输出的直接子图元数量，数量归零后父图元才可输出。
  const pendingChildren = new Map<SortedPen, number>();
  const parentByChild = new Map<SortedPen, SortedPen>();
  items.forEach((item) => pendingChildren.set(item, 0));
  items.forEach((item) => {
    const parentId = item.pen.parentId;
    if (parentId === undefined || parentId === null || parentId === '') {
      return;
    }

    const parent = itemById.get(parentId);
    if (!parent) {
      // 父图元不存在时无法建立约束，保留基础排序结果。
      return;
    }

    parentByChild.set(item, parent);
    pendingChildren.set(parent, (pendingChildren.get(parent) ?? 0) + 1);
  });

  // 小顶堆按基础排序位置取出候选节点，避免父图元提前于任意后代输出。
  const available: SortedPen[] = [];
  const pushAvailable = (item: SortedPen) => {
    available.push(item);
    let index = available.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (available[parentIndex].baseIndex <= available[index].baseIndex) {
        break;
      }
      [available[parentIndex], available[index]] = [available[index], available[parentIndex]];
      index = parentIndex;
    }
  };
  const popAvailable = () => {
    const first = available[0];
    const last = available.pop();
    if (last && available.length > 0) {
      available[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (
          left < available.length &&
          available[left].baseIndex < available[smallest].baseIndex
        ) {
          smallest = left;
        }
        if (
          right < available.length &&
          available[right].baseIndex < available[smallest].baseIndex
        ) {
          smallest = right;
        }
        if (smallest === index) {
          break;
        }
        [available[index], available[smallest]] = [available[smallest], available[index]];
        index = smallest;
      }
    }
    return first;
  };

  items.forEach((item) => {
    if (pendingChildren.get(item) === 0) {
      pushAvailable(item);
    }
  });

  const orderedPens: SortedPen[] = [];
  const emitted = new Set<SortedPen>();
  while (available.length > 0) {
    const item = popAvailable();
    if (!item) {
      break;
    }
    emitted.add(item);
    orderedPens.push(item);

    const parent = parentByChild.get(item);
    if (parent) {
      const remaining = (pendingChildren.get(parent) ?? 0) - 1;
      pendingChildren.set(parent, remaining);
      if (remaining === 0) {
        pushAvailable(parent);
      }
    }
  }

  if (orderedPens.length !== items.length) {
    // 环形父子关系无法同时满足约束，按基础顺序追加未处理节点，保证不丢数据。
    items.forEach((item) => {
      if (!emitted.has(item)) {
        orderedPens.push(item);
      }
    });
  }

  return orderedPens;
};

export function convertPens(pens: any[]) {
  const sortedPens = sortPensByHierarchy(pens);

  // 用于收集所有需要删除的子图元 ID
  const allChildrenToDelete = new Set<string>();

  const newPens: any[] = [];
  sortedPens.forEach(({ pen }, index) => {
    // 保留原方法对入参数组的原地排序行为，兼容忽略返回值的调用场景。
    pens[index] = pen;
    const newPen: any = {};
    // 1.0 没有 customType 按钮标识：mouseDownValid 表示普通按钮，switch 表示状态按钮。
    const isButton = pen.mouseDownValid === true || pen.switch === true;
    const oldBkType = pen.bkType;
    convertAnimations(newPen, pen);
    convertEvents(newPen, pen);
    convertTriggers(newPen, pen);
    convertGradientColors(newPen, pen);
    applyPenRules(newPen, pen);
    convertButton(newPen, pen, isButton, oldBkType); // 按钮转换
    const childrenToDelete = convertTablePlus(newPen, pen);
    // 收集需要删除的子图元 ID
    childrenToDelete.forEach((id) => allChildrenToDelete.add(id));
    Object.assign(newPen, pen);
    removeUndefinedProperties(newPen);
    if (newPen.type === 'text') {
      delete newPen.background;
    }
    delProps.forEach((prop) => {
      delete newPen[prop];
    });

    newPens.push(newPen);
  });

  // 从 newPens 中过滤掉需要删除的子图元
  return newPens.filter((pen) => !allChildrenToDelete.has(pen.id));
}
