// @ts-ignore
import {disconnectLine, connectLine, deepClone, setLifeCycleFunc, Pen, Point, EditType, Meta2d} from "@meta2d/core";
import {ToolBox} from "./toolbox";
import {colorList, defaultFuncList, FuncOption, generateColor, pluginDefault} from "../config/default";
import {top, left, right, bottom, butterfly, sandglass} from "../layout";
import defaultColorRule from "../color/default";
import {debounce, debounceFirstOnly, deepMerge, error, isIntersection} from "../utils";

let CONFIGS = ['animate', 'animateDuration', 'childrenGap', 'levelGap', 'colorList'];
let destroyRes: any = null;
let optionMap = new Map();
declare const meta2d: Meta2d;
declare const toolbox:ToolBox;

// @ts-ignore
export let mindBoxPlugin = {
  name: 'mindBox',
  target: [],  // 已经绑定该插件的图元
  status: false,
  colorList: pluginDefault.colorList,
  childrenGap: pluginDefault.childrenGap, // 子节点间的间距
  levelGap: pluginDefault.levelGap, // 子级间的间距
  layoutFunc: new Map(), // 布局位置函数map
  colorFunc: new Map(), // 布局颜色函数map
  _history: [],
  animate: false,
  _colorRule: 'default',
  animateDuration: 1000,
  // 重新设置颜色规则
  resetColorRule(pen: Pen, rule = 'default', recursion = true) {
    mindBoxPlugin._colorRule = rule;
    mindBoxPlugin.calcChildrenColor(pen, rule, recursion);
    mindBoxPlugin.resetLinesColor(pen, true);
    mindBoxPlugin.render(pen);
  },
  // 计算子节点的颜色和位置
  calcChildrenPosAndColor(pen: any, position = pen.mind.direction || 'right', color = mindBoxPlugin._colorRule, recursion = true) {
    if (!pen) return;
    let layoutFunc = mindBoxPlugin.layoutFunc.get(position);
    let colorFunc = mindBoxPlugin.colorFunc.get(color);
    if (!layoutFunc) throw new Error('mindBoxPlugin error : The layout function does not exist');
    try {
      layoutFunc(pen, recursion);
      colorFunc(pen, recursion);
    } catch (e: any) {
      throw new Error(`mindBoxPlugin error : ${e.message}`);
    }
  },
  calcChildrenColor(pen: Pen, type = mindBoxPlugin._colorRule, recursion = true) {
    let colorFunc = mindBoxPlugin.colorFunc.get(type);
    if (!colorFunc) return;
    try {
      colorFunc(pen, recursion);
    } catch (e: any) {
      throw new Error(`mindBoxPlugin error : ${e.message}`);
    }
  },
  calcChildrenPos(pen: any, position = pen.mind.direction || 'right', recursion = true) {
    let layoutFunc = mindBoxPlugin.layoutFunc.get(position);
    if (!layoutFunc) return;
    try {
      layoutFunc(pen, recursion);
    } catch (e: any) {
      throw new Error(`[mindBoxPlugin calcChildrenPos] error : ${e.message}`);
    }
  },
  connectLine(pen: any, newPen: any, style = 'mind') {
    let from = meta2d.store.pens[newPen.mind.connect.from];
    let to = meta2d.store.pens[newPen.mind.connect.to];
    let line: any = meta2d.connectLine(from, to, newPen.mind.connect.fromAnchor, newPen.mind.connect.toAnchor, false);
    line.mind = {
      type: 'line',
      from: from.id,
      fromAnchor: newPen.mind.connect.fromAnchor,
      to: to.id,
      toAnchor: newPen.mind.connect.toAnchor,
      rootId: newPen.mind.rootId
    };
    newPen.mind.lineId = line.id;
    meta2d.setValue({
      id: line.id,
      lineWidth: (meta2d.findOne(pen.mind.rootId) as any).mind.lineWidth,
      locked: 2
    }, {render: false});
    meta2d.updateLineType(line, style);
    return line;
  },

  // 重新设置线颜色
  resetLinesColor(pen: any, recursion = true) {
    let colors = generateColor();
    let children = pen.mind.children || [];
    if (!children || children.length === 0) return;
    for (let i = 0; i < children.length; i++) {
      const child: any = meta2d.store.pens[children[i]];
      if (!child) continue;
      let line: any = child.connectedLines?.[0];
      if (line) {
        line.mind ? '' : (line.mind = {});
        if (child.mind.level > 1) {
          line.mind.color = pen.mind.lineColor || pen.mind.color || pen.calculative.color;
        } else {
          line.mind.color = pen.mind.lineColor || colors.next().value;
        }
        meta2d.setValue({
          id: line.lineId,
          color: line.mind.color
        }, {render: false});
      }
      if (recursion) {
        mindBoxPlugin.resetLinesColor(child, true);
      }
    }
  },
  // 重新递归设置连线的样式
  resetLinesStyle(pen: any, recursion = true) {
    let children = pen.mind.children || [];
    if (!children || children.length === 0) return;
    let root: any = meta2d.findOne(pen.mind.rootId);
    if (!root) return;
    for (let i = 0; i < children.length; i++) {
      const child: any = meta2d.store.pens[children[i]];
      if (!child) continue;
      child.mind.lineStyle = pen.mind.lineStyle;
      let line: any = meta2d.findOne(child.connectedLines?.[0]?.lineId);
      if (line) {
        meta2d.updateLineType(line, (meta2d.findOne(pen.mind.rootId) as any).mind.lineStyle);
        meta2d.setValue({
          id: line.id,
          lineWidth: root.mind.lineWidth
        }, {
          render: false
        });
      }
      if (recursion) {
        mindBoxPlugin.resetLinesStyle(child, true);
      }
    }
  },
  disconnectLines(pen: any, recursion = true) {
    let children = pen.mind.children || [];
    if (!children || children.length === 0) {
      return;
    }
    for (let i = 0; i < children.length; i++) {
      const child: any = meta2d.store.pens[children[i]];
      if (!child) continue;
      if (!child.connectedLines || child.connectedLines.length === 0) return;
      // 保留lineId
      let line: any = meta2d.findOne(child.connectedLines[0]?.lineId);
      if (!line) continue;
      let lineAnchor1 = line.anchors[0];
      let lineAnchor2 = line.anchors[line.anchors.length - 1];
      let from = meta2d.store.pens[child.mind.connect.from];
      let to = meta2d.store.pens[child.mind.connect.to];
      let fromAnchor = child.mind.connect.fromAnchor;
      let toAnchor = child.mind.connect.toAnchor;

      // 断开连线
      disconnectLine(from, fromAnchor, line, lineAnchor1);
      disconnectLine(to, toAnchor, line, lineAnchor2);
      if (recursion) {
        mindBoxPlugin.disconnectLines(child, true);
      }
    }
  },
  reconnectLines(pen: any, recursion = true) {
    let children = pen.mind.children || [];
    if (!children || children.length === 0) {
      return;
    }
    for (let i = 0; i < children.length; i++) {
      const child: any = meta2d.store.pens[children[i]];
      if (!child) continue;
      let line: any = meta2d.findOne(child.mind.lineId);
      if (!line) continue;
      let lineAnchor1 = line.anchors[0];
      let lineAnchor2 = line.anchors[line.anchors.length - 1];
      let from = meta2d.store.pens[child.mind.connect.from];
      let to = meta2d.store.pens[child.mind.connect.to];
      let fromAnchor = child.mind.connect.fromAnchor;
      let toAnchor = child.mind.connect.toAnchor;
      connectLine(from, fromAnchor, line, lineAnchor1);
      connectLine(to, toAnchor, line, lineAnchor2);
      meta2d.canvas.updateLines(child);
      // 设置line的层级为最低
      meta2d.bottom(line);
      if (recursion) {
        mindBoxPlugin.reconnectLines(child, true);
      }
    }
    meta2d.canvas.updateLines(pen);
  },

  /**
   * @description 根据连接关系来判断父子关系，目前在计算calcMAXWandH方法中会造成栈溢出
   * */
  collectChildNodes(pen: any, recursion = true) {
    let lines = pen.connectedLines || [];
    let children = pen.mind?.children || [];
    lines.forEach((i: any) => {
      let line: any = meta2d.store.pens[i.lineId];
      let index = line.anchors.findIndex((j: Point) => j.connectTo === pen.id);
      if (index) {
        // 被连接方，置为父级
        let preNode: any = meta2d.store.pens[line.anchors[0].connectTo];
        this.initPen(preNode, meta2d.store.pens[(meta2d.store.pens[pen.mind.preNodeId] as any).mind.preNodeId]);
        if (!preNode.children.includes(pen.id)) preNode.children.push(pen.id);
      } else {
        // 连接方
        let childNode = meta2d.store.pens[line.anchors[0].connectTo];
        if (!pen.mind.children.includes(childNode.id)) {
          pen.mind.children.push(childNode.id);
        }
      }
    });
    if (recursion) {
      children.forEach((child: any) => {
        this.collectChildNodes(child, true);
      });
    }

  },
  // 重新设置连线的位置
  resetLayOut(pen: any, pos: string | undefined, recursion = true) {
    if (!pen) return;
    if (!pos) pos = pen.mind.direction;
    // mindBoxPlugin.collectChildNodes(pen,true)
    // 断开连线
    mindBoxPlugin.disconnectLines(pen, recursion);
    // 执行布局函数
    // let layoutFunc = mindBoxPlugin.layoutFunc.get(pos)
    // layoutFunc(pen,recursion)

    // 计算子级节点位置
    mindBoxPlugin.calcChildrenPos(pen, pos, recursion);

    // 重新连线
    mindBoxPlugin.reconnectLines(pen, recursion);

    // 计算子级节点颜色  按默认颜色规则进行配置
    mindBoxPlugin.calcChildrenColor(pen, mindBoxPlugin._colorRule, recursion);
    // 重新设置连线样式
    mindBoxPlugin.resetLinesStyle(pen, recursion);
    mindBoxPlugin.resetLinesColor(pen, recursion);
    mindBoxPlugin.render(pen.mind.rootId);

    // 更新连线
  },
  /**
   * @description 删除连线
   * @param pen {Object} 图元对象
   * @param recursion {Boolean} 是否递归
   * @example
   * deleteLines(pen,true)
   */
  deleteLines(pen: any, recursion = false) {
    if (!pen) return;
    let lines: any[] = [];
    pen.connectedLines?.forEach((
      i: any
    ) => {

      let line = meta2d.findOne(i.lineId);
      if (!line) return;
      line.locked = 0;
      line && lines.push(line);
    });
    meta2d.delete(lines, false);
  },
  getLines(pen: Pen) {
    if (!pen) return;
    let lines: Pen[] = [];
    pen.connectedLines?.forEach((
      i: any
    ) => {
      let line = meta2d.findOne(i.lineId);
      if (!line) return;
      line.locked = 0;
      line && lines.push(line);
    });
    return lines;
  },

  // 删除node下的子节点
  async deleteChildrenNode(pen: any) {
    // 删除与之相关的线
    let lines = mindBoxPlugin.getLines(pen);
    // 查找到对应的父级，删除其在父级中的子级列表数据
    let parent: any = meta2d.findOne(pen.mind.preNodeId);
    parent && (pen.mind.preNodeChildren = deepClone(parent.mind.children));
    parent && parent.mind.children.splice(parent.mind.children.indexOf(pen.id), 1);
    await meta2d.delete(pen.mind?.children.map((i: any) => meta2d.store.pens[i]).filter(Boolean).concat(lines) || [], true, false);
  },
  getChildrenList(pen: any, recursion = true) {
    if (pen || !pen.mind) return [];
    let childrenId = pen.mind.children;
    if (!childrenId || childrenId.length === 0) return [];
    let collect: Pen[] = [];
    childrenId.forEach((i: any) => {
      let child = meta2d.store.pens[i];
      if (!child) return;
      collect.push(child);

      if (recursion) collect.concat(mindBoxPlugin.getChildrenList(child));
    });
    return collect;
  },
  // 初始化pen
  initPen(pen: any, prePen: any) {
    if (pen.mind) return;
    let rootId = prePen ? prePen.mind.rootId : pen.id;
    let preNodeId = prePen ? prePen.id : '';
    let direction = prePen ? prePen.mind.direction : '';
    let lineStyle = prePen ? prePen.mind.lineStyle : 'mind';
    let level = prePen ? 0 : prePen.mind.level + 1;
    if (pen.mind) return;
    pen.disableRotate = true;
    pen.mind = {
      type: 'node',
      isRoot: false,
      rootId: rootId,
      preNodeId: preNodeId,
      children: [],
      width: undefined,
      height: undefined,
      maxHeight: 0, // 包含了自己和子节点的最大高度
      maxWidth: 0,// 包含了自己和子节点的最大宽度
      direction: direction,
      childrenVisible: true,
      visible: true,
      lineStyle: lineStyle,
      lineColor: '',
      level,
    };
    // 跟随移动
    mindBoxPlugin.combineToolBox(pen);
    mindBoxPlugin.combineLifeCircle(pen);
  },
  install: (() => {
    // 是否是第一次安装，第一次安装则进行初始化
    let isInit = false;
    let addCallback: any = null;
    return (pen: any, options: FuncOption) => {
      if (!isInit) {
        // TODO 进行撤销重做的重写操作
        document.addEventListener('keydown', async (e) => {
          if (!meta2d.store.options.keydown) return;
          if (e.key === 'Backspace') {
            let stopPropagation = false;
            //判断是否有脑图组件
            let collection: any = meta2d.store.active;
            meta2d.store.active?.forEach((pen: any) => {
              if (pen.mind) {
                stopPropagation = true;
                let lines = pen.connectedLines?.map((i: any) => meta2d.findOne(i.LineId));
                collection.concat(lines);
              }
            });
            if (!stopPropagation) return;
            let initPens = deepClone(meta2d.store.data.pens.map((pen: any) => {
                pen.calculative.active = undefined;
                return pen;
              }
            ), true);
            await meta2d.delete(collection, false, false);
            let newPens = deepClone(meta2d.store.data.pens.map((pen: any) => {
                pen.calculative.active = undefined;
                return pen;
              }
            ), true);
            // @ts-ignore
            meta2d.pushHistory({type: 3, pens: newPens, initPens});
            // 阻止触发meta2d的删除行为
            stopPropagation ?
              e.stopPropagation()
              :
              '';
          }
        }, true);
        // 初始化布局函数
        mindBoxPlugin.layoutFunc.set('right', right);
        mindBoxPlugin.layoutFunc.set('left', left);
        mindBoxPlugin.layoutFunc.set('top', top);
        mindBoxPlugin.layoutFunc.set('bottom', bottom);
        mindBoxPlugin.layoutFunc.set('butterfly', butterfly);
        mindBoxPlugin.layoutFunc.set('sandglass', sandglass);


        // 设置颜色生成函数
        mindBoxPlugin.colorFunc.set('default', defaultColorRule);
        meta2d.on('opened', () => {
          let pens = meta2d.store.data.pens;
          pens.forEach((pen: any) => {
            let t: Pen = meta2d.findOne(pen.mind?.rootId) || {};
            let isAdd = isIntersection(mindBoxPlugin.target,pen.tags) || mindBoxPlugin.target.includes(t.name) || pen.mind;
            if (isAdd && (pen.mind.type === 'node')) {
              meta2d.emit('plugin:mindBox:open', pen);
              mindBoxPlugin.combineToolBox(pen);
              mindBoxPlugin.combineLifeCircle(pen);
            }
          });
        });
        meta2d.on('scale', () => {
          if (toolbox.open) toolbox.translateWithPen();
        });

        meta2d.on('undo', (e: any) => {
          let {initPens} = e;
          let tag = false;
          let target: any = null;
          if (e.type === 3) {
            initPens?.forEach((pen: any) => {
              pen.calculative.active = false;
              if (!tag) {
                if (pen.mind?.rootId) {
                  tag = true;
                  target = pen;
                }
              }
            });
            if (tag) {
              let root = meta2d.findOne(target.mind.rootId);
              mindBoxPlugin.reconnectLines(root);
            }
          }
        });
        meta2d.on('inactive', () => {
          toolbox?.hide();
        });
        isInit = true;
      }
      let target = null;
      let isTag = false;
      if (pen.name) {
        target = pen.name;
      } else if (pen.tag) {
        isTag = true;
        target = pen.tag;
      } else if (pen.pen) {
        target = pen.pen;
      }
      let toolbox: any = (window as any).toolbox;
      if (!toolbox) {
        // @ts-ignore
        toolbox = new ToolBox(meta2d.canvas.externalElements.parentElement, options);
        (window as any).toolbox = toolbox;
      }
      // 当前图元已经绑定了此插件后，不做任何处理。
      if (mindBoxPlugin.target.includes(target)) return;
      optionMap.set(target, deepClone(options || {}));
      // 若为Pen则输入id
      mindBoxPlugin.target.push(target.id ? target.id : target);
      if (typeof target === 'object') {
        let pen = target;
        mindBoxPlugin.combineToolBox(pen);
        mindBoxPlugin.combineLifeCircle(pen);
        meta2d.emit('plugin:mindBox:open', pen);
        mindBoxPlugin.record(pen.id);
        meta2d.render();
        return;

      } else {
        if (typeof addCallback === "function") {
          meta2d.off('add', addCallback);
        }
        addCallback = (pens: any) => {
          // TODO 目前只处理了添加一个图元的情况，对于批量添加，还未处理
          // TODO 此处还未考虑name与tag相等的情况
          let isAdd = isIntersection(mindBoxPlugin.target, pens[0].tags) || mindBoxPlugin.target.includes(pens[0].name);
          // 是否为根节点
          if (isAdd && pens && pens.length === 1 && !pens[0].mind) {
            let pen = pens[0];
            pen.disableAnchor = true;
            pen.disableRotate = true;
            pen.mind = {
              isRoot: true,
              type: 'node',
              preNodeId: null,
              rootId: pen.id,
              children: [],
              width: 0,
              height: 0,
              maxWidth: 0, // 包含了自己和子节点的最大宽度
              maxHeight: 0, // 包含了自己和子节点的最大高度
              direction: 'right',
              lineStyle: 'mind',
              lineColor: '',
              childrenVisible: true,
              visible: true,
              lineWidth: 2,
              level: 0,
            };
            // 在根节点上新增
            pen.mind.mindboxOption = optionMap.get(isIntersection(mindBoxPlugin.target,pen.tags,true )?.[0])|| optionMap.get(pens[0].name);
            mindBoxPlugin.combineToolBox(pen);
            mindBoxPlugin.combineLifeCircle(pen);
            meta2d.emit('plugin:mindBox:addRoot', pen);
            mindBoxPlugin.record(pen.id);
            meta2d.render();
          }
        };
        meta2d.on('add', addCallback);
        // 添加根节点
      }
    };
  })(),
  // 卸载插件
  uninstall(pen: any, options: FuncOption) {
    let target: string = '';
    let isTag = false;
    if (pen.name) {
      target = pen.name;
    } else if (pen.tag) {
      isTag = true;
      target = pen.tag;
    } else if (pen.pen) {
      target = pen.pen.id;
    }
    else if(pen.id){
      target = pen.id;
    }else  {
      return error('mindBox','uninstall parma error');
    }
    if (mindBoxPlugin.target.includes(pen.tag) || mindBoxPlugin.target.includes(pen.name) || mindBoxPlugin.target.includes(pen.id) || mindBoxPlugin.target.includes(pen.pen.id)) {
      if (typeof target === "string") {
        // 不能只清理当前pen上的内容，还应当清理所有的内容
        let pens = meta2d.store.data.pens.filter((pen: any) => pen.tags.includes(target) || pen.name === target);
        pens.forEach((i: any) => {
          if (i.mind) this.unCombineToolBox(i);
        });
      } else {
        this.unCombineToolBox(target);
      }
      mindBoxPlugin.target.splice(mindBoxPlugin.target.indexOf(target), 1);
    }

  },

  unCombineToolBox(pen: any) {
    if (!pen.mind.children) return;
    this.combineToolBox(pen, true);
    pen.mind.children.forEach((i: any) => {
      let child = meta2d.store.pens[i];
      this.unCombineToolBox(child);
    });
  },

  funcList: defaultFuncList,
  setFuncList(funcList: any[]) {
    if (Object.prototype.toString.call(funcList) !== '[object Object]') {
      throw new Error(`The setFuncList function must take function arguments, get ${funcList}\n`);
    }
    this.funcList = funcList;
  },
  calcChildWandH(pen: any) {
    if (!pen || !pen.mind) return {
      maxHeight: 0,
      childHeight: 0,
      childWidth: 0,
      maxWidth: 0
    };
    let position = pen.mind.direction;
    let children = pen.mind.children || [];
    let worldRect = meta2d.getPenRect(pen);
    if (children.length === 0 || !pen.mind.childrenVisible) {
      pen.mind.maxHeight = pen.mind.height ?? worldRect.height;
      pen.mind.maxWidth = pen.mind.width ?? worldRect.width;
      return {
        maxHeight: pen.mind.maxHeight,
        maxWidth: pen.mind.maxWidth,
        childHeight: 0,
        childWidth: 0
      };
    }
    let maxHeight = 0;
    let maxWidth = 0;
    let maxH = 0;
    let maxW = 0;
    if (position === 'right' || position === 'left' || position === 'butterfly') {
      for (let i = 0; i < children.length; i++) {
        let child = meta2d.store.pens[children[i]];
        let maxObj = mindBoxPlugin.calcChildWandH(child, position);
        maxHeight += maxObj.maxHeight;
        maxWidth = maxWidth > maxObj.maxWidth ? maxWidth : maxObj.maxWidth;
      }
      maxHeight += +mindBoxPlugin.childrenGap * (children.length - 1);
      maxH = maxHeight > worldRect.height ? maxHeight : worldRect.height;
      pen.mind.maxWidth = maxWidth;
      pen.mind.maxHeight = maxH;
      pen.mind.childHeight = maxHeight;
      pen.mind.childWidth = maxWidth;
      return {
        maxHeight: maxH,
        maxWidth,
        childHeight: maxHeight,
        childWidth: maxWidth
      };
    } else {
      for (let i = 0; i < children.length; i++) {
        let child = meta2d.store.pens[children[i]];
        let maxObj = mindBoxPlugin.calcChildWandH(child, position);
        maxWidth += maxObj.maxWidth;
        maxHeight = maxHeight > maxObj.maxHeight ? maxHeight : maxObj.maxHeight;
      }
      maxWidth += +mindBoxPlugin.childrenGap * (children.length - 1);
      maxW = maxWidth > worldRect.width ? maxWidth : worldRect.width;
      pen.mind.maxHeight = maxHeight;
      pen.mind.maxWidth = maxW;
      pen.mind.childWidth = maxWidth;
      return {
        maxHeight,
        maxWidth: maxW,
        childWidth: maxWidth,
        childHeight: maxHeight
      };
    }
  },
  /**
   * @description 自定义获取功能列表函数  返回值为最终展示的列表
   * @param pen 当前pen图元*/
  getFuncList(pen: any) {
    return pen.mind.isRoot ? mindBoxPlugin.funcList['root'] : mindBoxPlugin.funcList['leaf'];
  },

  /**
   * @description 动态添加方法函数
   * @param tag 添加到目标种类上
   * @param func 方法函数
   * @param pos 插入的目标位置
   * */
  appendFuncList(tag: string, func: any, pos: number) {
    if (typeof tag !== "string" || typeof func !== "object") {
      throw new Error('appendFuncList error: appendFuncList parma error ');
    }
    let funcList = this.funcList[tag];
    if (Object.prototype.toString.call(funcList) === '[object Array]') {
      if (pos == null) {
        funcList.push(func);
      } else {
        funcList.splice(pos, 0, func);
      }
    } else {
      throw new Error('appendFuncList error: no such tag');
    }
  },
  __debounceFirstOnly: (debounceFirstOnly(() => {
    destroyRes = new Promise(resolve => {
      resolve(deepClone(meta2d.store.data.pens.filter((pen: any) => pen.mind), true));
    });
  }, 1000)),
  __debouncePushHistory: (debounce(() => {
    destroyRes.then((res: any) => {
      let newPens = deepClone(meta2d.store.data.pens.filter((pen: any) => pen.mind), true);
      // @ts-ignore
      meta2d.pushHistory({type: 3, pens: newPens, initPens: res});
    });

  }, 2000)),
  //
  combineLifeCircle(target: Pen, del = false) {
    const onDestroy = (targetPen: any) => {
      toolbox?.hide();
      mindBoxPlugin.deleteChildrenNode(targetPen);

      this.__debounceFirstOnly();
      // @ts-ignore
      this.__debouncePushHistory();

      // mindBoxPlugin.deleteNodeOnlyOnce(targetPen);
      // if(targetPen.mind.isRoot){
      //     let index = meta2dPluginManager.rootIds.indexOf(targetPen.id)
      //     if(index === -1)return
      //     meta2dPluginManager.rootIds.splice(index,1)
      // }
      mindBoxPlugin.update(meta2d.store.pens[targetPen.mind.rootId]);
    };
    // const onBeforeDestroy = (pen)=>{
    //     if(pen.mind.isRoot)return
    //    let parent = meta2d.store.pens[pen.mind.preNodeId]
    //     parent.mind.children.splice(parent.mind.children.indexOf(pen.id),1);
    // }
    const onAdd = (targetPen: any) => {
      if (!meta2d.store.data.locked) {
        toolbox.bindPen(targetPen);
        toolbox.setFuncList(deepClone(this.getFuncList(target)));
        toolbox.translateWithPen(targetPen);
        toolbox.show();
      }
    };
    const onResize = debounce((pen: any) => {
      mindBoxPlugin.record(pen.mind.rootId);
    }, 500);
    // setLifeCycleFunc(target,'onDestroy',onDestroy,del);
    setLifeCycleFunc(target, 'onAdd', onAdd, del);
    setLifeCycleFunc(target, 'onDestroy', onDestroy, del);
    setLifeCycleFunc(target, 'onResize', onResize);
  },
  deleteNodeOnlyOnce: debounceFirstOnly(async (pen: any) => {
    let children = mindBoxPlugin.getChildrenList(pen);
    if (!children || children.length === 0) return;
    await meta2d.delete(children, true, false);
  }, 1000),
  combineToolBox(target: any, del = false) {
    let option = (meta2d.store.pens[target.mind.rootId] as any).mind.mindboxOption;
    let showTrigger = option.trigger?.show || 'onMouseUp';
    let hideTrigger = option.trigger?.hide || 'onMouseDown';

    let toolbox = (window as any).toolbox;
    let onMouseUp = (targetPen: any) => {
      if (!meta2d.store.data.locked) {
        let root: any = meta2d.findOne(targetPen.mind?.rootId);
        let op = optionMap.get(isIntersection(mindBoxPlugin.target,root.tags,true)?.[0]) || optionMap.get(root.name) || optionMap.get(root.id);
        mindBoxPlugin.loadOptions(op);
        meta2d.emit('plugin:mindBox:loadOption', {pen: targetPen, options: op});
        if (toolbox) {
          toolbox._loadOptions(op);
        }
        toolbox.bindPen(targetPen);
        toolbox.setFuncList(deepClone(this.getFuncList(target)));
        toolbox.translateWithPen(targetPen);
        toolbox.show();
      }
    };
    let onMouseDown = () => {
      toolbox.hide();
    };
    // 保存方法的引用
    if (del) {
      onMouseUp = target.mind.onMouseUp;
      onMouseDown = target.mind.onMouseDown;
    } else {
      target.mind.onMouseUp = onMouseUp;
      target.mind.onMouseDown = onMouseDown;
    }        // setLifeCycleFunc(target,'onMove',onMove,del);
    setLifeCycleFunc(target, showTrigger, onMouseUp, del);
    setLifeCycleFunc(target, hideTrigger, onMouseDown, del);

    if (del) {
      target.mind.onMouseUp = null;
      target.mind.onMouseDown = null;
    }
  },

  // setDirection(pen,direction){
  //   return pen.mind?.direction? pen.mind.direction = direction:((pen.mind = {}) && (pen.mind.direction = direction));
  // },

  // 增加节点  同级设level为true
  /**
   * @description 添加节点
   * @param pen 添加节点的目标节点
   * @param position 添加节点的位置 默认为追加*/
  async addNode(pen: any, position = 0, type = "mindNode2", option: any = {}) {
    let opt = {
      name: type,
      disableAnchor: true,
      disableRotate: true,
      mind: {
        type: 'node',
        isRoot: false,
        rootId: pen.mind.rootId,
        preNodeId: pen.id,
        children: [],
        width: undefined,
        height: undefined,
        maxHeight: 0, // 包含了自己和子节点的最大高度
        maxWidth: 0,// 包含了自己和子节点的最大宽度
        direction: pen.mind.direction,
        childrenVisible: true,
        visible: true,
        lineStyle: pen.mind.lineStyle || '',
        lineColor: '',
        level: pen.mind.level + 1,
      },
      calculative: {
        x: pen.x,
        y: pen.y,
      },
      x: pen.x,
      y: pen.y,
      width: pen.width,
      height: pen.height,
      text: '分支主题',
      // color:generateColor((pen.mind.children[pen.mind.children.length-1])?.calculative.color),
      textColor: '#000',
      lineWidth: 3,
      fontSize: 14,
      borderRadius: pen.borderRadius,
    };
    let scale = pen.calculative.canvas.store.data.scale;
    option.width && (option.width *= scale);
    option.height && (option.height *= scale);

    opt = deepMerge(opt, option);
    let initPens = deepClone(meta2d.store.data.pens.filter((pen: any) => pen.mind).map((i: any) => {
      i.calculative.active = false;
      return i;
    }), true);
    let newPen: any = await meta2d.addPen(opt, false);

    // 设置连接关系
    newPen.mind.connect = pen.mind.level === 0 ?
      mindBoxPlugin.layoutFunc.get(pen.mind.direction).connectRule(pen, newPen)
      : pen.mind.connect;
    meta2d.emit('plugin:mindBox:addNode', {plugin: 'toolBox', pen, newPen});
    // 添加节点
    if (position) {
      pen.mind.children.splice(position, 0, newPen.id);
    } else {
      pen.mind.children.push(newPen.id);
    }
    mindBoxPlugin.combineToolBox(newPen); // 重写生命周期
    mindBoxPlugin.combineLifeCircle(newPen);
    let rootNode: any = meta2d.findOne(pen.mind.rootId);

    //TODO 这里似乎性能不太好 待优化
    mindBoxPlugin.record(pen.mind.rootId);
    // 连线
    mindBoxPlugin.calcChildrenPos(pen, pen.mind.direction, true);
    let line = mindBoxPlugin.connectLine(pen, newPen, {position: pen.mind.direction, style: rootNode.mind.lineStyle});
    mindBoxPlugin.resetLayOut(rootNode);
    // mindBoxPlugin.resetLayOut(rootNode)
    // 从根节点更新
    // mindBoxPlugin.update(rootNode,true);
    if (mindBoxPlugin.animate) {
      setTimeout(() => {
        toolbox.bindPen(newPen);
        toolbox.setFuncList(deepClone(this.getFuncList(newPen)));
        toolbox.translateWithPen(newPen);
      }, mindBoxPlugin.animateDuration + 100);

    } else {
      toolbox.bindPen(newPen);
      toolbox.setFuncList(deepClone(this.getFuncList(newPen)));
      toolbox.translateWithPen(newPen);
    }
    // TODO 此处是否应当局部替换
    let newPens = deepClone(meta2d.store.data.pens.filter((pen: any) => pen.mind).map((i: any) => {
      i.calculative.active = false;
      return i;
    }), true);
    // @ts-ignore
    meta2d.pushHistory({type: 3, pens: newPens, initPens});

    return newPen;
  },
  update: debounce((pen: any, recursion = true) => {
    if (!pen) return;
    mindBoxPlugin.record(pen);
    mindBoxPlugin.resetLayOut(pen, pen.mind.direction, recursion);
    meta2d.emit('plugin:mindBox:update', {form: 'toolBox'});
  }, 50),

  // root 为根节点id
  render(root: string) {
    if (mindBoxPlugin.animate) {
      let pens = [];
      if (root) {
        pens = meta2d.store.data.pens.filter((i: any) => i.mind?.rootId === root && i.mind.type === 'node');
      } else {
        pens = meta2d.store.data.pens.filter((i: any) => i.mind && i.mind.type === 'node');
      }
      let scale = meta2d.store.data.scale;
      pens.forEach((pen: any) => {
        let source = deepClone(meta2d.getPenRect(pen));

        let origin = meta2d.store.data.origin;

        let x = source.x - pen.mind.oldWorldRect.x;
        let y = source.y - pen.mind.oldWorldRect.y;


        pen.calculative.worldRect.x = pen.mind.oldWorldRect.x * scale + origin.x;
        pen.calculative.worldRect.y = pen.mind.oldWorldRect.y * scale + origin.y;

        pen.calculative.worldRect.ex = pen.calculative.worldRect.x + pen.mind.oldWorldRect.width * scale;
        pen.calculative.worldRect.ey = pen.calculative.worldRect.y + pen.mind.oldWorldRect.height * scale;

        pen.animateCycle = 1;
        pen.keepAnimateState = true;
        pen.frames = [{
          duration: mindBoxPlugin.animateDuration,  // 帧时长
          x: x,
          y: y, // 变化属性,
        }];
        pen.showDuration = meta2d.calcAnimateDuration(pen);
        //
      });
      meta2d.startAnimate(pens);
      mindBoxPlugin.record(root);
    } else {
      meta2d.render();
    }
    meta2d.emit('plugin:mindBox:render');
  },

  /**
   * @description 该方法用于记录节点位置坐标信息，用于动画过渡的初始状态
   * @param {string} root 根节点的id值*/
  record(root: string) {
    let pens = [];
    if (root) pens = meta2d.store.data.pens.filter((i: any) => i.mind?.rootId === root && i.mind.type === 'node');
    else pens = meta2d.store.data.pens.filter((i: any) => i.mind && i.mind.type === 'node');
    pens.forEach((i: any) => {
      i.mind.oldWorldRect = deepClone(meta2d.getPenRect(i));
    });
  },

  //  TODO 逻辑重写
  loadOptions(options: any) {
    //加载系统自带的配置项
    for (const optionsKey of Object.keys(pluginDefault)) {
      // @ts-ignore
      this[optionsKey] = pluginDefault[optionsKey];
    }
    // 加载特定的配置并作相关处理
    if (!options.funcList) {
      this.setFuncList(defaultFuncList);
    }
    for (let option in options) {
      if (option === 'funcList') {
        this.setFuncList(deepClone(options.funcList));
        continue;
      }
      if (option === 'getFuncList') {
        this.getFuncList = options[option];
        continue;
      }
      if (CONFIGS.includes(option)) {
        // @ts-ignore
        this[option] = options[option];
      }
    }
  }
};

