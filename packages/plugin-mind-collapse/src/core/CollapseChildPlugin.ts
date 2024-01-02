import {CollapseButton} from "../dom";
import {deepClone, Meta2d, Pen, setLifeCycleFunc} from '@meta2d/core';
import {error, isCollapsePen} from "../utils";
import {FuncOption, isIntersection, ToolBox} from "@meta2d/plugin-mind-core";

export interface MyPen extends Pen {
  mind?: any;
}
declare const toolbox:ToolBox;
declare const meta2d: Meta2d;
let CONFIGS = {
  'style': 'setStyle',
  'collapseIcon': 'setCollapseIcon',
  'extendIcon': 'setExtendIcon'
};
// 重做后元素被移除，深拷贝报错
let addCallback = null;
export let _toolBoxPlugin = null;
export let collapseChildPlugin = {
  name: 'collapse',
  status: false,
  target: [],
  ctx: null,
  // 安装插件
  install: (() => {
    let isInit = false;
    let optionMap = new Map();

    return (pen, options) => {
      if (!isInit) {
        // 获取mindBox插件对象
        if (!_toolBoxPlugin) {
          _toolBoxPlugin = Array.from(meta2d.penPluginMap.keys()).find(i => i.name === 'mindBox');
        }
        if (!_toolBoxPlugin) {
          error('not find plugin-mind-core Plugin');
          return;
        }

        meta2d.on('undo', (e) => {
          let {initPens} = e;
          initPens?.forEach(aPen => {
            let pen:MyPen = meta2d.findOne(aPen.id);
            if (isCollapsePen(pen)) {
              collapseChildPlugin.init(pen);
              collapseChildPlugin.loadOptions(pen);
              _toolBoxPlugin.update(meta2d.findOne(pen.mind.rootId));
            }
            pen.calculative.canvas = meta2d.canvas;
          });
        });

        meta2d.on('redo', (e) => {
          let {pens} = e;
          pens?.forEach(aPen => {
            let pen:MyPen = meta2d.findOne(aPen.id);
            if (isCollapsePen(pen)) {
              collapseChildPlugin.init(pen);
              collapseChildPlugin.loadOptions(pen);
              _toolBoxPlugin.update(meta2d.findOne(pen.mind.rootId));
            }
            pen.calculative.canvas = meta2d.canvas;
          });
        });
        // 打开图纸时触发
        meta2d.on('plugin:mindBox:open', (pen) => {
          // TODO 打开图纸还未处理 -> 未处理对指定图元的
          let t:MyPen = meta2d.findOne(pen.mind.rootId);
          if (collapseChildPlugin.target.includes(t.name) || isIntersection(collapseChildPlugin.target,t.tags) || pen.mind.collapse && pen.mind.type === 'node') {
            collapseChildPlugin.init(pen);
          }
        });
        // 添加脑图梗节点
        meta2d.on('plugin:mindBox:addRoot', (pen) => {
          if (isCollapsePen(pen)) {
            collapseChildPlugin.init(pen);
            pen.mind.collapse.config = optionMap.get(pen.tag) || optionMap.get(pen.name);
          }
          // 将配置写入根图元
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
        target = pen;
      } else {
        return;
      }
      if (typeof target === 'object') {
        if (collapseChildPlugin.target.includes(target.id)) return;
        collapseChildPlugin.target.push(target.id);
      } else {
        if (collapseChildPlugin.target.includes(target)) return;
        collapseChildPlugin.target.push(target);
      }
      optionMap.set(target, deepClone(options || {}));
      if (addCallback) {
        meta2d.off('plugin:mindBox:addNode', addCallback);
      }
      // 绑定为图元
      if (typeof target === 'object' && target.mind) {
        collapseChildPlugin.init(target);
      } else {
        // 绑定为tag或者name
        addCallback = (data) => {
          let {pen, newPen} = data;
          // pen.mind.mindboxOption = optionMap.get(.tag || pens[0].name);
          if (isCollapsePen(newPen)) {
            if (pen.mind.children.length >= 1 && pen.mind.childrenVisible === false) {
              collapseChildPlugin.extend(pen);
            }
            collapseChildPlugin.init(newPen);
            collapseChildPlugin.loadOptions(newPen);
          }
        };
        addCallback && meta2d.on('plugin:mindBox:addNode', addCallback);
      }
    };
  })(),

  // 插件卸载执行函数
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
      return error('uninstall parma error');
    }
    if (collapseChildPlugin.target.includes(target)) {
      if (typeof target === "string") {
        // 不能只清理当前pen上的内容，还应当清理所有的内容
        let pens = meta2d.store.data.pens.filter((pen: any) =>{
          let root = meta2d.findOne(pen.mind?.rootId);
          if (!root)return false;
          return root.tags?.includes(target) || root.name === target || root.id === target;
        });
        pens.forEach((i: any) => {
          if (i.mind.collapse)this.unCombine(i);
        });
      }
      collapseChildPlugin.target.splice(collapseChildPlugin.target.indexOf(target), 1);
    }
  },
  unCombine(pen:MyPen){
    if(pen.mind.collapse){
      collapseChildPlugin.combineLifeCycle(pen,true);
      delete pen.mind.collapse;
      pen.mind.singleton.collapseButton
      && pen.mind.singleton.collapseButton.destroy();
    }
  },
  init(pen, config = {}) {
    pen.mind.collapse ? '' : (pen.mind.collapse = {});
    if(!pen.mind.singleton){
      pen.mind.singleton = {};
    }
    pen.mind.singleton.collapseButton = new CollapseButton(meta2d.canvas.externalElements.parentElement, {});
    pen.mind.childrenVisible = pen.mind.childrenVisible || true;
    pen.mind.allChildrenCount = pen.mind.allChildrenCount || 0;
    pen.mind.singleton.collapseButton.bindPen(pen.id);
    pen.mind.singleton.collapseButton.translatePosition(pen);
    collapseChildPlugin.combineLifeCycle(pen);
    pen.mind.singleton.collapseButton.hide();
  },
  __loadDefault(pen) {

  },
  loadOptions(pen) {
    if (isCollapsePen(pen)) {
      let root:MyPen = meta2d.findOne(pen.mind.rootId);
      let options = root.mind.collapse.config;
      if (typeof options !== 'object') return;
      this.__loadDefault();
      Object.keys(options).forEach(key => {
        if (key in CONFIGS) {
          if ((key === 'collapseIcon' && pen.mind.singleton.collapseButton.collapseIcon) || (key === 'extendIcon' && pen.mind.singleton.collapseButton.extendIcon)) return;
          pen.mind.singleton.collapseButton[CONFIGS[key]](options[key]);
        }
      });
    }
  },
  // 监听生命周期
  combineLifeCycle(target,del = false) {
    let onMouseLeave = null;
    let onMouseEnter = null;
    let onMouseUp = null;
    let onDestroy = null;
    let moveDebounce = null;
    if(del){
      onMouseEnter = target.mind.collapse.onMouseEnter;
      onMouseLeave = target.mind.collapse.onMouseLeave;
      onMouseUp = target.mind.collapse.onMouseUp;
      onDestroy = target.mind.collapse.onDestroy;
      moveDebounce = target.mind.collapse.onMove;
    }else {
      onMouseEnter = (targetPen) => {
        if (targetPen.mind.children.length > 0) {
          targetPen.mind.singleton.collapseButton.translatePosition(targetPen);
          targetPen.mind.singleton.collapseButton.show();
          if (targetPen.mind.childrenVisible) {
            targetPen.mind.singleton.collapseButton.setCollapseIcon();
          }
        }
      };
      onMouseUp = (target) => {
        collapseChildPlugin.loadOptions(target);
      };
      onMouseLeave = (targetPen) => {
        if (targetPen.mind.childrenVisible) {
          targetPen.mind.singleton.collapseButton?.hide();
        }
      };
      onDestroy = (targetPen) => {
        targetPen.mind.singleton.collapseButton?.hide();
        targetPen.mind.singleton.collapseButton?.destroy();
        targetPen.mind.singleton.collapseButton = undefined;
      };
      moveDebounce = (targetPen) => {
        targetPen.mind.singleton?.collapseButton?.translatePosition(targetPen);
        if (targetPen.mind.childrenVisible) {
          targetPen.mind.singleton?.collapseButton?.hide();
        }
      };
      target.mind.collapse.onMouseEnter = onMouseEnter;
      target.mind.collapse.onMouseUp = onMouseUp;
      target.mind.collapse.onMouseLeave = onMouseLeave;
      target.mind.collapse.onDestroy = onDestroy;
      target.mind.collapse.onMove = moveDebounce;
    }
    setLifeCycleFunc(target, 'onMouseEnter',onMouseEnter,del);
    setLifeCycleFunc(target, 'onMouseUp',onMouseUp,del);
    setLifeCycleFunc(target, 'onMouseLeave',onMouseLeave,del);
    setLifeCycleFunc(target, 'onDestroy',onDestroy,del);
    setLifeCycleFunc(target, 'onMove', moveDebounce,del);
    if(del){
      delete target.mind.collapse.onMouseEnter;
      delete target.mind.collapse.onMouseUp;
      delete target.mind.collapse.onMouseLeave;
      delete target.mind.collapse.onDestroy;
      delete target.mind.collapse.onMove;
    }
  },
  getAllChildNumber(pen) {
    if (!pen) return 0;
    let num = 0;
    let children = pen.mind.children;
    children.forEach(i => {
      let child:MyPen = meta2d.store.pens[i];
      if (!child) return 0;
      num += child.mind.children?.length || 0;
      this.getAllChildNumber(child);
    });
    return num;
  },

  // 折叠函数
  collapse(pen) {
    toolbox.hide();
    pen.mind.childrenVisible = false;
    let children = pen.mind.children || [];
    let allCount = children.length || 0;
    this._setVisible(pen, false, true);
    this._controlChildButton(pen, false);
    pen.mind.allChildrenCount = allCount;
    return allCount;
  },
  _controlChildButton(pen, status, recursion = true) {
    if (!pen) return;
    let children = pen.mind.children || [];
    children.forEach(i => {
      let child:MyPen = meta2d.store.pens[i];
      if (child && child.mind.childrenVisible && !status && !pen.mind.childrenVisible) {
        child.mind.singleton.collapseButton?.hide();
      } else if (child && !child.mind.childrenVisible && pen.mind.childrenVisible && child.mind.visible && status) {
        child.mind.singleton.collapseButton?.show();
      } else {
        child.mind.singleton.collapseButton?.hide();
      }
      if (recursion) this._controlChildButton(child, status, true);
    });
  },

  _setVisible(pen, visible, recursion = true) {
    if (!pen) return;
    let children = pen.mind.children || [];
    children.forEach(i => {
      let child:MyPen = meta2d.store.pens[i];
      if (!child) return;
      child.mind.visible = visible;
      let line = child.connectedLines[0];
      meta2d.setVisible(meta2d.findOne(line.lineId), visible, false);
      meta2d.setVisible(child, visible, false);
      if (recursion) this._setVisible(child, visible, true);
    });
  },
  // 展开函数
  extend(pen, recursion = true) {
    pen.mind.childrenVisible = true;
    if (!pen) return;
    this._setExtend(pen);
    this._controlChildButton(pen, true);
  },
  _setExtend(pen, recursion = true) {
    if (!pen) return;
    let children = pen.mind.children || [];
    children.forEach(i => {
      let child:MyPen = meta2d.store.pens[i];
      if (!child) return;
      if (!pen.mind.childrenVisible) return;
      child.mind.visible = pen.mind.childrenVisible;
      let line = child.connectedLines[0];
      meta2d.setVisible(meta2d.findOne(line.lineId), pen.mind.childrenVisible, false);
      meta2d.setVisible(child, pen.mind.childrenVisible, false);
      if (recursion) this._setExtend(child, true);
    });
  },
};

