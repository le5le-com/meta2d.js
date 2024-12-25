import {createDom, debounce, deepMerge, isObjectLiteral} from "../utils";
import d, {
  basicFuncConfig,
  controlStyle,
  DefaultCssVar,
  funcListStyle, FuncOption,
  toolboxDefault,
  toolboxStyle
} from "../config/default";
import {Scope} from "../parse";
import {Pen, Point} from "@meta2d/core";

const extra = 'extra';
declare const toolbox:ToolBox;
let cssVarMap = {
  itemHoverBackgroundColor: '--toolboxItem-hover-backgroundColor',
  boxMoveOutLine: '--toolbox-move-outLine'
};
let mouseMoved = false;
let controlDom: any = {
  control: null,
  show: true,
};
// 此列表为，可供用户配置的属性列表
let CONFIGS = ['showControl', 'offset', 'style','active'];

function configValid(config: any) {
  if (config.key) return true;
  return false;
}

export class ToolBox {
  static instance: ToolBox;
  open = false;
  offset = 80;
  showControl = true;
  parentHtml!: HTMLElement;
  box: HTMLElement = createDom('div', {style: {...toolboxStyle, left: '-9999px'}, className: 'toolBox'});
  _funcDom: any;
  active: boolean = true;
  [key: string]: any

  constructor(parentHtml: HTMLElement, config = {},) {
    // 单例模式
    if (!ToolBox.instance) {
      ToolBox.instance = this;
    } else {
      return ToolBox.instance;
    }
    this.parentHtml = parentHtml;
    this._loadOptions(config);
    this._init();
    this.parentHtml.appendChild(this.box);
  }

  _loadOptions(config: any) {
    if (!isObjectLiteral(config) && !(config == null)) return;
    config == null ? config = {} : '';
    // 加载默认配置项
    for (const conf in toolboxDefault) {
      // @ts-ignore
      this[conf] = toolboxDefault[conf];
    }

    // 加载用户配置项
    for (const conf in config) {
      if (CONFIGS.includes(conf)) {
        this[conf] = config[conf];
      } else {

      }
    }
    this.setStyle(config.style);
    this._setControl();
  }

  _init() {
    if(!this.active)return
    this.box.id = 'toolbox';
    this._setControl();
    let funcContainer = createDom('div', {style: funcListStyle, className: 'toolbox_func'});
    this.box.appendChild(funcContainer);
    this._funcDom = funcContainer;
    let style = document.createElement('style');
    style.type = 'text/css';
    document.head.appendChild(style);
    let stylesheet = style.sheet;
    // toolbox_item是否交给用户设置
    stylesheet.insertRule(".toolbox_item,.toolbox_slider_item {" +
      "display: flex;" +
      "justify-content: center;" +
      "align-items: center;" +
      "height: 100%;" +
      "margin: 0 1px;" +
      "cursor: pointer;" +
      "border-radius: 5px;" +
      "margin: 0 5px;" +
      "padding: 0 3px;" +
      "}", 0);
    stylesheet.insertRule(".toolbox_item:hover {" +
      "background-color: var(--toolboxItem-hover-backgroundColor);" +
      "}", 0);
    stylesheet.insertRule(".toolbox_slider_item:hover {" +
      "background-color: var(--toolboxSliderItem-hover-backgroundColor)" +
      "}", 0);
    stylesheet.insertRule(`.toolbox_control_move {
            outline: var(--toolbox-move-outLine) !important;
        }`);
    this.setCssVar();
  }

  setCssVar(cssVar?: any) {
    let cssVarObj;
    cssVar ?
      cssVarObj = cssVar
      :
      cssVarObj = DefaultCssVar;
    for (const key in cssVarObj) {
      document.documentElement.style.setProperty(key, cssVarObj[key]);
    }
  }

  _setControl() {
    if (this.showControl) {
      if (controlDom.show && controlDom.control) return;
      if (!controlDom.show && controlDom.control) {
        controlDom.show = true;
        controlDom.control.style.display = 'flex';
        return;
      }
      let self = this;
      let control = createDom('div', {style: controlStyle, className: "toolbox_control"});

      let icon = Scope({key: 'toolbox'}, {
          template: `
<div style="display: flex;flex-direction: row">
<div style="display: flex;justify-content: center;align-items: center"><svg style="margin: 0 10px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="6px" height="14px" viewBox="0 0 6 14" version="1.1">
                                <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                                    <g id="未固定" transform="translate(-266.000000, -148.000000)" fill="#BCBCC4">
                                        <g id="编组-2" transform="translate(253.000000, 135.000000)">
                                            <g id="上级节点备份" transform="translate(13.000000, 13.000000)">
                                                <circle id="椭圆形" cx="1" cy="1" r="1"/>
                                                <circle id="椭圆形备份-11" cx="5" cy="1" r="1"/>
                                                <circle id="椭圆形备份-5" cx="1" cy="5" r="1"/>
                                                <circle id="椭圆形备份-8" cx="5" cy="5" r="1"/>
                                                <circle id="椭圆形备份-6" cx="1" cy="9" r="1"/>
                                                <circle id="椭圆形备份-9" cx="5" cy="9" r="1"/>
                                                <circle id="椭圆形备份-7" cx="1" cy="13" r="1"/>
                                                <circle id="椭圆形备份-10" cx="5" cy="13" r="1"/>
                                            </g>
                                        </g>
                                    </g>
                                </g>
                            </svg></div>
                           <div id="rivet" style="display: {{ rivetVisible }};margin: 0 10px 0 0;justify-content: center;align-items: center" onclick="toggleFreeze(false)">
                               <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="8px" height="16px" viewBox="0 0 8 16" version="1.1">
                                    <title>钉子</title>
                                    <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                                        <g id="固定" transform="translate(-212.000000, -37.000000)" fill="#4D4DFF" fill-rule="nonzero">
                                            <g id="编组-2备份" transform="translate(182.000000, 24.000000)">
                                                <g id="固定,图钉" transform="translate(30.000000, 13.000000)">
                                                    <path d="M7.87291263,9.16048419 C7.77010858,9.29012105 7.61515755,9.36196798 7.45573678,9.36196798 L7.45126705,9.36196798 L4.82901885,9.3432253 L4.00658646,15.9500195 L4.0006268,16 L3.99466715,15.9500195 L3.17223476,9.3432253 L0.54998656,9.36196798 L0.545516831,9.36196798 C0.384606145,9.36196798 0.229655117,9.29012105 0.128340979,9.16048419 C0.0255369263,9.02928544 -0.00277143338,8.87465834 0.000208395526,8.73408825 C0.00616805333,8.52948067 0.0851334745,8.33424444 0.214755972,8.18117923 L1.13701259,7.0894182 C1.36645931,6.81764936 1.50651119,6.47559548 1.53332964,6.11323702 L1.83578213,2.20070284 C1.84472162,2.07887544 1.80300403,1.95704802 1.71956885,1.87114408 L1.14446216,1.26825459 C0.850949145,1.00741898 0.818171042,0.743459594 0.879257504,0.524795 C0.967162412,0.210855125 1.24726619,0 1.55865817,0 L1.56163799,0 L3.99466715,0.00780945312 L4.00658646,0.00780945312 L6.43961561,0 L6.44259544,0 C6.75398741,0 7.03409119,0.210855141 7.1219961,0.524795 C7.18308257,0.743459578 7.15030446,1.00741897 6.85679145,1.26825459 L6.28019484,1.87114408 C6.19675968,1.95860991 6.15504209,2.07887544 6.16398156,2.20070284 L6.46643406,6.11323702 C6.49474242,6.47559547 6.6333044,6.81764936 6.86275111,7.0894182 L7.78500772,8.18117923 C7.91463022,8.33424444 7.99210572,8.52948067 7.9995553,8.73408825 C8.00402504,8.87465834 7.97571668,9.02928544 7.87291263,9.16048419 Z" id="路径"/>
                                                </g>
                                            </g>
                                        </g>
                                    </g>
                                </svg>
                            </div>
                            </div>
                           `,
          script: {
            rivetVisible: 'none',
            toggleFreeze(v: boolean) {
              if (mouseMoved) return;
              if (!v) {
                self.freezePos(false);
              }
              if (self._freezePos) {
                this.rivetVisible = 'flex';
              } else {
                this.rivetVisible = 'none';
                self.translateWithPen(self.pen);
              }
              this.$update();
            }
          }
        }
        , "dom");
      control.addEventListener('mouseup', () => {
        icon.expose.rivetVisible = 'flex';
      });
      control.addEventListener('click', () => {
        icon.expose.$update();
      });
      control.appendChild(icon);
      control.id = 'toolbox_control';
      this.box.appendChild(control);
      this._dragElement(control, icon);
      controlDom.control = control;
      controlDom.show = true;
    } else {
      if (controlDom.control) {
        controlDom.control.style.display = 'none';
      }
      controlDom.show = false;
    }
  }

  setStyle(style: any) {
    this._setDefaultStyle();
    if (!style) return;
    // 用戶未定義hover樣式
    Object.keys(style).forEach(i => {
      if (i in cssVarMap) {
        this.setCssVar({
          // @ts-ignore
          [cssVarMap[i]]: style[i]
        });
        return;
      }
      // @ts-ignore
      this.box.style[i] = style[i];
    });
  }

  _setDefaultStyle() {
    Object.keys(toolboxStyle).forEach(i => {
      // @ts-ignore
      this.box.style[i] = toolboxStyle[i];
    });
    this.setCssVar();
  }

  // 重写dom函数
  _rewriteDom(dom: HTMLElement) {
    this.dom = dom;
    return dom;
  }

  hide() {
    // this.box.style.visibility = 'hidden';
    this.box.style.display = 'none';
    this.open = false;
  }

  bindPen(pen: Pen) {
    this.pen = pen;
  }

  show() {// this.box.style.visibility = 'visible';
    if(this.active){
      this.box.style.display = 'flex';
      this.open = true;
    }
  }

  destroy() {
    this.box.parentNode!.removeChild(this.box);
  }

  animate = false;
  curItem = null;
  _freezePos = false;

  freezePos(freeze: boolean) {
    this._freezePos = freeze;
  }

  translateWithPen(pen: any) {
    if (!pen) pen = this.pen;
    const store = pen.calculative.canvas.store;
    const worldRect = pen.calculative.worldRect;
    let pos = {
      x: worldRect.x + store.data.x + worldRect.width / 2 + 'px',
      y: worldRect.y + store.data.y + -this.offset + 'px'
    };
    this.translatePosition(pos);
  }

  translatePosition(pos: any) {
    if (this._freezePos) {
      if (!this.animate) this.show();
      return;
    }
    if (!this.animate) this.hide();
    this.box.style.left = pos.x;
    this.box.style.top = pos.y;
    if (!this.animate) this.show();
  }

  renderFuncList() {
    if(!this.active)return
    const fragmentChild = new DocumentFragment();
    this._funcDom.innerHTML = '';
    this.funcList.forEach((i: any) => {
      // 预处理
      preprocess(i, this.pen);
      const extraEle = extraElement(i);
      if (extraEle) {
        fragmentChild.appendChild(extraEle);
        return;
      }
      if (configValid(i)) {
        let itemsSpan = this.setChildDom(this.pen, i);
        itemsSpan.className = 'toolbox_item';
        fragmentChild.appendChild(itemsSpan);
      }
    });
    this._funcDom.appendChild(fragmentChild);
  }

  /**
   * @description 创造子节点  设置样式 配置事件函数等；
   * @param pen 操作的图元
   * @param item 该toolItem配置项 包含 显示name 事件event 回调函数func 和该按钮的样式style 与setDom自定义样式
   * */
  setChildDom(pen: any, item: FuncOption) {
    const dom: any = document.createElement('div');
    // 构建update方法 用于局部更新
    item.update = (target: string, keepOpen = true) => {
      // update 局部更新
      if (target === 'menu') {
        renderTitle(item, pen, dom.titleDom);
        return;
      } else if (target === 'popup') {
        renderChildDom(item, pen, dom, dom.childrenDom, keepOpen);
        return;
      }
      // 清空列表  初始化列表
      renderInit(item, pen, dom);
      // 执行配置项初始化函数
      item.init?.(item, pen);

      // 初始化titleDOM
      let title = createDom('div', {className: 'toolbox_title'});
      // 执行titleDom
      title = renderTitle(item, pen, title);

      item.dom = dom;
      item.dom.titleDom = title;
      if (item.popup) {
        // 打开函数
        let openFunc = () => {
          // 关闭其他选项
          if (toolbox.curItem !== item) {
            toolbox.funcList.filter((i: any) => i.isOpen).forEach(
              (i: any) => {
                i.close();
              }
            );
          }
          if ((toolbox.curItem === item) && item.isOpen) return;
          // 将打开逻辑交给用户 或者
          item.popupAnimate?.(item, pen, item.dom.childrenDom) || (item.dom.childrenDom && (item.dom.childrenDom.style.visibility = 'visible'));

          // 执行打开下拉菜单回调函数 TODO 传参应该怎么传
          item.onPopup?.(item, pen, item.dom.childrenDom);
          item.isOpen = true;
          toolbox.curItem = item;
        };
        // @ts-ignore
        title['on' + (item.popupEvent || basicFuncConfig.popupEvent)] = openFunc;
      }


      // titleDom添加到dom中
      item.shadowRoot ? dom.shadowRoot.appendChild(title) : dom.appendChild(title);

      // 渲染下拉列表
      let containerDom: any = null;
      renderChildDom(item, pen, dom, containerDom);
      // 事件处理
    };
    item.updateAll = (keepOpen = true) => {
      item.update('menu');
      item.update('popup', keepOpen);
    };
    item.update();
    return dom;
  }

  setFuncList(funcList: any[]) {
    console.log(this.active,this);
    if(!this.active)return
    this.funcList = funcList;
    this.renderFuncList();
  }

  // 点击控制按钮事件
  onControlClick() {
  }

  // 移动控制按钮事件
  onControlMove() {
    // 默认行为
    this.box.classList.add('toolbox_control_move');
    this.closeAll();
  }

  onControlUp() {
    this.box.classList.remove('toolbox_control_move');
  }

  closeAll() {
    toolbox.funcList.filter((i: any) => i.isOpen).forEach(
      (i: any) => {
        i.close();
      }
    );
  }

  clearFuncList() {
    this.setFuncList([]);
  }

  _dragElement(control: HTMLElement, icon: string) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    control.onmousedown = dragMouseDown;
    let self = this;

    function dragMouseDown(e: any) {
      e = e || window.event;
      e.preventDefault();
      // 获取鼠标光标的初始位置
      pos3 = e.clientX;
      pos4 = e.clientY;
      self.onControlClick?.();
      document.addEventListener('mouseup', closeDragElement);
      // 当鼠标光标移动时调用元素位置调整函数
      document.addEventListener('mousemove', elementDrag);
    }

    function elementDrag(e: any) {
      e = e || window.event;
      e.preventDefault();
      mouseMoved = true;
      // 计算鼠标的新位置
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      self.onControlMove?.();
      self.freezePos(true);
      // 设置元素的新位置
      self.box.style.top = (self.box.offsetTop - pos2) + "px";
      self.box.style.left = (self.box.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      self.onControlUp?.();
      mouseMoved = false;
      // 停止移动时，移除鼠标事件监听
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
    }
  }
}

function renderInit(item: FuncOption, pen: Pen, dom: HTMLElement) {
  if (dom.shadowRoot) {
    // 清空
    dom.shadowRoot.innerHTML = '';
  } else {
    item.shadowRoot ? dom.attachShadow({mode: "open"}) : dom.innerHTML = '';
  }

  //设置样式与事件
  // typeof item.style === 'object' && toolbox.setStyle(item.style);

  // 绑定事件，绑定在dom上
  if (item.event) {
    let eventFunc = function (e: MouseEvent) {
      // 绑定事件
      if (item.closeOther) {
        toolbox.funcList.filter((i: any) => i.isOpen).forEach(
          (i: any) => {
            i.close();
          }
        );
      }
      // @ts-ignore
      item.func(item, this, dom, e);
    };
    dom.addEventListener(item.event, eventFunc.bind(pen));
  }
  return dom;
}

function renderTitle(item: FuncOption, pen: Pen, title: HTMLElement) {
  title.innerHTML = '';
  if (typeof item.menu?.dom === 'function') {
    // 根据dom渲染 menu?Title
    let re = item.menu?.dom(item, pen, title);
    switch (typeof re) {
      case "string":
        title.innerHTML = re;
        break;
      case "object":
        title.appendChild(re);
        break;
      default:
        throw new Error('function setDom must return string or node object');
    }
  } else {
    title.innerHTML = <string>(item.menu?.icon ? item.menu?.icon : (item.menu?.img ? `<img src="${item.menu?.img}" title="${item.menu?.text || '图标'}" />` : item.menu?.text));
  }
  return title;
}

function renderChildDom(item: FuncOption, pen: Pen, dom: any, containerDom: HTMLElement, keepOpen = false) {
  if (dom.childrenDom) dom.shadowRoot ? dom.shadowRoot.removeChild(dom.childrenDom) : dom.removeChild(dom.childrenDom);
  if (item.popup) {
    // 是否重写dom
    if (
      typeof item.popup === 'function'
    ) {
      // 重新childDom

      let childDom = item.popup(item, pen, dom);

      /**
       * @description 若返回的是字符串，则在外部包裹一层div作为其container
       * */
      if (typeof childDom === 'string') {
        let div = document.createElement('div');
        // 默认隐藏节点
        if (typeof keepOpen === 'boolean') {
          keepOpen ? (item.popupAnimate?.(item, pen, item.dom.childrenDom) || (div.style.visibility = 'visible')) : (item.collapseAnimate?.(item, pen, div) || (div.style.visibility = 'hidden'));
        }
        div.innerHTML = childDom;
        dom.shadowRoot ? dom.shadowRoot.appendChild(div) : dom.appendChild(div);
        containerDom = div;
      } else {
        containerDom = childDom;
        if (typeof keepOpen == 'boolean') {
          keepOpen ? (item.popupAnimate?.(item, pen, item.dom.childrenDom) || (childDom.style.visibility = 'visible')) : (item.collapseAnimate?.(item, pen, childDom) || (childDom.style.visibility = 'hidden'));
        }
      }
    } else {
      containerDom = createDom('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'absolute',
          top: '40px',
          backgroundColor: '#fff',
          borderRadius: '5px',
          padding: '3px',
          width: 'max-content',
          boxShadow: '0px 6px 20px rgba(25,25,26,.06), 0px 2px 12px rgba(25,25,26,.04)',
        }
      });
      let gap = createDom('div', {
        style: {
          position: 'absolute',
          height: '10px',
          bottom: '-10px',
          backgroundColor: '#eee',
          width: '100%',
          opacity: 0
        }, className: 'toolbox_gap'
      });
      dom.shadowRoot ? dom.shadowRoot.appendChild(gap) : dom.appendChild(gap);
      if (typeof keepOpen === 'boolean') {
        keepOpen ? (item.popupAnimate?.(item, pen, containerDom) || (containerDom.style.visibility = 'visible')) : (item.collapseAnimate?.(item, pen, containerDom) || (containerDom.style.visibility = 'hidden'));
      }

    }
    if (Array.isArray(item.popup)) {
      let fragment = new DocumentFragment();
      for (let i of item.popup || []) {
        let node = createDom('div',
          {
            style: {
              margin: '5px 8px'
            }, event: i.event, func: function (e: MouseEvent) {
              i.stopPropagation ? e.stopPropagation() : '';
              // @ts-ignore
              i.func(i, this, dom, item, e);
            }.bind(pen), className: 'toolbox_slider_item'
          });

        //TODO 执行时机是否正确？？？
        i.init?.(i, pen, node);
        if (i.menu?.dom) {
          let re = i.menu?.dom(i, pen, node);
          switch (typeof re) {
            case "string":
              node.innerHTML = re;
              break;
            case "object":
              node.appendChild(re);
              break;
            default:
              throw new Error('function setDom must return string or node object');
          }
        } else {
          node.innerHTML = (i.menu?.icon && i.menu?.text) || (i.menu?.img && i.menu?.text) ? '<span style="padding-right: 30px;width: max-content" >' + (i.menu?.icon || `<img src="${i.menu?.img}"/>`) + '</span> <span>' + i.menu?.text + '</span>' : '<span>' + (i.menu?.text || i.menu?.icon) + '</span>';
        }
        fragment.appendChild(node);
      }
      containerDom?.appendChild(fragment);
    }
    dom.style.position = 'relative';
    containerDom.classList.add('toolbox_container');
    // 下拉菜单默认为绝对定位
    containerDom.style.position = 'absolute';
    item.mounted?.(item, pen, containerDom);
    item.shadowRoot ? dom.shadowRoot.appendChild(containerDom) : dom.appendChild(containerDom);
    dom.childrenDom = containerDom;
// 添加样式到元素
  }

  if (item.popup || item.closeOther) {
    // 关闭下拉菜单
    if (!item.closeOther) {
      ((item.collapseEventOnMenu ?? basicFuncConfig.collapseEventOnMenu ? item.dom.titleDom : dom.childrenDom)['on' + (item.collapseEvent || basicFuncConfig.collapseEvent)] = (() => {
        dom.offsetHeight;
        // 可手动派发隐藏函数
        item.close();
        toolbox.curItem = null;
      }));
    }
  }
  return containerDom;
}

// 配置项预处理
function preprocess(item: FuncOption, pen: any) {
  // 分隔符则返回
  if (item.key === extra) return;
  // 默认为false
  if (item.shadowRoot == null) {
    item.shadowRoot = basicFuncConfig.shadowRoot;
  }
  if (item.popup) {
    item.isOpen = false;
    item.closeOther = false;
    item.close = () => {
      if (!item.isOpen) return;
      item.collapseAnimate?.(item, pen, item.dom.childrenDom) || (item.dom.childrenDom && (item.dom.childrenDom.style.visibility = 'hidden'));
      item.isOpen = false;
      item.onCollapse?.(item, pen, item.dom.childrenDom);
    };
    item.open = () => {
      if (item.isOpen) return;
      item.popupAnimate?.(item, pen, item.dom.childrenDom) || (item.dom.childrenDom && (item.dom.childrenDom.style.visibility = 'visible'));
      item.isOpen = true;
      item.onPopup?.(item, pen.item.dom.childrenDom);
    };
  }

}

function extraElement(config: any) {
  if (config.key === extra) {
    // 设置分隔符
    let node;
    let style = deepMerge(d.extraStyle, config.style);
    if (typeof config.dom === 'function') {
      node = config.dom();
    } else {
      node = createDom('div', {style: style});
    }
    return node;
  }
}


