import { clearIframes, commonAnchors, commonPens, cube, updateIframes, reset, updateFormData } from './diagrams';
import { EventType, Handler, WildcardHandler } from 'mitt';
import { Canvas } from './canvas';
import { Options, PenPlugin, PluginOptions } from './options';
import {
  calcInView,
  calcTextDrawRect,
  calcTextLines,
  calcTextRect,
  ChartData,
  facePen,
  formatAttrs,
  getAllChildren,
  getFromAnchor,
  getParent,
  getToAnchor,
  getWords,
  LockState,
  Pen,
  PenType,
  renderPenRaw,
  IValue,
  setElemPosition,
  connectLine,
  nearestAnchor,
  setChildValue,
  FormItem,
  BindId,
  isAncestor,
  isShowChild,
  CanvasLayer,
  validationPlugin,
  setLifeCycleFunc,
  getAllFollowers,
  isInteraction,
  calcWorldAnchors,
  getGlobalColor,
  isDomShapes,
  defaultFormat,
  findOutliersByZScore,
} from './pen';
import { Point, rotatePoint } from './point';
import {
  clearStore,
  EditAction,
  EditType,
  globalStore,
  register,
  registerAnchors,
  registerCanvasDraw,
  registerLineAnimateDraws,
  Meta2dData,
  Meta2dStore,
  useStore,
  Network,
  HttpOptions,
  Sql,
} from './store';
import {
  formatPadding,
  loadCss,
  Padding,
  s8,
  valueInArray,
  valueInRange,
} from './utils';
import {
  calcCenter,
  calcRelativeRect,
  calcRightBottom,
  getRect,
  Rect,
  rectInRect,
} from './rect';
import { deepClone } from './utils/clone';
import { Event, EventAction, EventName, TriggerCondition } from './event';
import { ViewMap } from './map';
// TODO: 这种引入方式，引入 connect， webpack 5 报错
import { MqttClient } from 'mqtt';
import * as mqtt from 'mqtt/dist/mqtt.min.js';

import pkg from '../package.json';
import { lockedError } from './utils/error';
import { Scroll } from './scroll';
import { getter } from './utils/object';
import { d, getCookie, getMeta2dData, getToken, queryURLParams } from './utils/url';
import { HotkeyType } from './data';
import { Message, MessageOptions, messageList } from './message';
import { closeJetLinks, connectJetLinks, getSendData, sendJetLinksData } from './utils/jetLinks';
import { le5leTheme } from './theme'
const echartReg = /^echarts/;
export class Meta2d {
  store: Meta2dStore;
  canvas: Canvas;
  websocket: WebSocket;
  mqttClient: MqttClient;
  websockets: WebSocket[];
  mqttClients: MqttClient[];
  eventSources: EventSource[];
  penPluginMap: Map<
    PenPlugin,
    {
      tag?: string;
      name?: string;
      id?: string;
      option: Object;
    }[]
  > = new Map();
  socketFn: (
    e: string,
    // topic: string,
    context?: {
      meta2d?: Meta2d;
      type?: string;
      topic?: string;
      url?: string;
      method?: string;
      net?: any;
    }
  ) => boolean | string;
  events: Record<number, (pen: Pen, e: Event, params?: any) => void> = {};
  map: ViewMap;
  mapTimer: any;
  constructor(parent: string | HTMLElement, opts: Options = {}) {
    this.store = useStore(s8());
    this.setOptions(opts);
    this.setDatabyOptions(opts);
    this.init(parent);
    this.register(commonPens());
    this.registerCanvasDraw({ cube });
    this.registerAnchors(commonAnchors());
    globalThis.meta2d = this;
    this.initEventFns();
    this.store.emitter.on('*', this.onEvent);
  }

  facePen = facePen;
  getWords = getWords;
  calcTextLines = calcTextLines;
  calcTextRect = calcTextRect;
  calcTextDrawRect = calcTextDrawRect;

  /**
   * @deprecated 改用 beforeAddPens
   */
  get beforeAddPen() {
    return this.canvas.beforeAddPen;
  }
  /**
   * @deprecated 改用 beforeAddPens
   */
  set beforeAddPen(fn: (pen: Pen) => boolean) {
    this.canvas.beforeAddPen = fn;
  }
  get beforeAddPens() {
    return this.canvas.beforeAddPens;
  }
  set beforeAddPens(fn: (pens: Pen[]) => Promise<boolean>) {
    this.canvas.beforeAddPens = fn;
  }
  get beforeAddAnchor() {
    return this.canvas.beforeAddAnchor;
  }
  set beforeAddAnchor(fn: (pen: Pen, anchor: Point) => Promise<boolean>) {
    this.canvas.beforeAddAnchor = fn;
  }
  get beforeRemovePens() {
    return this.canvas.beforeRemovePens;
  }
  set beforeRemovePens(fn: (pens: Pen[]) => Promise<boolean>) {
    this.canvas.beforeRemovePens = fn;
  }
  get beforeRemoveAnchor() {
    return this.canvas.beforeRemoveAnchor;
  }
  set beforeRemoveAnchor(fn: (pen: Pen, anchor: Point) => Promise<boolean>) {
    this.canvas.beforeRemoveAnchor = fn;
  }

  setOptions(opts: Options = {}) {
    if (
      opts.grid !== undefined ||
      opts.gridColor !== undefined ||
      opts.gridSize !== undefined
    ) {
      // this.setGrid({
      //   grid: opts.grid,
      //   gridColor: opts.gridColor,
      //   gridSize: opts.gridSize,
      // });
      this.canvas && (this.canvas.canvasTemplate.bgPatchFlags = true);
    }
    if (
      opts.rule !== undefined ||
      opts.ruleColor !== undefined ||
      opts.ruleOptions !== undefined
    ) {
      // this.setRule({
      //   rule: opts.rule,
      //   ruleColor: opts.ruleColor,
      // });
      this.store.patchFlagsTop = true;
      if (opts.ruleOptions) {
        if (this.store.options?.ruleOptions) {
          Object.assign(this.store.options.ruleOptions, opts.ruleOptions);
          opts.ruleOptions = this.store.options.ruleOptions;
        }
      }
    }
    if (opts.background !== undefined) {
      this.canvas && (this.canvas.canvasTemplate.bgPatchFlags = true);
    }
    if (opts.resizeMode !== undefined) {
      if (!opts.resizeMode) {
        this.canvas.hotkeyType = HotkeyType.None;
      }
    }
    if (opts.width !== undefined || opts.height !== undefined) {
      this.canvas && (this.canvas.canvasTemplate.bgPatchFlags = true);
      if (
        this.canvas &&
        this.canvas.canvasTemplate.canvas.style.backgroundImage
      ) {
        this.canvas.canvasTemplate.canvas.style.backgroundImage = '';
      }
    }
    this.store.options = Object.assign(this.store.options, opts);
    if (this.canvas && opts.scroll !== undefined) {
      if (opts.scroll) {
        !this.canvas.scroll && (this.canvas.scroll = new Scroll(this.canvas));
        this.canvas.scroll.show();
      } else {
        this.canvas.scroll && this.canvas.scroll.hide();
      }
    }
    this.canvas?.initGlobalStyle();
  }

  getOptions() {
    return this.store.options;
  }
  /**
   * @description
   * @author Joseph Ho
   * @date 21/02/2025
   * @param {string} themeName 主题名
   * @param {object} theme 主题变量字符串数组
   * @returns {*}
   * @memberof Meta2d
   */
  registerTheme(themeName: string, theme: object){
    // 校验数据
    if(!Array.isArray(theme)){
      return;
    }
    // 写一个正则，中间必须有且仅有1个冒号，结尾不能有分号，符合"A:B"的形式，冒号两边必须非空，允许有空格
    const regex = /^\s*\S+\s*:\s*\S+\s*$/;
    const ret = theme.every(el=>regex.test(el));
    if(!ret){
      return;
    }
    const obj = {},newTheme = [];
    for (let i = 0; i < theme.length; i++) {
      const item = theme[i];
      const kvs = item.split(":");
      const kvs0 = kvs[0].trim();
      const kvs1 = kvs[1].trim();
      newTheme.push([kvs0,kvs1].join(":"));
      obj[kvs0] = kvs1;
    }
    le5leTheme.addTheme(themeName,newTheme);
    this.store.theme[themeName] = obj;
  }
  setTheme(theme: string) {
    this.store.data.theme = theme;
    this.setBackgroundColor(this.store.theme[theme].background);
    this.canvas.parentElement.style.background =
      this.store.theme[theme].parentBackground;
    this.setOptions({
      ruleColor: this.store.theme[theme].ruleColor,
      ruleOptions: this.store.theme[theme].ruleOptions,
    });
    // 更新全局的主题css变量
    if(!(this.store.options.themeOnlyCanvas || this.store.data.themeOnlyCanvas)){
      this.store.data.color = this.store.theme[theme].color;
      le5leTheme.updateCssRule(this.store.id, theme);
      this.canvas.initGlobalStyle();

      for (let i = 0; i < this.store.data.pens.length; i++) {
        const pen = this.store.data.pens[i];
        // 调用pen的主题设置函数,如果单个pen有主题的自定义设置的话
        pen.setTheme && pen.setTheme(pen,this.store.styles)
      }
    }
    this.render();
  }

  setDatabyOptions(options: Options = {}) {
    const {
      color,
      activeColor,
      activeBackground,
      grid,
      gridColor,
      gridSize,
      fromArrow,
      toArrow,
      rule,
      ruleColor,
      textColor,
      x = 0,
      y = 0,
    } = options;
    this.setRule({ rule, ruleColor });
    this.setGrid({
      grid,
      gridColor,
      gridSize,
    });
    this.store.data = Object.assign(this.store.data, {
      textColor,
      color,
      activeColor,
      activeBackground,
      fromArrow,
      toArrow,
      x,
      y,
    });
  }

  private init(parent: string | HTMLElement) {
    if (typeof parent === 'string') {
      this.canvas = new Canvas(
        this,
        document.getElementById(parent),
        this.store
      );
    } else {
      this.canvas = new Canvas(this, parent, this.store);
    }
    this.canvas.initGlobalStyle();
    this.resize();
    this.canvas.listen();
    // 创建主题样式表
    // if(this.store.data.theme){
      le5leTheme.createThemeSheet(this.store.data.theme, this.store.id);
    // }
  }
  initEventFns() {
    this.events[EventAction.Link] = (pen: Pen, e: Event) => {
      if (window && e.value && typeof e.value === 'string') {
        let url = e.value;
        if(url.includes('${')){
          let keys = url.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
          if (keys) {
            keys?.forEach((key) => {
              url = url.replace(`\${${key}}`, pen[key]||this.getDynamicParam(key));
            });
          }
        }
        window.open(url, e.params ?? '_blank');
        return;
      }
      console.warn('[meta2d] Link param is not a string');
    };
    this.events[EventAction.SetProps] = (pen: Pen, e: Event) => {
      // TODO: 若频繁地触发，重复 render 可能带来性能问题，待考虑
      const value = e.value;
      if (value && typeof value === 'object') {
        const pens = e.params ? this.find(e.params) : this.find(pen.id);
        const _value:any = {};
        for(let key in value){
          if(value[key]?.id){
            _value[key] = this.store.pens[value[key].id]?.[value[key].key];
          }else{
            if(typeof value[key] === 'string'&&value[key].includes('${')){
              let __value = value[key]
              let keys = __value.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
              if (keys) {
                keys.forEach((key) => {
                  __value = __value.replace(
                    `\${${key}}`,pen[key]||this.getDynamicParam(key)
                  );
                });
              }
              _value[key] = __value;
            } else if (
              typeof value[key] === 'string' &&
              ((value[key].startsWith('{') && value[key].endsWith('}')) ||
                (value[key].startsWith('[') && value[key].endsWith(']')))
            ) {
              try{
                _value[key] = JSON.parse(value[key]);
              }catch(e){
                _value[key] = value[key];
              }
            } else {
              _value[key] = value[key];
            }
          }
        }

        pens.forEach((pen: Pen) => {
          if (_value.hasOwnProperty('visible')) {
            if (pen.visible !== _value.visible) {
              this.setVisible(pen, _value.visible);
            }
          }
          this.setValue(
            { id: pen.id, ..._value },
            { render: false, doEvent: false }
          );
        });
        this.render();
        return;
      }
      console.warn('[meta2d] SetProps value is not an object');
    };
    this.events[EventAction.StartAnimate] = (pen: Pen, e: Event) => {
      let _pen = pen;
      if (e.value) {
        _pen = this.findOne(e.value as string);
      }
      if (
        this.store.animates.has(_pen) &&
        !_pen.calculative.pause &&
        _pen.animateName === e.params
      ) {
        return;
      }
      if (e.targetType && e.params) {
        this.startAnimate((e.value as string) || [pen], e.params);
        return;
      }
      if (!e.value || typeof e.value === 'string') {
        this.startAnimate((e.value as string) || [pen]);
        return;
      }
      console.warn('[meta2d] StartAnimate value is not a string');
    };
    this.events[EventAction.PauseAnimate] = (pen: Pen, e: Event) => {
      if (!e.value || typeof e.value === 'string') {
        this.pauseAnimate((e.value as string) || [pen]);
        return;
      }
      console.warn('[meta2d] PauseAnimate value is not a string');
    };
    this.events[EventAction.StopAnimate] = (pen: Pen, e: Event) => {
      if (!e.value || typeof e.value === 'string') {
        if (e.value) {
          let _pen = this.findOne(e.value as string);
          if (!this.store.animates.has(_pen)) {
            return;
          }
        } else {
          if (!this.store.animates.has(pen)) {
            return;
          }
        }
        this.stopAnimate((e.value as string) || [pen]);
        return;
      }
      console.warn('[meta2d] StopAnimate event value is not a string');
    };
    this.events[EventAction.StartVideo] = (pen: Pen, e: Event) => {
      if (!e.value || typeof e.value === 'string') {
        this.startVideo((e.value as string) || [pen]);
        return;
      }
      console.warn('[meta2d] StartVideo value is not a string');
    };
    this.events[EventAction.PauseVideo] = (pen: Pen, e: Event) => {
      if (!e.value || typeof e.value === 'string') {
        this.pauseVideo((e.value as string) || [pen]);
        return;
      }
      console.warn('[meta2d] PauseVideo value is not a string');
    };
    this.events[EventAction.StopVideo] = (pen: Pen, e: Event) => {
      if (!e.value || typeof e.value === 'string') {
        this.stopVideo((e.value as string) || [pen]);
        return;
      }
      console.warn('[meta2d] StopVideo event value is not a string');
    };
    this.events[EventAction.JS] = (pen: Pen, e: Event, params?: any) => {
      if (e.value && !e.fn) {
        try {
          if (typeof e.value !== 'string') {
            throw new Error('[meta2d] Function value must be string');
          }
          const fnJs = e.value;
          e.fn = new Function('pen', 'params', 'context', fnJs) as (
            pen: Pen,
            params: any,
            context?: { meta2d: Meta2d; eventName: string }
          ) => void;
        } catch (err) {
          console.error('[meta2d]: Error on make a function:', err);
        }
      }
      e.fn?.(pen, params || e.params, { meta2d: this, eventName: e.name });
    };
    this.events[EventAction.GlobalFn] = (pen: Pen, e: Event) => {
      if (typeof e.value !== 'string') {
        console.warn('[meta2d] GlobalFn value must be a string');
        return;
      }
      if (globalThis[e.value]) {
        globalThis[e.value](pen, e.params);
      }
    };
    this.events[EventAction.Emit] = (pen: Pen, e: Event) => {
      if (typeof e.value !== 'string') {
        console.warn('[meta2d] Emit value must be a string');
        return;
      }
      this.store.emitter.emit(e.value, {
        pen,
        params: e.params,
        eventName: e.name,
      });
    };
    this.events[EventAction.SendPropData] = (pen: Pen, e: Event) => {
      const value = deepClone(e.value);
      if (value && typeof value === 'object') {
        const _pen = e.params ? this.findOne(e.params) : pen;
        for (let key in value) {
          if (value[key] === undefined || value[key] === '') {
            value[key] = _pen[key];
          }
        }
        value.id = _pen.id;
        this.doSendDataEvent(value, e.extend);
        return;
      }
      console.warn('[meta2d] SendPropData value is not an object');
    };
    this.events[EventAction.SendVarData] = (pen: Pen, e: Event) => {
      const value = deepClone(e.value);
      if (value && typeof value === 'object') {
        const _pen = e.params ? this.findOne(e.params) : pen;
        let array = [];
        for (let key in value) {
          let obj = {
            dataId: key,
            value: value[key],
          };
          if (!obj.value) {
            let oneForm = _pen.form.find(
              (_item) =>
                (_item.dataIds as BindId) &&
                (_item.dataIds as BindId).dataId === obj.dataId
            );
            if (oneForm) {
              obj.value = _pen[oneForm.key];
            }
          }
          array.push(obj);
        }
        this.doSendDataEvent(array, e.extend);
        return;
      }
      console.warn('[meta2d] SendVarData value is not an object');
    };
    this.events[EventAction.Navigator] = (pen: Pen, e: Event) => {
      if (e.value && typeof e.value === 'string') {
        this.navigatorTo(e.value);
      }
    };
    this.events[EventAction.Dialog] = (pen: Pen, e: Event) => {
      if (e.params && typeof e.params === 'string') {
        let url = e.params;
        if (e.params.includes('${')) {
          let keys = e.params.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
          if (keys) {
            keys?.forEach((key) => {
              url = url.replace(`\${${key}}`, pen[key]||this.getDynamicParam(key));
            });
          }
        }
        Object.keys(e.extend).forEach((key)=>{
          if(!['x','y','width','height'].includes(key)){
            if(url.indexOf('?')!==-1){
              url+=`&${key}=${e.extend[key]}`
            }else{
              url+=`?${key}=${e.extend[key]}`
            }
          }
        })
        let data = this.getEventData(e.list, pen);
        if(Object.keys(data).length){
          data = null;
        }
        this.canvas.dialog.show(e.value as any, url, e.extend, data);
      }
    };
    this.events[EventAction.SendData] = (pen: Pen, e: Event) => {
      if(e.data?.length){
        const value: any = this.getSendData(e.data, pen);
        if(pen.formId && pen.formData){
          //表单数据
          Object.assign(value,pen.formData);
        }
        this.sendDataToNetWork(value, pen, e);
        return;
      }
      if (e.list?.length) {
        // if (e.targetType === 'id') {
        if (e.network && e.network.protocol === 'ADIIOT') {
          const list: any = getSendData(this,pen,e);
          if(list.length){
            sendJetLinksData(this,list);
          }
          return;
        }
        const value: any = this.getEventData(e.list, pen);
        if (pen.deviceId) {
          value.deviceId = pen.deviceId;
        }
        if(pen.formId && pen.formData){
          //表单数据
          Object.assign(value,pen.formData);
        }
        this.sendDataToNetWork(value, pen, e);
        return;
        // }
      }
      const value = deepClone(e.value);
      if (value && typeof value === 'object') {
        if (e.targetType === 'id') {
          const _pen = e.params ? this.findOne(e.params) : pen;
          for (let key in value) {
            if (value[key] === undefined || value[key] === '') {
              value[key] = _pen[key];
            } else if (
              typeof value[key] === 'string' &&
              value[key]?.indexOf('${') > -1
            ) {
              let keys = value[key].match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
              if (keys?.length) {
                value[key] = _pen[keys[0]] ?? this.getDynamicParam(keys[0]);
              }
            }
          }
          // value.id = _pen.id;
          if (_pen.deviceId) {
            value.deviceId = _pen.deviceId;
          }
          this.sendDataToNetWork(value, pen, e);
          return;
        }
      }
    };
    this.events[EventAction.PostMessage] = (pen: Pen, e: Event) => {
      if (typeof e.value !== 'string') {
        console.warn('[meta2d] Emit value must be a string');
        return;
      }
      const _pen = e.params ? this.findOne(e.params) : pen;
      if (_pen.name !== 'iframe' || !_pen.iframe) {
        console.warn('不是嵌入页面');
        return;
      }
      let params = queryURLParams(_pen.iframe.split('?')[1]);
      const value: any = this.getEventData(e.list, _pen);
      (
        _pen.calculative.singleton.div.children[0] as HTMLIFrameElement
      ).contentWindow.postMessage(
        JSON.stringify({
          name: e.value,
          id: params.id,
          data: value,
        }),
        '*'
      );
      return;
    };
    this.events[EventAction.PostMessageToParent] = (pen: Pen, e: Event) => {
      if (typeof e.value !== 'string') {
        console.warn('[meta2d] Emit value must be a string');
        return;
      }
      const value: any = this.getEventData(e.list, pen);
      window.parent.postMessage(
        JSON.stringify({ name: e.value, data: value }),
        '*'
      );
      return;
    };
    this.events[EventAction.Message] = (pen: Pen, e: Event, params?: any) => {
      let theme = e.params;
      let content = e.value
      if(!content && params && params.type === 'http'){
        content = params.error.statusText;
        if(!theme){
          theme = 'error';
        }
      }
      this.message({
        theme,
        content,
        ...e.extend,
      });
    };
  }

  getSendData(data:any[], cpen?: Pen){
    const value: any = {};
    data.forEach((item: any) => {
      if(item.prop){
        if(item.id&&item.id!=='固定值'){
          const pen = this.findOne(item.id);
          value[item.prop] = getter(pen,item.key);// pen[item.key];
        }else{
          if(typeof item.value === 'string'&&item.value.includes('${')){
            let _value = item.value
            let keys = _value.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
            if (keys) {
              keys.forEach((key) => {
                _value = _value.replace(
                  `\${${key}}`,getter(cpen,key) || this.getDynamicParam(key)
                );
              });
            }
            value[item.prop] = _value;
          }else{
            value[item.prop] = this.convertType(item.value,item.type);
          }
        }
      }
    });
    return value;
  }

  convertType(value: string, type:string) {
    if(typeof value === 'string'){
      if(['switch','bool','boolean'].includes(type)){
        if (value === 'false') {
          return false;
        } else if (value === 'true') {
          return true;
        }
      }else if( ['integer','number','int','enum','double','float'].includes(type)){
        if(!isNaN(Number(value))){
          return Number(value);
        }
      }
    }
    return value;
  }

  getEventData(list: any, pen: Pen) {
    const value: any = {};
    if (list?.length) {
      list.forEach((item: any) => {
        const _pen = item.params ? this.findOne(item.params) : pen;
        for (let key in item.value) {
          if (item.value[key] === undefined || item.value[key] === '') {
            value[key] = _pen[key];
          } else if (
            typeof item.value[key] === 'string' &&
            item.value[key]?.indexOf('${') > -1
          ) {
            let keys = item.value[key].match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
            if (keys?.length) {
              value[key] = _pen[keys[0]] ?? this.getDynamicParam(keys[0]);
            }
          } else {
            value[key] = item.value[key];
          }
        }
      });
    }
    if (Object.keys(value).length) {
      return value;
    } else return {};
  }

  message(options: MessageOptions) {
    const message = new Message(this.canvas.parentElement, options);
    message.init();
  }

  closeAll() {
    for (let key in messageList) {
      messageList[key].close();
    }
  }

  async navigatorTo(id: string) {
    if (!id) {
      return;
    }
    // let href = window.location.href;
    // let arr: string[] = href.split('id=');
    // if (arr.length > 1) {
    //   let idx = arr[1].indexOf('&');
    //   if (idx === -1) {
    //     window.location.href = arr[0] + 'id=' + id;
    //   } else {
    //     window.location.href = arr[0] + 'id=' + id + arr[1].slice(idx);
    //   }
    // }
    //路径参数更新
    let hasId = queryURLParams()?.id;
    if (hasId) {
      const url = new URL(window.location as any);
      url.searchParams.set('id', id);
      history.pushState({}, '', url);
    }
    //图纸更新
    const data = await getMeta2dData(this.store, id);
    if (data) {
      this.open(data);
      this.canvas.opening =false;
      this.lock(1);
      const width = this.store.data.width || this.store.options.width;
      const height = this.store.data.height || this.store.options.height;
      if (width && height ){
        this.fitSizeView(true,0);
      }else{
        this.fitView(true, 10);
      }
      // document.title = data.name + "-" + window.name;
    }
  }

  doSendDataEvent(value: any, topics?: string) {
    let data = JSON.stringify(value);
    if (this.mqttClient && this.mqttClient.connected) {
      if (topics) {
        topics.split(',').forEach((topic) => {
          this.mqttClient.publish(topic, data);
        });
      } else {
        this.store.data.mqttTopics &&
          this.store.data.mqttTopics.split(',').forEach((topic) => {
            this.mqttClient.publish(topic, data);
          });
      }
    }
    if (this.websocket && this.websocket.readyState === 1) {
      this.websocket.send(data);
    }
    if (this.store.data.https || this.store.data.http) {
      this.sendDatabyHttp(data);
    }
    this.store.emitter.emit('sendData', data);
  }

  async sendDataToNetWork(value: any, pen: Pen, e: any) {
    const network = deepClone(e.network);
    if (network.data) {
      Object.assign(network, network.data);
      delete network.data;
    }
    if(network.protocol === 'iot'){
      this.iotMqttClient &&  this.iotMqttClient.publish(`le5le-iot/property/set/${this.store.data.iot?.token}`, JSON.stringify(value));
      return;
    }
    if (!network.url) {
      return;
    }
    if (network.protocol === 'http') {
      if (typeof network.headers === 'object') {
        /*for (let i in network.headers) {
          if (typeof network.headers[i] === 'string') {
            let keys = network.headers[i].match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
            if (keys) {
              network.headers[i] = network.headers[i].replace(
                `\${${keys[0]}}`,
                this.getDynamicParam(keys[0])
              );
            }
          }
        }*/
        let headersStr = JSON.stringify(network.headers);
        let keys = headersStr.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
        if (keys?.length) {
         for(let i=0; i<keys.length; i++){
            headersStr = headersStr.replace(
              `\${${keys[i]}}`,
              this.getDynamicParam(keys[i])
            );
          }
        }
        network.headers = JSON.parse(headersStr);
      }
      let params = undefined;
      let url = network.url;
      if (network.method === 'GET') {
        if(Object.keys(value).length !== 0){
          if(url.includes('?')){
             params =
            '&' +
            Object.keys(value)
              .map((key) => key + '=' + value[key])
              .join('&');
          }else{
            params =
              '?' +
              Object.keys(value)
                .map((key) => key + '=' + value[key])
                .join('&');
          }
        }
      }
      // if (network.method === 'POST') {
        if (url.indexOf('${') > -1) {
          let keys = url.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
          if (keys) {
            keys.forEach((key) => {
              url = url.replace(
                `\${${key}}`,
                getter(pen, key) || this.getDynamicParam(key)
              );
            });
          }
        }
      // }
      const res: Response = await fetch(url + (params ? params : ''), {
        headers: network.headers || {},
        method: network.method,
        body: network.method === 'POST' ? JSON.stringify(value) : undefined,
      });
      if (res.ok) {
        if (e.callback) {
          const data = await res.text();
          if (!e.fn) {
            try {
              if (typeof e.callback !== 'string') {
                throw new Error('[meta2d] Function callback must be string');
              }
              const fnJs = e.callback;
              e.fn = new Function('pen', 'data', 'context', fnJs) as (
                pen: Pen,
                data: string,
                context?: { meta2d: Meta2d; e: any }
              ) => void;
            } catch (err) {
              console.error('[meta2d]: Error on make a function:', err);
            }
          }
          e.fn?.(pen, data, { meta2d: this, e });
        }
        console.info('http消息发送成功');
      }else {
        this.store.emitter.emit('error', { type: 'http', error: res });
      }
    } else if (network.protocol === 'mqtt') {
      const clients = this.mqttClients?.filter(
        (client) => (client.options as any).href === network.url
      );
      if (clients && clients.length) {
        if (clients[0].connected) {
          network.topics.split(',').forEach((topic) => {
            clients[0].publish(topic, JSON.stringify(value));
          });
        }
      } else {
        //临时建立连接
        let mqttClient = mqtt.connect(network.url, network.options);
        mqttClient.on('connect', () => {
          console.info('mqtt连接成功');
          network.topics.split(',').forEach((topic) => {
            mqttClient.publish(topic, JSON.stringify(value));
            setTimeout(() => {
              mqttClient?.end();
            },1000);
          });
        });
      }
    } else if (network.protocol === 'websocket') {
      const websockets = this.websockets?.filter(
        (socket) => socket.url === network.url
      );
      if (websockets && websockets.length) {
        if (websockets[0].readyState === 1) {
          websockets[0].send(JSON.stringify(value));
        }
      } else {
        //临时建立连接
        let websocket = new WebSocket(
          network.url,
          network.protocols || undefined
        );
        websocket.onopen = function () {
          console.info('websocket连接成功');
          websocket.send(JSON.stringify(value));
          setTimeout(() => {
            websocket.close();
          }, 100);
        };
      }
    }
  }

  resize(width?: number, height?: number) {
    this.canvas.resize(width, height);
    this.render();
    this.store.emitter.emit('resize', { width, height });

    if (this.canvas.scroll && this.canvas.scroll.isShow) {
      this.canvas.scroll.init();
    }
  }

  /**
   *
   * @param emit 是否发送消息
   */
  async addPen(pen: Pen, history?: boolean, emit = true, abs = false) {
    return await this.canvas.addPen(pen, history, emit, abs);
  }
  addPenSync(pen: Pen, history?: boolean, emit = true, abs = false) {
    return this.canvas.addPenSync(pen, history, emit, abs);
  }
  async addPens(pens: Pen[], history?: boolean, abs = false) {
    return await this.canvas.addPens(pens, history, abs);
  }

  render(patchFlags?: boolean | number) {
    this.canvas?.render(patchFlags);
  }

  async setBackgroundImage(url: string, data?: any) {
    let that = this;
    async function loadImage(url: string) {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = url;
        if (
          that.store.options.cdn &&
          !(
            url.startsWith('http') ||
            url.startsWith('//') ||
            url.startsWith('data:image')
          )
        ) {
          img.src = that.store.options.cdn + url;
        }
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          resolve(img);
        };
      });
    }

    this.store.data.bkImage = url;
    const width =
      data?.width || this.store.data?.width || this.store.options?.width;
    const height =
      data?.height || this.store.data?.height || this.store.options?.height;
    if (width && height) {
      this.canvas.canvasTemplate.canvas.style.backgroundImage = null;
      this.canvas && (this.canvas.canvasTemplate.bgPatchFlags = true);
    } else {
      this.canvas.canvasTemplate.canvas.style.backgroundImage = url
        ? `url('${url}')`
        : '';
    }
    if (url) {
      const img = await loadImage(url);
      // 用作 toPng 的绘制
      this.store.bkImg = img;
      if (width && height) {
        if (this.canvas) {
          this.canvas.canvasTemplate.init();
          this.render();
        }
      }
    } else {
      this.store.bkImg = null;
    }
  }

  setBackgroundColor(color: string = this.store.data.background) {
    this.store.data.background = color;
    // this.store.patchFlagsBackground = true;
    this.canvas && (this.canvas.canvasTemplate.bgPatchFlags = true);
  }

  setGrid({
    grid = this.store.data.grid,
    gridColor = this.store.data.gridColor,
    gridSize = this.store.data.gridSize,
    gridRotate = this.store.data.gridRotate,
  }: {
    grid?: boolean;
    gridColor?: string;
    gridSize?: number;
    gridRotate?: number;
  } = {}) {
    this.store.data.grid = grid;
    this.store.data.gridColor = gridColor;
    this.store.data.gridSize = gridSize < 0 ? 0 : gridSize;
    this.store.data.gridRotate = gridRotate;
    // this.store.patchFlagsBackground = true;
    this.canvas && (this.canvas.canvasTemplate.bgPatchFlags = true);
  }

  setRule({
    rule = this.store.data.rule,
    ruleColor = this.store.data.ruleColor,
  }: {
    rule?: boolean;
    ruleColor?: string;
  } = {}) {
    this.store.data.rule = rule;
    this.store.data.ruleColor = ruleColor;
    this.store.patchFlagsTop = true;
  }

  open(data?: Meta2dData, render: boolean = true) {
    this.clear(false, data?.template);
    this.canvas.autoPolylineFlag = true;
    if (data) {
      // 根据图纸的主题设置主题
      if(data.theme){
        this.setTheme(data.theme);
      }
      updateIframes(data.pens);
      this.setBackgroundImage(data.bkImage, data);
      Object.assign(this.store.data, data);
      this.store.data.pens = [];
      // 第一遍赋初值
      for (const pen of data.pens) {
        if (!pen.id) {
          pen.id = s8();
        }
        !pen.calculative && (pen.calculative = { canvas: this.canvas });
        this.store.pens[pen.id] = pen;
      }
      for (const pen of data.pens) {
        this.canvas.makePen(pen);
      }
      //首次计算连线bug
      // for (const pen of data.pens) {
      //   this.canvas.updateLines(pen);
      // }
    }

    this.canvas.patchFlagsLines.forEach((pen) => {
      if (pen.type) {
        this.canvas.initLineRect(pen);
      }
    });

    if (!this.store.data.template) {
      this.store.data.template = s8();
    }

    if (!render) {
      this.canvas.opening = true;
    }
    this.doInitJS();
    this.initBindDatas();
    this.initBinds();
    this.doInitFn();
    this.loadLineAnimateDraws();
    this.initMessageEvents();
    this.initGlobalTriggers();
    this.startAnimate();
    this.startVideo();
    this.listenSocket();
    this.connectSocket();
    this.connectNetwork();
    this.startDataMock();
    this.canvas.initGlobalStyle();
    this.render();
    setTimeout(() => {
      const pen = this.store.data.pens.find((pen) => pen.autofocus);
      if (pen) {
        this.focus(pen.id);
      }
    }, 100);
    if (this.store.data.iconUrls) {
      for (const item of this.store.data.iconUrls) {
        loadCss(item, () => {
          this.render();
        });
      }
    }
    this.canvas.autoPolylineFlag = false;
    this.store.emitter.emit('opened');

    if (this.canvas.scroll && this.canvas.scroll.isShow) {
      this.canvas.scroll.init();
    }
  }

  dirtyData(active?:boolean){
    //获取画布脏数据
    const pens = this.store.data.pens;
    const width = this.store.data.width || this.store.options.width;
    const height = this.store.data.height || this.store.options.height;
    const dirtyPens = [];
    for (let i = pens.length - 1; i >= 0; i--) {
      let pen = pens[i];
      if(pen.parentId){
        const parent = this.store.pens[pen.parentId];
        if(pen.x>10 || pen.y>10 || pen.width>10 || pen.height>10){
          // 子图元坐标值很大
          dirtyPens.push(pen);
        }else if(!parent.children||!parent.children.includes(pen.id)){
          //已经解组但子图元还有父图元id
          dirtyPens.push(pen);
        }
      }

      if (width && height ) {
        //大屏区域外
        let rect = this.getPenRect(pen);
        if(rect.x<-10 || rect.y<-10 || rect.x+rect.width>width || rect.y+rect.height>height){
          dirtyPens.push(pen);
        }
      }

      //无效连线 单个锚点连线
      if(pen.name==='line'){
        if(pen.anchors.length < 2){
          dirtyPens.push(pen);
        }
      }
    }
    if(!width||!height){
      //2d 偏移量很大
      let outpens = findOutliersByZScore(pens);
      outpens.forEach((item)=>{
        let repeat = dirtyPens.filter((_item)=>_item.id===item.id);
        if(!repeat.length){
          dirtyPens.push(item);
        }
      })
    }
    if(active){
      this.active(dirtyPens);
    }
    return dirtyPens;
  }

  clearDirtyData(){
    let dirtyPens = this.dirtyData();
    this.delete(dirtyPens,true);
  }

  cacheData(id: string) {
    if (id && this.store.options.cacheLength) {
      let index = this.store.cacheDatas.findIndex(
        (item) => item.data && item.data._id === id
      );
      if (index === -1) {
        this.store.cacheDatas.push({
          data: deepClone(this.store.data, true),
          // offscreen: new Array(2),
          // flag: new Array(2)
        });
        if (this.store.cacheDatas.length > this.store.options.cacheLength) {
          this.store.cacheDatas.shift();
        }
      } else {
        let cacheDatas = this.store.cacheDatas.splice(index, 1)[0];
        this.store.cacheDatas.push(cacheDatas);
      }
    }
  }

  loadCacheData(id: string) {
    let index = this.store.cacheDatas.findIndex(
      (item) => item.data && item.data._id === id
    );
    if (index === -1) {
      return;
    }
    // const ctx = this.canvas.canvas.getContext('2d');
    // ctx.clearRect(0, 0, this.canvas.canvas.width, this.canvas.canvas.height);
    // for (let offs of this.store.cacheDatas[index].offscreen) {
    //   if (offs) {
    //     ctx.drawImage(offs, 0, 0, this.canvas.width, this.canvas.height);
    //   }
    // }
    // ctx.clearRect(0, 0, this.canvas.canvas.width, this.canvas.canvas.height);
    this.store.data = this.store.cacheDatas[index].data;
    this.setBackgroundImage(this.store.data.bkImage);
    this.store.pens = {};
    this.store.data.pens.forEach((pen) => {
      pen.calculative.canvas = this.canvas;
      this.store.pens[pen.id] = pen;
      globalStore.path2dDraws[pen.name] &&
        this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));

      pen.type &&
        this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));

      if (pen.image) {
        pen.calculative.imageDrawed = false;
        this.canvas.loadImage(pen);
      }
    });
    this.render();
  }

  loadLineAnimateDraws(){
    globalStore.lineAnimateDraws = {}
    Object.entries(this.store.data.lineAnimateDraws).forEach(([key,drawFunc])=>{
      // @ts-ignore
      globalStore.lineAnimateDraws[key] = new Function('ctx','pen','state','index',drawFunc);
    })
  }

  statistics() {
    const num = this.store.data.pens.length;
    const imgNum = this.store.data.pens.filter((pen) => pen.image).length;
    const imgDrawNum = this.store.data.pens.filter((pen) => pen.image&&pen.calculative.inView).length;
    const domNum = this.store.data.pens.filter(
      (pen) =>
        pen.name.endsWith('Dom') ||
        isDomShapes.includes(pen.name) ||
        this.store.options.domShapes.includes(pen.name) ||
        pen.externElement
    ).length;
    const aningNum = this.store.animates.size;
    let dataPointsNum = 0;
    Object.keys(this.store.bind).forEach((key) => {
      dataPointsNum += this.store.bind[key].length;
    });
    Object.keys(this.store.bindDatas).forEach((key) => {
      dataPointsNum += this.store.bindDatas[key].length;
    });

    return {
      "图元总数量": num,
      "图片图元数量": imgNum,
      "图片图元绘制数量": imgDrawNum,
      "dom图元数量": domNum,
      "正在执行的动画数量": aningNum,
      "数据点数量": dataPointsNum,
    };
  }

  initBindDatas() {
    this.store.bindDatas = {};
    this.store.data.pens.forEach((pen) => {
      pen.form?.forEach((formItem) => {
        let dataIds: BindId[];
        if (formItem.dataIds) {
          if (Array.isArray(formItem.dataIds)) {
            dataIds = formItem.dataIds;
          } else {
            dataIds = [formItem.dataIds];
          }
        }
        dataIds?.forEach((item) => {
          if (!this.store.bindDatas[item.dataId]) {
            this.store.bindDatas[item.dataId] = [];
          }
          this.store.bindDatas[item.dataId].push({
            id: pen.id,
            formItem,
          });
        });
      });
    });
  }

  jetLinksList: any[] = [];
  jetLinksClient: any;

  initBinds() {
    this.jetLinksList = [];
    this.store.bind = {};
    const devices = [];
    const properties = [];
    this.store.data.pens.forEach((pen) => {
      pen.realTimes?.forEach((realTime) => {
        if (realTime.bind && realTime.bind.id) {
          // if (!this.store.bind[realTime.bind.id]) {
          //   this.store.bind[realTime.bind.id] = [];
          // }
          // this.store.bind[realTime.bind.id].push({
          //   id: pen.id,
          //   key: realTime.key,
          // });

          //JetLinks
          const Jet = this.store.data.networks?.some((item)=>item.protocol === 'ADIIOT');
            let productId = realTime.productId || pen.productId;
            let deviceId = realTime.deviceId || pen.deviceId;
            let propertyId = realTime.propertyId;
            let flag = false;
          if(Jet){
            if(productId && typeof productId === 'string' &&productId.indexOf('${') > -1){
              let keys = productId.match(/(?<=\$\{).*?(?=\})/g);
              if(keys?.length){
                productId = this.getDynamicParam(keys[0])||productId;
              }
              flag = true;
            }
            if(deviceId && typeof deviceId === 'string' && deviceId.indexOf('${') > -1){
              let keys = deviceId.match(/(?<=\$\{).*?(?=\})/g);
              if(keys?.length){
                deviceId = this.getDynamicParam(keys[0])||deviceId;
              }
              flag = true;
            }
            if(propertyId && typeof propertyId === 'string' &&propertyId.indexOf('${') > -1){
              let keys = propertyId.match(/(?<=\$\{).*?(?=\})/g);
              if(keys?.length){
                propertyId = this.getDynamicParam(keys[0])||propertyId;
              }
              flag = true;
            }
            if(flag){
              realTime.bind&&(realTime.bind.id = productId+'#'+deviceId+'#'+propertyId);
            }
          }
          if (!this.store.bind[realTime.bind.id]) {
            this.store.bind[realTime.bind.id] = [];
          }
          this.store.bind[realTime.bind.id].push({
            id: pen.id,
            key: realTime.key,
          });
          if(Jet){
            if (productId && deviceId && propertyId) {
              const index = this.jetLinksList.findIndex((item) =>
                item.topic.startsWith(`/${productId}/${deviceId}`)
              );
              if (index > -1) {
                const properties = this.jetLinksList[index].properties;
                if (!properties.includes(realTime.propertyId)) {
                  this.jetLinksList[index].properties.push(realTime.propertyId);
                }
              } else {
                this.jetLinksList.push({
                  topic: `/${productId}/${deviceId}`,
                  deviceId,
                  properties: [realTime.propertyId],
                });
              }
            }
          }
          if(realTime.bind.class === 'iot'){
            let bind = realTime.bind.id.split('#');
            let idx = devices.findIndex((item) => item.deviceId === bind[0]);
            if(idx > -1){
              if (!devices[idx].properties.includes(bind[1])) {
                devices[idx].properties.push(bind[1]);
              }
            }else{
              devices.push({
                deviceId: bind[0],
                properties: [bind[1]],
                token: realTime.bind.token
              });
            }
            let index = properties.findIndex((item) => item.key === realTime.bind.id);
            if (index === -1) {
              properties.push({
                key: realTime.bind.id,
                label: realTime.bind.label,
              });
            }
          }else if(realTime.bind.class === 'sql'){
            let bind = realTime.bind.id.split('#');
            const sql = this.store.data.sqls.find((item) => item.bindId === bind[0]);
            if(sql){
              if(!sql.keys){
                sql.keys = [];
              }
              bind.shift();
              const key = bind.join('#');
              if(!sql.keys.includes(key)){
                sql.keys.push(key);
              }
            }
          }
        }
      });
      pen.events?.forEach((event)=>{
        const actions = event.actions?.filter((item)=>item.action === EventAction.SendData);
        actions?.forEach((action)=>{
          action.data?.forEach((item)=>{
            if(item.class === 'iot'){
              let bind = item.prop.split('#');
              let idx = devices.findIndex((item) => item.deviceId === bind[0]);
              if(idx > -1){
                if (!devices[idx].properties.includes(bind[1])) {
                  devices[idx].properties.push(bind[1]);
                }
              }else{
                devices.push({
                  deviceId: bind[0],
                  properties: [bind[1]],
                  token: item.token
                });
              }
            }
          });
        })
      })
    });

    if(!this.store.data.iot){
      this.store.data.iot = {};
    }
    if(devices.length){
      this.store.data.iot.devices = devices;
    }else{
      delete this.store.data.iot.devices
    }
    if(properties.length){
      this.store.data.iot.list = properties;
    }else{
      delete this.store.data.iot.list
    }
  }

  connectSocket() {
    this.connectWebsocket();
    this.connectMqtt();
    this.connectHttp();
  }

  /**
   * open 后执行初始化 Js ，每个图纸可配置一个初始化 js
   */
  private doInitJS() {
    const initJs = this.store.data.initJs;
    if (initJs && initJs.trim()) {
      try {
        let fn = new Function('context', initJs) as (context?: {
          meta2d: Meta2d;
        }) => void;
        fn({ meta2d: this });
        fn = null;
      } catch (e) {
        console.warn('initJs error', e);
      }
    }
  }

  doInitFn() {
    let params = queryURLParams();
    let binds = [];
    for (let key in params) {
      if (params.hasOwnProperty(key)) {
        if (key.startsWith('bind-')) {
          binds.push({
            id: key.replace('bind-', ''),
            dataId: key.replace('bind-', ''),
            value: params[key],
          });
        }
      }
    }
    if (binds.length) {
      this.setDatas(binds, { history: false });
    }
  }

  drawLine(lineName?: string) {
    lineName && lockedError(this.store);
    this.canvas.drawingLineName = lineName;
  }
  alignPenToGrid(pen: Pen) {
    this.canvas.alignPenToGrid(pen);
  }
  drawingPencil() {
    this.canvas.drawingPencil();
  }

  stopPencil() {
    this.canvas.stopPencil();
  }

  lock(lock: LockState) {
    this.store.data.locked = lock;
    this.finishDrawLine(true);
    this.canvas.drawingLineName = '';
    this.stopPencil();
    //恢复可选状态
    this.store.data.pens.forEach((pen) => {
      if (pen.externElement === true) {
        // pen.onMove && pen.onMove(pen);
        pen.calculative.singleton?.div &&
          setElemPosition(pen, pen.calculative.singleton.div);
      }
    });
    if (lock > 0) {
      this.initMessageEvents();
    }
  }

  // end  - 当前鼠标位置，是否作为终点
  async finishDrawLine(end?: boolean) {
    await this.canvas.finishDrawline(end);
  }

  async finishPencil() {
    await this.canvas.finishPencil();
  }

  updateLineType(pen: Pen, lineName: string) {
    if (!pen || pen.name != 'line' || !lineName || !this.canvas[lineName]) {
      return;
    }

    pen.lineName = lineName;
    const from = getFromAnchor(pen);
    const to = getToAnchor(pen);
    from.prev = undefined;
    from.next = undefined;
    to.prev = undefined;
    to.next = undefined;
    pen.calculative.worldAnchors = [from, to];
    pen.calculative.activeAnchor = from;
    this.canvas[lineName](this.store, pen, to);
    if (pen.lineName === 'curve') {
      from.prev = {
        penId: from.penId,
        x: from.x - 50,
        y: from.y,
      };
      from.next = {
        penId: from.penId,
        x: from.x + 50,
        y: from.y,
      };
      to.prev = {
        penId: to.penId,
        x: to.x - 50,
        y: to.y,
      };
      to.next = {
        penId: to.penId,
        x: to.x + 50,
        y: to.y,
      };
    }
    pen.calculative.activeAnchor = undefined;
    this.canvas.initLineRect(pen);
    this.render();
  }

  addDrawLineFn(fnName: string, fn: Function) {
    this.canvas[fnName] = fn;
    this.canvas.drawLineFns.push(fnName);
  }

  removeDrawLineFn(fnName: string) {
    const index = this.canvas.drawLineFns.indexOf(fnName);
    if (index > -1) {
      this.canvas.drawLineFns.splice(index, 1);
    }
  }

  showMagnifier() {
    this.canvas.showMagnifier();
  }

  hideMagnifier() {
    this.canvas.hideMagnifier();
  }

  toggleMagnifier() {
    this.canvas.toggleMagnifier();
  }

  /**
   * 擦除画布，释放 store 上的 pens
   * @param render 是否重绘
   */
  clear(render = true, template?: string) {
    for (const pen of this.store.data.pens) {
      pen.onDestroy?.(pen);
    }
    clearStore(this.store, template);
    this.hideInput();
    this.canvas.tooltip.hide();
    if (this.map && this.map.isShow) {
      this.map.show();
      this.map.setView();
    }
    this.canvas.clearCanvas();
    sessionStorage.removeItem('page');
    this.store.clipboard = undefined;

    if (!this.store.sameTemplate) {
      this.canvas.canvasTemplate.bgPatchFlags = true;
    }
    this.store.patchFlagsBackground = true;
    this.store.patchFlagsTop = true;
    this.setBackgroundImage(undefined);
    render && this.render();
  }

  emit<T = any>(type: EventType, event?: T): void;
  emit(type: '*', event?: any): void;
  emit(type: EventType | '*', event: unknown) {
    this.store.emitter.emit(type, event);
  }

  on<T = any>(type: EventType, handler: Handler<T>): Meta2d;
  on(type: '*', handler: WildcardHandler): Meta2d;
  on(type: EventType | '*', handler: WildcardHandler | Handler) {
    this.store.emitter.on(type, handler);
    return this;
  }

  off<T = any>(type: EventType, handler: Handler<T>): Meta2d;
  off(type: '*', handler: WildcardHandler): Meta2d;
  off(type: EventType | '*', handler: WildcardHandler | Handler) {
    this.store.emitter.off(type, handler);
    return this;
  }

  register = register;

  registerCanvasDraw = registerCanvasDraw;

  registerAnchors = registerAnchors;

  registerLineAnimateDraws = (name,drawFunc)=>{
    this.store.data.lineAnimateDraws[name] = drawFunc;
    // 同步到store
    // @ts-ignore
    globalStore.lineAnimateDraws[name] = new Function('ctx','pen','state','index',drawFunc);
  }
  updateLineAnimateDraws(name,option){// option: {name:'xxx',code:'xxx'}
    if(!option)return

    delete this.store.data.lineAnimateDraws[name];
    delete globalStore.lineAnimateDraws[name];

    if(option === -1) { // -1 表示删除
      return;
    }
    this.registerLineAnimateDraws(option.name || name,option.code);
  }

  // customeDock = (store, rect, pens, offset) => {xDock, yDock}
  // customDock return:
  // {
  //   xDock: {x, y, step, prev, penId},
  //   yDock: {x, y, step, prev, penId},
  // }
  // xDock，yDock - 水平或垂直方向的参考线
  // prev - 参考线的起点
  // x,y - 参考线的终点
  // step - 自动吸附需要的偏移量
  // penId - 参考线的笔
  registerMoveDock(
    dock: (
      store: Meta2dStore,
      rect: Rect,
      pens: Pen[],
      offset: Point
    ) => { xDock: Point; yDock: Point }
  ) {
    this.canvas.customMoveDock = dock;
  }

  /**
   * 参数同方法 registerMoveDock ，最后一个参数由 offset 偏移修改成了当前 resize 的点
   */
  registerResizeDock(
    dock: (
      store: Meta2dStore,
      rect: Rect,
      pens: Pen[],
      resizeIndex: number
    ) => { xDock: Point; yDock: Point }
  ) {
    this.canvas.customResizeDock = dock;
  }

  find(id: string): Pen[];
  find(tag: string): Pen[];
  find(idOrTag: string): Pen[] {
    return this.canvas.find(idOrTag);
  }

  /**
   * 使用 Array.find 找到即返回，否则返回 undefined
   */
  findOne(id: string): Pen | undefined;
  findOne(tag: string): Pen | undefined;
  findOne(idOrTag: string): Pen | undefined {
    return this.canvas.findOne(idOrTag);
  }

  getPenRect(pen: Pen) {
    return this.canvas.getPenRect(pen);
  }

  setPenRect(pen: Pen, rect: Rect, render = true) {
    this.canvas.setPenRect(pen, rect, render);
  }

  startAnimate(idOrTagOrPens?: string | Pen[], params?: number | string): void {
    this.stopAnimate(idOrTagOrPens);
    let pens: Pen[];
    // 没有参数 则播放有自动播放属性的动画
    if (!idOrTagOrPens) {
      pens = this.store.data.pens.filter((pen) => {
        return (
          ((pen.type || pen.frames) && pen.autoPlay) ||
          (pen.animations &&
            pen.animations.length &&
            pen.animations.findIndex((i) => i.autoPlay) !== -1)
        );
      });
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else {
      pens = idOrTagOrPens;
    }
    if (!pens.length) {
      return;
    }
    pens.forEach((pen) => {
      if (pen.calculative.pause) {
        const d = Date.now() - pen.calculative.pause;
        pen.calculative.pause = undefined;
        pen.calculative.frameStart += d;
        pen.calculative.frameEnd += d;
      } else {
        let index = -1;
        if (params !== undefined && pen.animations) {
          if (typeof params === 'string') {
            index = pen.animations.findIndex(
              (animation) => animation.name === params
            );
            if (index === -1) {
              return;
            }
          } else if (typeof params === 'number') {
            if (pen.animations.length > params) {
              index = params;
            } else {
              return;
            }
          }
        } else if (params === undefined) {
          index = pen.animations?.findIndex((i) => i.autoPlay);
          if (index === -1 && pen.animations?.length) {
            //默认执行第0个动画
            index = 0;
          }
        }
        if (index !== -1 && index !== undefined) {
          const animate = deepClone(pen.animations[index]);
          animate.animateName = animate.name;
          delete animate.name;
          animate.currentAnimation = index;
          if (!pen.type && animate.frames) {
            animate.showDuration = this.calcAnimateDuration(animate);
          }
          //animations成立
          this.setValue(
            {
              id: pen.id,
              ...animate,
            },
            {
              doEvent: false,
              history: false,
            }
          );
        }
        this.store.animates.add(pen);
        if (!pen.type) {
          this.store.animateMap.set(
            pen,
            pen.calculative.canvas.getFrameProps(pen)
          );
        }
      }
    });
    // this.canvas.canvasImage.init();
    // this.canvas.canvasImageBottom.init();
    this.initImageCanvas(pens);
    this.canvas.animate();
  }

  pauseAnimate(idOrTagOrPens?: string | Pen[]) {
    let pens: Pen[] = [];
    if (!idOrTagOrPens) {
      this.store.animates.forEach((pen) => {
        pens.push(pen);
      });
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else {
      pens = idOrTagOrPens;
    }
    pens.forEach((pen) => {
      if (!pen.calculative.pause) {
        pen.calculative.pause = Date.now();
      }
    });
  }

  stopAnimate(idOrTagOrPens?: string | Pen[]) {
    let pens: Pen[] = [];
    if (!idOrTagOrPens) {
      this.store.animates.forEach((pen) => {
        pens.push(pen);
      });
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else {
      pens = idOrTagOrPens;
    }
    pens.forEach((pen) => {
      pen.currentAnimation = undefined;
      pen.calculative.pause = undefined;
      pen.calculative.start = undefined;
      pen.calculative.cycleStart = undefined;
      pen.calculative.duration = undefined;
      pen.calculative.animatePos = 0;
      this.store.animates.delete(pen);
      this.canvas.restoreNodeAnimate(pen);
      this.canvas.updateLines(pen);
      this.store.animateMap.delete(pen);
    });
    this.initImageCanvas(pens);
    if(this.store.data.locked === LockState.None){
      setTimeout(() => {
        this.canvas?.calcActiveRect();
        this.render();
      }, 20);
    }
  }

  startVideo(idOrTagOrPens?: string | Pen[]): void {
    let pens: Pen[];
    if (!idOrTagOrPens) {
      pens = this.store.data.pens.filter((pen) => {
        return (pen.video || pen.audio) && pen.autoPlay;
      });
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else {
      pens = idOrTagOrPens;
    }
    pens.forEach((pen) => {
      pen.calculative.media?.play();
      pen.onStartVideo?.(pen);
    });
  }

  pauseVideo(idOrTagOrPens?: string | Pen[]) {
    let pens: Pen[] = [];
    if (!idOrTagOrPens) {
      //TODO 寻找所有 而不是正在播放的
      pens = this.store.data.pens.filter((pen) => {
        return (pen.video || pen.audio) && pen.autoPlay;
      });
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else {
      pens = idOrTagOrPens;
    }
    pens.forEach((pen) => {
      pen.calculative.media?.pause();
      pen.onPauseVideo?.(pen);
    });
  }

  stopVideo(idOrTagOrPens?: string | Pen[]) {
    let pens: Pen[] = [];
    if (!idOrTagOrPens) {
      pens = this.store.data.pens.filter((pen) => {
        return (pen.video || pen.audio) && pen.autoPlay;
      });
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else {
      pens = idOrTagOrPens;
    }

    pens.forEach((pen) => {
      if (pen.calculative.media) {
        pen.calculative.media.currentTime = 0;
        pen.calculative.media.pause();
      }
      pen.onStopVideo?.(pen);
    });
  }

  calcAnimateDuration(pen: Pen) {
    return pen.frames.reduce((prev, frame) => prev + frame.duration, 0);
  }

  /**
   * 组合
   * @param pens 组合的画笔们
   * @param showChild 组合后展示第几个孩子
   * @param active 是否激活组合后的画笔
   */
  combine(pens: Pen[] = this.store.active, showChild?: number, active = true): any {
    if (!pens || !pens.length) {
      return;
    }

    const initPens = deepClone(pens);
    if (pens.length === 1 && pens[0].type) {
      pens[0].type = PenType.Node;
      this.canvas.active(pens);
      this.pushHistory({
        type: EditType.Update,
        initPens,
        pens: deepClone(pens, true),
      });
      this.render();
      return;
    }

    const rect = getRect(pens);
    let parent: Pen = {
      id: s8(),
      name: 'combine',
      ...rect,
      children: [],
      showChild,
    };
    // const p = pens.find((pen) => {
    //   // TODO: js 计算误差，可能导致包含着其它的 pens 的最大 pen 无法计算出来
    //   return pen.width === rect.width && pen.height === rect.height;
    // });
    // // 其中一个认为是父节点
    // const oneIsParent = p && showChild == undefined;
    // if (oneIsParent) {
    //   if (!p.children) {
    //     p.children = [];
    //   }
    //   parent = p;
    // } else {
    // 若组合为状态，那么 parent 一定是 combine
    this.canvas.makePen(parent);
    // }
    const initParent = deepClone(parent);
    let minIndex = Infinity;
    pens.forEach((pen) => {
      const index = this.store.data.pens.findIndex(
        (_pen) => _pen.id === pen.id
      );
      if (index < minIndex) {
        minIndex = index;
      }
      if (
        pen === parent ||
        pen.parentId === parent.id ||
        pen.id === parent.id
      ) {
        return;
      }
      // pen 来自于 store.active ，不存在有 parentId 的情况
      parent.children.push(pen.id);
      pen.parentId = parent.id;
      const childRect = calcRelativeRect(pen.calculative.worldRect, rect);
      Object.assign(pen, childRect);
      pen.locked = pen.lockedOnCombine ?? LockState.None;
      pen.locked =
        pen.interaction || isInteraction.includes(pen.name) ? 0 : pen.locked;
    });
    //将组合后的父节点置底
    this.store.data.pens.splice(minIndex, 0, parent);
    this.store.data.pens.pop();
    active && this.canvas.active([parent]);
    let step = 1;
    // if (!oneIsParent) {
    //   step = 2;
    //   this.pushHistory({
    //     type: EditType.Add,
    //     pens: [parent],
    //     step,
    //   });
    //   this.store.emitter.emit('add', [parent]);
    // }
    this.pushHistory({
      type: EditType.Add,
      pens: [initParent],
      step: 3,
    });
    this.pushHistory({
      type: EditType.Update,
      initPens: [initParent],
      pens: [parent],
      step: 3,
    });
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
      step: 3,
    });
    if (showChild != undefined) {
      pens.forEach((pen) => {
        calcInView(pen, true);
      });
      this.initImageCanvas([parent]);
    }
    this.store.emitter.emit('combine', [parent]);
    this.render();
    return parent;
  }

  uncombine(pen?: Pen) {
    if (!pen && this.store.active) {
      pen = this.store.active[0];
    }
    if (!pen || !pen.children) {
      return;
    }

    const children = pen.children.map((childId) => this.store.pens[childId]);
    let initPens = deepClone(children);
    children.forEach((child) => {
      child.parentId = undefined;
      child.x = child.calculative.worldRect.x;
      child.y = child.calculative.worldRect.y;
      child.width = child.calculative.worldRect.width;
      child.height = child.calculative.worldRect.height;
      child.locked = LockState.None;
      child.calculative.active = undefined;
      child.calculative.hover = false;
      this.setVisible(child, true); // 子节点的 visible 属性已经改变，需要恢复
    });
    const step = this.isCombine(pen) ? 3 : 2;
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens: children,
      step,
    });
    initPens = [deepClone(pen)];
    this.inactive();
    pen.children = undefined;
    // 保存修改 children 的历史记录
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens: [pen],
      step,
    });
    if (this.isCombine(pen)) {
      this.delete([pen]);
      // delete 会记录 history , 更改 step 即可
      this.store.histories[this.store.histories.length - 1].step = step;
    }
  }

  clearCombine(pen?: Pen) {
    if (!pen && this.store.active) {
      pen = this.store.active[0];
    }
    if (!pen || !pen.children) {
      return;
    }
    const children = getAllChildren(pen,this.store);
    children.forEach((child) => {
      child.parentId = undefined;
      child.x = child.calculative.worldRect.x;
      child.y = child.calculative.worldRect.y;
      child.width = child.calculative.worldRect.width;
      child.height = child.calculative.worldRect.height;
      child.locked = LockState.None;
      child.calculative.active = undefined;
      child.calculative.hover = false;
      if(child.showChild !== undefined){
        this.setVisible(child, true);
      }
      child.children = undefined;
    });
    const combineArr = [];
    children.forEach((child,index)=>{
      if(child.name === 'combine'){
        child.children = undefined;
        combineArr.push(child);
      }
    });
    this.delete(combineArr,true,false);
    pen.children = undefined;
    if (this.isCombine(pen)) {
      this.delete([pen],true,false);
    }
    //未考虑历史记录
    this.inactive();
  }

  appendChild(pens: Pen[] = this.store.active) {
    if (!pens) {
      return;
    }
    if (pens.length < 2) {
      return;
    }
    const pIdx = pens.findIndex(
      (pen) => pen.name === 'combine' && pen.showChild !== undefined
    );
    if (pIdx !== -1) {
      let parent = pens[pIdx];
      // this.pushChildren(parent,[...pens.slice(0, pIdx), ...pens.slice(pIdx + 1)]);
      const rect = getRect(pens);
      Object.assign(parent, rect);
      Object.assign(parent.calculative.worldRect, rect);
      calcWorldAnchors(parent);
      parent.children.forEach((penId) => {
        const pen = this.store.pens[penId];
        const childRect = calcRelativeRect(pen.calculative.worldRect, rect);
        Object.assign(pen, childRect);
      });
      pens.forEach((pen) => {
        if (pen.id !== parent.id) {
          parent.children.push(pen.id);
          pen.parentId = parent.id;
          const childRect = calcRelativeRect(pen.calculative.worldRect, rect);
          Object.assign(pen, childRect);
          pen.locked = pen.lockedOnCombine ?? LockState.DisableMove;
          pen.locked =
            pen.interaction || isInteraction.includes(pen.name)
              ? 0
              : pen.locked;
          calcInView(pen, true);
        }
      });
      this.initImageCanvas(pens);
      this.render();
    } else {
      console.warn('Invalid operation!');
    }
  }

  /***
   * 修改子图元大小，更新整个组合图元
   * @param rect 新的大小 世界坐标
   * @param child 待更新子图元
   * @param parent 父图元
   */
  updateRectbyChild(rect: Rect, child: Pen, parent: Pen) {
    calcRightBottom(rect);
    calcCenter(rect);
    child.calculative.worldRect = rect;
    if (parent.container && rectInRect(rect, parent.calculative.worldRect, true)) {//取所有图元的范围
      const childRect = calcRelativeRect(rect, parent.calculative.worldRect);
      Object.assign(child, childRect);
    } else {
      if(parent.container) {//容器模式取操作过程中最大范围
        let x = Math.min(rect.x, parent.calculative.worldRect.x);
        let y = Math.min(rect.y, parent.calculative.worldRect.y);
        let ex = Math.max(rect.ex, parent.calculative.worldRect.ex);
        let ey = Math.max(rect.ey, parent.calculative.worldRect.ey);
        parent.calculative.worldRect = {
          x: x,
          y: y,
          width: ex - x,
          height: ey - y,
          ex,
          ey,
        };
        calcCenter(parent.calculative.worldRect);
      } else {//取所有图元的范围
        const pens = parent.children.map((cid) => this.store.pens[cid]);
        parent.calculative.worldRect = getRect(pens);
      }
      if (!parent.parentId) {
        Object.assign(parent, parent.calculative.worldRect);
      }
      parent.children.forEach((cid) => {
        const cPen = this.store.pens[cid];
        const childRect = calcRelativeRect(
          cPen.calculative.worldRect,
          parent.calculative.worldRect
        );
        Object.assign(cPen, childRect);
      });
      if (parent.parentId) {
        this.updateRectbyChild(
          parent.calculative.worldRect,
          parent,
          this.store.pens[parent.parentId]
        );
      }
    }
    this.canvas.updatePenRect(parent);
    this.render();
  }

  isCombine(pen: Pen) {
    if (pen.name === 'combine') {
      return true;
    }
    if (pen.children && pen.children.length > 0) {
      return true;
    }
    return false;
  }

  active(pens: Pen[], emit = true) {
    this.canvas.active(pens, emit);
  }

  inactive() {
    this.canvas.inactive();
  }

  activeAll() {
    this.canvas.active(
      this.store.data.pens.filter(
        (pen) => !pen.parentId && pen.locked !== LockState.Disable
      )
    );
    this.render();
  }

  focus(id: string) {
    const pen = this.findOne(id);
    if (pen) {
      this.store.hover = pen;
      this.store.hover.calculative.hover = true;
      this.showInput(pen);
    }
  }
  /**
   * 删除画笔
   * @param pens 需要删除的画笔们
   * @param canDelLocked 是否删除已经锁住的画笔
   */
  delete(pens?: Pen[], canDelLocked = false, history = true) {
    this.canvas.delete(pens, canDelLocked, history);
  }
  deleteSync(pens?: Pen[], canDelLocked = false, history = true) {
    this.canvas.deleteSync(pens, canDelLocked, history);
  }

  scale(scale: number, center = { x: 0, y: 0 }) {
    this.canvas.scale(scale, center);
  }

  translate(x: number, y: number) {
    this.canvas.translate(x, y);
  }

  translatePens(pens: Pen[], x: number, y: number) {
    this.canvas.translatePens(pens, x, y);
  }

  getParent(pen: Pen, root?: boolean) {
    return getParent(pen, root);
  }

  getAllChildren(pen: Pen) {
    return getAllChildren(pen, this.store);
  }

  getAllFollowers(pen: Pen) {
    return getAllFollowers(pen, this.store);
  }

  data(): Meta2dData {
    this.initBinds();
    const data: Meta2dData = deepClone(this.store.data);
    const { pens, paths } = this.store.data;
    data.version = pkg.version;
    // TODO: 未在 delete 时清除，避免撤销等操作。
    // 清除一些未使用到的 paths
    data.paths = {};
    for (const pathId in paths) {
      if (Object.prototype.hasOwnProperty.call(paths, pathId)) {
        if (pens.find((pen) => pen.pathId === pathId)) {
          data.paths[pathId] = paths[pathId];
        }
      }
    }
    data.dataPoints = [
      ...Object.keys(this.store.bind),
      ...Object.keys(this.store.bindDatas),
    ];
    return data;
  }

  copy(pens?: Pen[]) {
    this.canvas.copy(pens);
  }

  cut(pens?: Pen[]) {
    this.canvas.cut(pens);
  }

  paste() {
    this.canvas.paste();
  }

  undo() {
    this.canvas.undo();
  }

  redo() {
    this.canvas.redo();
  }

  listenSocket() {
    try {
      let socketFn: (
        e: string,
        context?: {
          meta2d?: Meta2d;
          type?: string;
          topic?: string;
          url?: string;
        }
      ) => boolean;
      const socketCbJs = this.store.data.socketCbJs;
      if (socketCbJs) {
        socketFn = new Function('e', 'context', socketCbJs) as (
          e: string,
          context?: {
            meta2d?: Meta2d;
            type?: string;
            topic?: string;
            url?: string;
          }
        ) => boolean;
      }
      if (!socketFn) {
        this.socketFn = null;
        return false;
      }
      this.socketFn = socketFn;
    } catch (e) {
      console.error('Create the function for socket:', e);
      return false;
    }

    return true;
  }

  websocketTimes = 0;
  connectWebsocket(websocket?: string) {
    this.closeWebsocket();
    if (websocket) {
      this.store.data.websocket = websocket;
    }
    if (this.store.data.websocket) {
      this.websocket = new WebSocket(
        this.store.data.websocket,
        this.store.data.websocketProtocols || undefined
      );
      this.websocket.onmessage = (e) => {
        this.socketCallback(e.data, {
          type: 'websocket',
          url: this.store.data.websocket,
        });
      };

      this.websocket.onerror = (error) => {
        this.store.emitter.emit('error', { type: 'websocket', error });
      };

      this.websocket.onclose = () => {
        if (this.store.options.reconnetTimes) {
          this.websocketTimes++;
          if (this.websocketTimes >= this.store.options.reconnetTimes) {
            this.websocketTimes = 0;
            this.closeWebsocket();
            return;
          }
        }
        console.info('Canvas websocket closed and reconneting...');
        this.connectWebsocket();
      };
    }
  }

  closeWebsocket() {
    if (this.websocket) {
      this.websocket.onclose = undefined;
      this.websocket.close();
      this.websocket = undefined;
    }
  }

  mqttTimes = 0;
  connectMqtt(params?: {
    mqtt: string;
    mqttTopics: string;
    mqttOptions?: {
      clientId?: string;
      username?: string;
      password?: string;
      customClientId?: boolean;
    };
  }) {
    this.closeMqtt();
    if (params) {
      this.store.data.mqtt = params.mqtt;
      this.store.data.mqttTopics = params.mqttTopics;
      this.store.data.mqttOptions = params.mqttOptions;
    }
    if (this.store.data.mqtt) {
      if (
        this.store.data.mqttOptions.clientId &&
        !this.store.data.mqttOptions.customClientId
      ) {
        this.store.data.mqttOptions.clientId = s8();
      }
      const mqttOptions = { ...this.store.data.mqttOptions };
      // 如果没有username/password或为空字符串则删除username/password
      if (!mqttOptions.username) {
        delete mqttOptions.username;
      }
      if (!mqttOptions.password) {
        delete mqttOptions.password;
      }
      const { username, password } = mqttOptions;
      // username 和 password 必须同时存在或者同时不存在才去建立mqtt连接
      if ((username && password) || (!username && !password)) {
        this.mqttClient = mqtt.connect(this.store.data.mqtt, mqttOptions);
        this.mqttClient.on('message', (topic: string, message: Buffer) => {
          this.socketCallback(message.toString(), {
            topic,
            type: 'mqtt',
            url: this.store.data.mqtt,
          });
        });

        this.mqttClient.on('error', (error) => {
          this.store.emitter.emit('error', { type: 'mqtt', error });
        });

        this.mqttClient.on('close', () => {
          if (this.store.options.reconnetTimes) {
            this.mqttTimes++;
            if (this.mqttTimes >= this.store.options.reconnetTimes) {
              this.mqttTimes = 0;
              this.closeMqtt();
            }
          }
        });

        if (this.store.data.mqttTopics) {
          this.mqttClient.subscribe(this.store.data.mqttTopics.split(','));
        }
      } else {
        console.warn('缺少用户名或密码');
      }
    }
  }

  closeMqtt() {
    this.mqttClient?.end();
  }

  httpTimer: any;
  httpTimerList: any[] = [];
  connectHttp() {
    this.closeHttp();
    const { https } = this.store.data;
    if (https) {
      if (!this.store.data.cancelFirstConnect) {
        https.forEach(async (item) => {
          this.oldRequestHttp(item);
        });
      }
      https.forEach((item, index) => {
        if (item.http && item.httpTimeInterval !== 0) {
          item.times = 0;
          this.httpTimerList[index] = setInterval(async () => {
            // 默认每一秒请求一次
            this.oldRequestHttp(item);
            if (this.store.options.reconnetTimes) {
              // item.times++;
              if (item.times >= this.store.options.reconnetTimes) {
                item.times = 0;
                clearInterval(this.httpTimerList[index]);
                this.httpTimerList[index] = undefined;
              }
            }
          }, item.httpTimeInterval || 1000);
        }
      });
    } else {
      const { http, httpTimeInterval, httpHeaders } = this.store.data;
      if (http) {
        this.httpTimer = setInterval(async () => {
          // 默认每一秒请求一次
          const res: Response = await fetch(http, {
            headers: httpHeaders,
          });
          if (res.ok) {
            const data = await res.text();
            this.socketCallback(data, { type: 'http', url: http });
          }
        }, httpTimeInterval || 1000);
      }
    }
  }

  async oldRequestHttp(_req: HttpOptions) {
    let req = deepClone(_req);
    if (req.http) {
      const res: Response = await fetch(req.http, {
        headers: req.httpHeaders,
        method: req.method || 'GET',
        body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
      });
      if (res.ok) {
        const data = await res.text();
        this.socketCallback(data, { type: 'http', url: req.http });
      } else {
        _req.times++;
        this.store.emitter.emit('error', { type: 'http', error: res });
      }
    }
  }

  async sendDatabyHttp(data: string) {
    const { https } = this.store.data;
    if (https) {
      https.forEach(async (item) => {
        if (item.http) {
          const res: Response = await fetch(item.http, {
            method: 'post',
            body: data,
            headers: item.httpHeaders,
          });
          if (res.ok) {
            console.info('http消息发送成功');
          }
        }
      });
    } else {
      const { http, httpHeaders } = this.store.data;
      if (http) {
        // 默认每一秒请求一次
        const res: Response = await fetch(http, {
          method: 'post',
          body: data,
          headers: httpHeaders,
        });
        if (res.ok) {
          console.info('http消息发送成功');
        }
      }
    }
  }

  closeHttp() {
    clearInterval(this.httpTimer);
    this.httpTimer = undefined;
    this.httpTimerList &&
      this.httpTimerList.forEach((_httpTimer) => {
        clearInterval(_httpTimer);
        _httpTimer = undefined;
      });
  }

  updateTimer: any;
  updateTimerList: any[] = [];
  sqlTimerList: any[] = [];
  connectNetwork() {
    this.closeNetwork();
    const { networks } = this.store.data;
    const https = [];
    if (networks) {
      let mqttIndex = 0, httpIndex = 0, websocketIndex = 0, sseIndex = 0;
      this.mqttClients = [];
      this.websockets = [];
      this.eventSources = [];
      networks.forEach(async (net) => {
        // if (net.type === 'subscribe') {
        if (net.protocol === 'mqtt') {
          net.index = mqttIndex;
          this.connectNetMqtt(net);
          mqttIndex += 1;
        } else if (net.protocol === 'websocket') {
          net.index = websocketIndex;
          this.connectNetWebSocket(net);
          // this.websockets[websocketIndex] = new WebSocket(
          //   net.url,
          //   net.protocols || undefined
          // );
          // this.websockets[websocketIndex].onmessage = (e) => {
          //   this.socketCallback(e.data, { type: 'websocket', url: net.url });
          // };
          // this.websockets[websocketIndex].onerror = (error) => {
          //   this.store.emitter.emit('error', { type: 'websocket', error });
          // };
          // this.websockets[websocketIndex].onclose = () => {
          //   if (this.store.options.reconnetTimes) {
          //     net.times++;
          //     if (net.times >= this.store.options.reconnetTimes) {
          //       net.times = 0;
          //       this.websockets[net.index]?.close();
          //       return;
          //     }
          //   }
          // console.info('Canvas websocket closed and reconneting...');
          // };

          websocketIndex += 1;
        } else if (net.protocol === 'http') {
          net.index = httpIndex;
          https.push({
            url: net.url,
            interval: net.interval,
            headers: net.headers || undefined,
            method: net.method,
            body: net.body,
            enable: net.enable,
            index: net.index,
            once: net.once,
          });
          httpIndex += 1;
        }else if (net.protocol === 'ADIIOT') {
          connectJetLinks(this,net);
        }else if (net.protocol === 'SSE'){
          net.index = sseIndex;
          this.connectSSE(net);
          sseIndex += 1;
        }
      });
    }
    this.onNetworkConnect(https);
    this.connectIot();
    this.connectSqls();
  }

  reconnectNetwork(index:number){
    const net = this.store.data.networks[index];
    if (net.protocol === 'mqtt') {
      this.mqttClients && this.mqttClients[net.index]?.end();
      this.connectNetMqtt(net);
    } else if (net.protocol === 'websocket') {
      if(this.websockets && this.websockets[net.index]){
        this.websockets[net.index].onclose = undefined;
        this.websockets[net.index].close();
        this.websockets[net.index] = undefined;
      }
      this.connectNetWebSocket(net);
    }else if(net.protocol === 'http'){
      if(this.updateTimerList){
        clearInterval(this.updateTimerList[net.index]);
        this.updateTimerList[net.index] = undefined;
      }
      const http = deepClone(net);
      if (!this.store.data.cancelFirstConnect) {
        this.requestHttp(http);
      }
      if(net.interval !== 0){
        this.updateTimerList[net.index] = setInterval(async () => {
          this.requestHttp(http);
        }, http.interval || 1000);
      }
    }else if(net.protocol === 'SSE'){
      if(this.eventSources){
        this.eventSources[net.index]?.close();
        this.eventSources[net.index] = undefined;
      }
      this.connectSSE(net);
    }
  }

  iotMqttClient:MqttClient;
  iotTimer: any;
  iotWebsocketClient:WebSocket;
  async connectIot(){
    const { iot } = this.store.data;
    if(!(iot&&iot?.devices?.length)||(iot&&iot.enable === false)){
      return;
    }
    const url =  globalThis.iotUrl || await this.getMqttUrl();
    if(!url){
      console.warn('iot Request address error')
      return;
    }
    const token = await this.getIotToken(iot.devices,iot.protocol==='websocket'?1:undefined);
    iot.token = token;
    //物联网设备
    // if(iot.protocol === 'mqtt'){
      // const url ='ws://192.168.110.148:8083/mqtt'; //`${location.protocol === 'https:'?'wss':'ws'}://${iot.host}:${location.protocol === 'https:'?'8084':'8083'}/mqtt`
      this.iotMqttClient = mqtt.connect(url);
      this.iotMqttClient.on('message', (topic: string, message: Buffer) => {
        this.socketCallback(message.toString(), {
          topic:`le5le-iot/properties/${token}`,
          type: 'iot',
          url,
          method: 'mqtt'
        });
      })
      this.iotMqttClient.on('error', (error) => {
        this.store.emitter.emit('error', { type: 'mqtt', error });
      });
      this.iotMqttClient.subscribe(`le5le-iot/properties/${token}`);
      this.iotTimer = setInterval(()=>{
        this.iotMqttClient && this.iotMqttClient.publish(`le5le-iot/subscribe/ping`, token);
      },300000);
    // }else if(iot.protocol === 'websocket'){
    //   const url = 'ws://192.168.110.6/api/ws/iot/properties'// `${location.protocol === 'https:'?'wss':'ws'}://${location.host}/api/ws/iot/properties`
    //   this.iotWebsocketClient = new WebSocket(
    //     url,
    //     token
    //   );
    //   this.iotWebsocketClient.onmessage = (e) => {
    //     this.socketCallback(e.data, { type: 'iot', method: 'websocket' });
    //   };
    //   this.iotWebsocketClient.onerror = (error) => {
    //     this.store.emitter.emit('error', { type: 'websocket', error });
    //   };
    // }
  }

  closeIot(){
    if(this.iotMqttClient){
      const { iot } = this.store.data;
      if(iot?.token){
        this.unsubscribeIot(iot.token);
      }
      this.iotMqttClient.end();
      this.iotMqttClient = undefined;
    }
    clearInterval(this.iotTimer);
    this.iotTimer = undefined;
  }
  //  type SqlType = 'list' | 'get' | 'exec' | 'add' | 'update' | 'delete';

  connectSqls(){
    const { sqls } = this.store.data;
    if(sqls&&sqls.length){
      // let sqlIndex = 0;
      sqls.forEach( async(sql, index)=>{
        if(sql.enable !== false){
          await this.doSqlCode(sql);
          if(sql.interval){
            sql.index = index;
            this.sqlTimerList[index] = setInterval(async () => {
              await this.doSqlCode(sql);
            }, sql.interval);
            // index += 1;
          }
        }
      })
    }
  }

  connectSSE(net:Network){
    if(net.enable === false){
      return;
    }
    this.eventSources[net.index] = new EventSource(net.url,{withCredentials:net.withCredentials});
    this.eventSources[net.index].onmessage = (e) => {
      this.socketCallback(e.data, { type: 'SSE', url: net.url, name:net.name, net });
    };
    this.eventSources[net.index].onerror = (error) => {
      this.store.emitter.emit('error', { type: 'SSE', error });
    };
  }

  closeSSE(){
    this.eventSources &&
    this.eventSources.forEach((es) => {
      if (es) {
        es.close();
        es = undefined;
      }
    });
  }

  connectNetMqtt(net:Network){
    if(net.enable === false){
      return;
    }
    if (net.options.clientId && !net.options.customClientId) {
      net.options.clientId = s8();
    }
    let url = net.url;
    if(url.indexOf('${') > -1){
      let keys = url.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
      if (keys) {
        keys.forEach((key) => {
          url = url.replace(
            `\${${key}}`,this.getDynamicParam(key)
          );
        });
      }
    }
    net.times = 0;
    let options = deepClone(net.options);
    if(options?.username&&options.username.includes('${')){
      let keys = options.username.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
      if (keys) {
        keys.forEach((key) => {
          options.username = options.username.replace(
            `\${${key}}`,this.getDynamicParam(key)
          );
        });
      }
    }
    if(options?.password&&options.password.includes('${')){
      let keys = options.password.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
      if (keys) {
        keys.forEach((key) => {
          options.password = options.password.replace(
            `\${${key}}`,this.getDynamicParam(key)
          );
        });
      }
    }
    // 稳定连接配置
    if(!options.hasOwnProperty("keepalive")){
      Object.assign(options,{keepallive: 30});
    }
    //  clean为false 时，clientId 是必填项
    // if(options.clientId && !options.hasOwnProperty("clean")){
    //   Object.assign(options,{clean: false});
    // }
    if(!options.hasOwnProperty("reconnectPeriod")){
      Object.assign(options,{reconnectPeriod: 5000});
    }
    if(!options.hasOwnProperty("connectTimeout")){
      Object.assign(options,{connectTimeout: 10 * 1000});
    }
    this.mqttClients[net.index] = mqtt.connect(url, options);
    this.mqttClients[net.index].on(
      'message',
      (topic: string, message: Buffer) => {
        this.socketCallback(message.toString(), {
          topic,
          type: 'mqtt',
          url: net.url,
          name: net.name,
          net
        });
      }
    );
    this.mqttClients[net.index].on('error', (error) => {
      this.store.emitter.emit('error', { type: 'mqtt', error });
    });
    //mqtt 默认重连配置 reconnectPeriod
    // let reconnectDelay = 1000;
    // this.mqttClients[net.index].on('close', () => {
    //   if (this.store.options.reconnetTimes) {
    //     net.times++;
    //     if (net.times >= this.store.options.reconnetTimes) {
    //       net.times = 0;
    //       this.mqttClients && this.mqttClients[net.index]?.end();
    //     }
    //     setTimeout(()=>{
    //       if (net.times < this.store.options.reconnetTimes) {
    //         this.mqttClients[net.index].reconnect(options as any);
    //         reconnectDelay = Math.min(reconnectDelay * 2, 10 * 1000);
    //       }
    //     },reconnectDelay)
    //   }
    // });
    this.mqttClients[net.index].on('connect', (connack) => {
      // reconnectDelay = 1000;

      if (!connack.sessionPresent) {
        // 创建了新会话或没有找到旧会话，需要重新订阅主题
        if (net.topics) {
          let topics = net.topics;
          if(topics.indexOf('${') > -1){
            let keys = topics.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
            if (keys) {
              keys.forEach((key) => {
                topics = topics.replace(
                  `\${${key}}`,this.getDynamicParam(key)
                );
              });
            }
          }
          // QoS=1 是 MQTT 中最常用的级别，它能在保证大部分消息可靠传递
          this.mqttClients[net.index].subscribe(topics.split(','),{ qos: 1 },(err)=>{
            if(err) console.error("订阅失败：",err);
          });
        }
      } else {
        //已恢复之前的会话，可以接收离线消息，不需要重新订阅，之前的订阅已恢复
      }
    })
  }

  connectNetWebSocket(net: Network) {
    if (this.websockets[net.index]) {
      this.websockets[net.index].onclose = undefined;
      this.websockets[net.index]?.close();
      this.websockets[net.index] = undefined;
    }
    if(net.enable === false ){
      return;
    }
    let url = net.url;
    if(url.indexOf('${') > -1){
      let keys = url.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
      if (keys) {
        keys.forEach((key) => {
          url = url.replace(
            `\${${key}}`,this.getDynamicParam(key)
          );
        });
      }
    }
    this.websockets[net.index] = new WebSocket(
      url,
      net.protocols || undefined
    );
    this.websockets[net.index].onmessage = (e) => {
      this.socketCallback(e.data, { type: 'websocket', url: net.url, name:net.name, net });
    };
    this.websockets[net.index].onerror = (error) => {
      this.store.emitter.emit('error', { type: 'websocket', error });
    };
    this.websockets[net.index].onclose = () => {
      if (this.store.options.reconnetTimes) {
        net.times++;
        if (net.times >= this.store.options.reconnetTimes) {
          net.times = 0;
          this.websockets[net.index].onclose = undefined;
          this.websockets[net.index]?.close();
          this.websockets[net.index] = undefined;
          return;
        }
      }
      setTimeout(() => {
        console.info('Canvas websocket closed and reconneting...');
        this.connectNetWebSocket(net);
      }, 2000);
    };
  }

  async getMqttUrl(){
    const res: Response = await fetch('/api/iot/app/mqtt', {
      method: 'GET',
      headers: {
        Authorization: getToken(),
      },
    });
    if (res.ok) {
      const data = await res.text();
      let results = JSON.parse(data);
      let port = results.wssPort||results.wsPort;
      if(!port){
        return
      }
      return `${location.protocol === 'https:'?'wss':'ws'}://${results.host}:${location.protocol === 'https:'?results.wssPort:results.wsPort}${results.path}`
    }
  }

  async getIotToken(devices:any, type:number){
    const res: Response = await fetch('/api/iot/subscribe/properties', {
      method: 'POST',
      headers: {
        Authorization: getToken(),
      },
      body:JSON.stringify({devices: devices,type}),
    });
    if (res.ok) {
      const data = await res.text();
      return JSON.parse(data).token;
    }
  }

  async unsubscribeIot(token:string){
    const ret:any = await fetch(`/api/iot/unsubscribe/properties`,{
      method: 'POST',
      headers: {
        Authorization: getToken(),
      },
      body:JSON.stringify({token}),
    });
    return ret;
  }

  async doSqlCode(sql:Sql){
    const method = sql.method || 'get';
    let _sql = sql.sql;
    if(method === 'list'){
      // _sql+= ` LIMIT ${sql.pageSize||20}`+(sql.current>1?(' OFFSET '+(sql.current-1)*sql.pageSize):'');
      if(sql.pageSize !== -1){
        if(sql.dbType==="oracle"){
          if(!_sql.includes('OFFSET')){
            _sql+= ` OFFSET ${((sql.current||1)-1)*(sql.pageSize||20)} ROWS FETCH NEXT ${sql.pageSize||20} ROWS ONLY`
          }
        }else{
          if(!_sql.includes('LIMIT')){
            _sql+= ` LIMIT ${sql.pageSize||20}`+(sql.current>1?(' OFFSET '+(sql.current-1)*(sql.pageSize||20)):'');
          }
        }
      }
    }
    const res: Response = await fetch( `/api/iot/data/sql/${method}`, {
      method: 'POST',
      headers:{
         Authorization: getToken(),
      },
      body:JSON.stringify({ dbId:sql.dbId||(sql as any).dbid,sql:_sql,}),
    });
    if (res.ok) {
      let data:any = await res.text();
      if(data){
        const arr = [];
        data = JSON.parse(data);
        if(data.error){
          this.store.emitter.emit('error', { type: 'sql', error: data.error });
          return;
        }
        sql.keys?.forEach((key)=>{
          arr.push({id: sql.bindId+'#'+ key,value:getter(data,key.split('#').join('.'))});
        });

        arr.push({id:sql.bindId,value:data});
        this.socketCallback(JSON.stringify(arr), { type: 'sql', url: `/api/iot/data/sql/${method}`,method });
      }
    }
  }

  randomString(e: number) {
    e = e || 32;
    let t = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678',
      a = t.length,
      n = '';
    for (let i = 0; i < e; i++) {
      n += t.charAt(Math.floor(Math.random() * a));
    }
    return n;
  }

  mockValue(data) {
    let value = undefined;
    if (data.enableMock && data.mock !== undefined) {
      if (data.type === 'float') {
        if (data.mock && data.mock.indexOf(',') !== -1) {
          let arr = data.mock.split(',');
          let rai = Math.floor(Math.random() * arr.length);
          value = parseFloat(arr[rai]);
        } else if (data.mock && data.mock.indexOf('-') !== -1) {
          let max;
          let min;
          let len;
          let arr = data.mock.split('-');
          if (data.mock.charAt(0) === '-') {
            //负数
            if (arr.length === 4) {
              max = -parseFloat(arr[3]);
              min = -parseFloat(arr[1]);
              len = arr[3];
            } else {
              max = parseFloat(arr[2]);
              min = -parseFloat(arr[1]);
              len = arr[2];
            }
          } else {
            max = parseFloat(arr[1]);
            min = parseFloat(arr[0]);
            len = arr[1];
          }
          if ((len + '').indexOf('.') !== -1) {
            let length = (len + '').split('.')[1].length;
            value = (Math.random() * (max - min) + min).toFixed(length);
          } else {
            value = Math.random() * (max - min) + min;
          }
        } else {
          value = parseFloat(data.mock);
        }
      } else if (data.type === 'integer') {
        if (data.mock && data.mock.indexOf(',') !== -1) {
          let arr = data.mock.split(',');
          let rai = Math.floor(Math.random() * arr.length);
          value = parseInt(arr[rai]);
        } else if (data.mock && data.mock.indexOf('-') !== -1) {
          let max;
          let min;
          let arr = data.mock.split('-');
          if (data.mock.charAt(0) === '-') {
            if (arr.length === 4) {
              max = -parseFloat(arr[3]);
              min = -parseFloat(arr[1]);
            } else {
              max = parseFloat(arr[2]);
              min = -parseFloat(arr[1]);
            }
          } else {
            max = parseInt(arr[1]);
            min = parseInt(arr[0]);
          }
          value = parseInt(Math.random() * (max - min) + min + '');
        } else {
          value = parseInt(data.mock);
        }
      } else if (data.type === 'bool') {
        if (typeof data.mock === 'boolean') {
          value = data.mock;
        } else if ('true' === data.mock) {
          value = true;
        } else if ('false' === data.mock) {
          value = false;
        } else {
          value = Math.random() < 0.5;
        }
      } else if (data.type === 'object' || data.type === 'array') {
        if (data.mock) {
          //对象or数组 不mock
          // _d[realTime.key] = realTime.value;
        }
      } else {
        //if (realTime.type === 'string')
        if (data.mock && data.mock.indexOf(',') !== -1) {
          let arr = data.mock.split(',');
          let rai = Math.floor(Math.random() * arr.length);
          value = arr[rai];
        } else if (
          data.mock &&
          data.mock.startsWith('[') &&
          data.mock.endsWith(']')
        ) {
          let len = parseInt(data.mock.substring(1, data.mock.length - 1));
          value = this.randomString(len);
        } else {
          value = data.mock;
        }
      }
    }
    return value;
  }

  //数据模拟
  dataMock() {
    let arr = [];
    this.store.data.dataset?.devices?.forEach((data) => {
      let value = this.mockValue(data);
      if (value !== undefined) {
        arr.push({
          id: data.id,
          value,
        });
      }
    });
    if (arr.length) {
      this.setDatas(arr, {
        render: true,
        doEvent: true,
        history: false,
      });
    }
  }

  networkMock() {
    if (this.store.data.networks && this.store.data.networks.length) {
      let arr = [];
      this.store.data.networks.forEach((net) => {
        if(net.enable === false){
          net.children?.forEach((child) => {
            let _child = deepClone(child);
            _child.enableMock = true;
            let value = this.mockValue(_child);
            if (value !== undefined) {
              arr.push({
                id: child.id,
                value,
              });
            }
          });
        }
      });
      if (arr.length) {
        this.setDatas(arr, {
          render: true,
          doEvent: true,
          history: false,
        });
      }
    }
  }

  startDataMock() {
    let enable = this.store.data.enableMock;
    if (enable) {
      this.stopDataMock();
      this.initBinds();
      this.updateTimer = setInterval(() => {
        //本地调试
        this.store.data.pens.forEach((pen) => {
          this.penMock(pen);
        });
        // this.dataMock();
        this.networkMock();
        this.render();
      }, this.store.data.networkInterval || 1000);
    }else{
      this.stopDataMock();
    }
  }

  stopDataMock() {
    clearInterval(this.updateTimer);
    this.updateTimer = undefined;
  }

  penMock(pen: Pen) {
    if (pen.realTimes) {
      let _d: any = {};
      pen.realTimes.forEach((realTime) => {
        let value = this.mockValue(realTime);
        if (value !== undefined) {
          _d[realTime.key] = value;
        }
      });
      if (Object.keys(_d).length) {
        let data = pen.onBeforeValue ? pen.onBeforeValue(pen, _d) : _d;
        this.canvas.updateValue(pen, data);
        // this.store.emitter.emit('valueUpdate', pen);
        pen.onValue?.(pen);
        this.store.emitter.emit('valueUpdate', pen);
      }
    }
  }

  penNetwork(pen: Pen) {
    const penNetwork: Network = {
      url: pen.apiUrl,
      method: pen.apiMethod,
      headers: pen.apiHeaders,
      body: pen.apiBody,
    };
    //临时请求一次
    this.requestHttp(penNetwork);
    if (pen.apiEnable) {
      if (!this.store.pensNetwork) {
        this.store.pensNetwork = {};
      }
      this.store.pensNetwork[pen.id] = penNetwork;
    } else {
      delete this.store.pensNetwork[pen.id];
    }
  }

  // getCookie(name: string) {
  //   let arr: RegExpMatchArray | null;
  //   const reg = new RegExp('(^| )' + name + '=([^;]*)(;|$)');
  //   if ((arr = document.cookie.match(reg))) {
  //     return decodeURIComponent(arr[2]);
  //   } else {
  //     return '';
  //   }
  // }

  //获取动态参数
  getDynamicParam(key: string) {
    let lsValue = localStorage.getItem(key);
    if(globalThis.le5leTokenD){
      let tokenkeys = [globalThis.le5leSSOTokenName ?? 'ssotoken',globalThis.le5leTokenName ?? 'token'];
      if(tokenkeys.includes(key)){
        lsValue = d(lsValue)
      }
    }
    let params = queryURLParams();
    let value = params[key] || lsValue || getCookie(key) || globalThis[key] || '';
    return value;
  }

  onNetworkConnect(https: Network[]) {
    // let enable = this.store.data.enableMock;
    if (!(https && https.length)) {
      return;
    }
    if (this.store.pensNetwork) {
      for (let key in this.store.pensNetwork) {
        https.push(this.store.pensNetwork[key]);
      }
    }
    if (!this.store.data.cancelFirstConnect) {
      https.forEach(async (_item) => {
        if(_item.enable !== false){
          this.requestHttp(_item);
        }
      });
    }
    // if( enable ){
    //   this.updateTimer = setInterval(() => {
    //     //模拟数据

    //     this.store.data.pens.forEach((pen) => {
    //       this.penMock(pen);
    //     });

    //     // https.forEach(async (_item) => {
    //     //   this.requestHttp(_item);
    //     // });
    //     this.render();
    //   }, this.store.data.networkInterval || 1000);
    // }

    https.forEach((_item, index) => {
      _item.times = 0;
      if(_item.interval !== 0 && _item.enable !== false){
        if(_item.once){
          setTimeout(async () => {
            this.requestHttp(_item);
          }, _item.interval || 1000);
        }else{
          this.updateTimerList[index] = setInterval(async () => {
            this.requestHttp(_item);
            if (this.store.options.reconnetTimes) {
              // _item.times++;
              if (_item.times >= this.store.options.reconnetTimes) {
                _item.times = 0;
                clearInterval(this.updateTimerList[index]);
                this.updateTimerList[index] = undefined;
              }
            }
          }, _item.interval || 1000);
        }
      }
    });
  }

  async requestHttp(_req: Network) {
    let req = deepClone(_req);
    if (req.url) {
      if(req.url.indexOf('${') > -1){
        let keys = req.url.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
          if (keys) {
            keys.forEach((key) => {
              req.url = req.url.replace(
                `\${${key}}`,this.getDynamicParam(key)
              );
            });
          }
      }
      if (typeof req.headers === 'object') {
        /*for (let i in req.headers) {
          if (typeof req.headers[i] === 'string') {
            let keys = req.headers[i].match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
            if (keys) {
              req.headers[i] = req.headers[i].replace(
                `\${${keys[0]}}`,
                this.getDynamicParam(keys[0])
              );
            }
          }
        }*/
        let headersStr = JSON.stringify(req.headers);
        let keys = headersStr.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
        if (keys?.length) {
         for(let i=0; i<keys.length; i++){
            headersStr = headersStr.replace(
              `\${${keys[i]}}`,
              this.getDynamicParam(keys[i])
            );
          }
        }
        req.headers = JSON.parse(headersStr);
      }
      if (typeof req.body === 'object') {
        /*for (let i in req.body) {
          if (typeof req.body[i] === 'string') {
            let keys = req.body[i].match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
            if (keys) {
              req.body[i] = req.body[i].replace(
                `\${${keys[0]}}`,
                this.getDynamicParam(keys[0])
              );
            }
          }
        }*/
        let bodyStr = JSON.stringify(req.body);
        let keys = bodyStr.match(/\$\{([^}]+)\}/g)?.map(m => m.slice(2, -1));
        if (keys?.length) {
         for(let i=0; i<keys.length; i++){
            bodyStr = bodyStr.replace(
              `\${${keys[i]}}`,
              this.getDynamicParam(keys[i])
            );
          }
        }
        req.body = JSON.parse(bodyStr);
      }
      // 默认每一秒请求一次
      const res: Response = await fetch(req.url, {
        headers: req.headers,
        method: req.method,
        body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
      });
      if (res.ok) {
        const data = await res.text();
        const net = this.store.data.networks.filter(item=>item.protocol==='http')[req.index];
        this.socketCallback(data, { type: 'http', method: req.method, url: req.url, name: req.name, net});
      } else {
        _req.times++;
        this.store.emitter.emit('error', { type: 'http', error: res });
      }
    }
  }

  closeNetwork() {
    this.mqttClients &&
      this.mqttClients.forEach((mqttClient) => {
        mqttClient.end();
      });
    this.websockets &&
      this.websockets.forEach((websocket) => {
        if (websocket) {
          websocket.onclose = undefined;
          websocket.close();
          websocket = undefined;
        }
      });
    this.mqttClients = undefined;
    this.websockets = undefined;
    // clearInterval(this.updateTimer);
    // this.updateTimer = undefined;
    this.updateTimerList &&
      this.updateTimerList.forEach((_updateTimer) => {
        clearInterval(_updateTimer);
        _updateTimer = undefined;
      });
    this.sqlTimerList &&
      this.sqlTimerList.forEach((_sqlTimer) => {
        clearInterval(_sqlTimer);
        _sqlTimer = undefined;
      });
    this.closeIot();
    // if(this.iotMqttClient){
    //   this.iotMqttClient.end();
    //   this.iotMqttClient = undefined;
    // }
    // clearInterval(this.iotTimer);
    // this.iotTimer = undefined;

    // if(this.iotWebsocketClient){
    //   this.iotWebsocketClient.onclose = undefined;
    //   this.iotWebsocketClient.close();
    //   this.iotWebsocketClient = undefined;
    // }
    closeJetLinks(this);
    this.closeSSE();
  }

  socketCallback(
    message: string,
    context?: { type?: string; topic?: string; url?: string; method?: string, name?:string, net?:Network }
  ) {
    this.store.emitter.emit('socket', { message, context });
    let _message: any = message;
    if(context.net?.socketCbJs){
      if(!context.net?.socketFn){
        context.net.socketFn = new Function('e', 'context', context.net.socketCbJs) as (
          e: string,
          context?: {
            meta2d?: Meta2d;
            type?: string;
            topic?: string;
            url?: string;
          }
        ) => boolean;
      }
      if (context.net.socketFn) {
        _message = context.net.socketFn(message,{
          meta2d: this,
          type: context.type,
          topic: context.topic,
          url: context.url,
          method: context.method,
        });
        if (!_message) {
          return;
        }
        if (_message&&_message !== true) {
          message = _message;
        }
      }
    }
    if (this.socketFn) {
      _message = this.socketFn(message, {
        meta2d: this,
        type: context.type,
        topic: context.topic,
        url: context.url,
        method: context.method,
        net: context.net
      });
      if (!_message) {
        return;
      }
    }
    if (_message === true) {
      _message = message;
    }
    let data: any;
    if (_message.constructor === Object || _message.constructor === Array) {
      data = _message;
    } else if (typeof _message === 'string') {
      try {
        data = JSON.parse(_message);
      } catch (error) {
        console.warn('Invalid socket data:', data, error);
      }
    } else {
      return;
    }

    if (!data) {
      return;
    }

    if (!Array.isArray(data)) {
      data = [data];
    }
    if (!data.length) {
      return;
    }
    if (data[0].dataId) {
      this.setDatas(data);
    } else {
      data.forEach((_data: IValue) => {
        this.setValue(_data);
      });
    }
  }

  // 绑定变量方式更新组件数据
  setDatas(
    datas: { dataId?: string; id?: string; value: any }[],
    {
      render = true,
      doEvent = true,
      history,
    }: {
      render?: boolean;
      doEvent?: boolean;
      history?: boolean;
    } = {}
  ) {
    // 把{dataId: string; value: any}转成setValue格式数据
    const penValues: Map<Pen, IValue> = new Map();
    datas.forEach((v: any) => {
      this.store.bindDatas[v.dataId]?.forEach(
        (p: { id: string; formItem: FormItem }) => {
          const pen = this.store.pens[p.id];
          if (!pen) {
            return;
          }

          let penValue = penValues.get(pen);

          if (!pen.noOnBinds && typeof pen.onBinds === 'function') {
            // 已经计算了
            if (penValue) {
              return;
            }
            penValues.set(pen, pen.onBinds(pen, datas, p.formItem));
            return;
          }

          if (penValue) {
            penValue[p.formItem.key] = v.value;
          } else {
            penValue = {
              id: p.id,
              [p.formItem.key]: v.value,
            };
            penValues.set(pen, penValue);
          }
        }
      );
      this.store.bind[v.id || v.dataId]?.forEach(
        (p: { id: string; key: string }) => {
          const pen = this.store.pens[p.id];
          if (!pen) {
            return;
          }
          let penValue = penValues.get(pen);

          // if (typeof pen.onBinds === 'function') {
          //   // 已经计算了
          //   if (penValue) {
          //     return;
          //   }
          //   //TODO onBinds的情况
          //   penValues.set(pen, pen.onBinds(pen, datas));
          //   return;
          // }
          if (penValue) {
            penValue[p.key] = v.value;
          } else {
            penValue = {
              id: p.id,
              [p.key]: v.value,
            };
            penValues.set(pen, penValue);
          }
        }
      );
    });

    this.store.data.locked && this.doDataEvent(datas);
    let initPens: Pen[];
    let pens: Pen[];
    if (history) {
      initPens = [];
    }
    penValues.forEach((value, pen) => {
      this.setValue(value, { render: false, doEvent, history: false });
      if (history) {
        initPens.push(deepClone(pen, true));
        pens.push(pen);
      }
    });
    render && this.render();

    if (history) {
      this.pushHistory({
        type: EditType.Update,
        initPens,
        pens,
      });
    }
  }

  setValue(
    data: IValue,
    {
      render = true,
      doEvent = true,
      history,
    }: {
      render?: boolean;
      doEvent?: boolean;
      history?: boolean;
    } = {}
  ) {
    let pens: Pen[] = [];
    if (!data) {
      return;
    }
    if (data.id) {
      if (data.id === this.store.data.id) {
        this.setDatabyOptions(data);
        if (data.bkImage) {
          this.setBackgroundImage(data.bkImage);
        }
        if (data.background) {
          this.setBackgroundColor(data.background);
        }
        this.render();
        return;
      }
      const pen = this.store.pens[data.id];
      if (pen) {
        pens = [pen];
      } else {
        //bind 绑定变量的情况
        let bindArr = this.store.bind[data.id];
        if (bindArr && bindArr.length) {
          pens = [];
          this.setDatas([data] as any, {
            render,
            doEvent,
            history,
          });
          return;
        }
      }
    } else if (data.dataId) {
      pens = [];
      this.setDatas([data] as any, {
        render,
        doEvent,
        history,
      });
      return;
    } else if (data.tag) {
      pens = this.find(data.tag);
    } else {
      let binds = [];
      for (let key in data) {
        binds.push({
          dataId: key,
          id: key,
          value: data[key],
        });
      }
      if (binds.length) {
        this.setDatas(binds as any, {
          render,
          doEvent,
          history,
        });
      }
      return;
    }

    history = history && !this.store.data.locked;
    let initPens: Pen[];
    if (history) {
      initPens = deepClone(pens);
    }
    pens.forEach((pen) => {
      if(pen.name === 'echarts' && !pen.onBeforeValue){
        const hasEchartsStartKey = Object.keys(data).some(key=>echartReg.test(key));
        if(hasEchartsStartKey) return;
      }
      const afterData: IValue = pen.onBeforeValue
        ? pen.onBeforeValue(pen, data as ChartData)
        : data;
      if (data.frames) {
        this.stopAnimate([pen]);
        if (!data.showDuration) {
          data.showDuration = data.frames.reduce((total, item) => {
            return total + item.duration;
          }, 0);
        }
      }

      setChildValue(pen, afterData);
      this.canvas.updateValue(pen, afterData);
      pen.onValue?.(pen);
    });

    if (
      !this.store.data.locked &&
      this.store.active.length &&
      !this.canvas.movingPens
    ) {
      // 移动过程中，不重算 activeRect
      this.canvas.calcActiveRect();
    }

    if (history) {
      let _pens = deepClone(pens);
      this.pushHistory({
        type: EditType.Update,
        initPens,
        pens: _pens,
      });
    }
    doEvent &&
      pens.forEach((pen) => {
        this.store.emitter.emit('valueUpdate', pen);
      });
    render && this.render();
  }

  /**
   * @deprecated 改用 setValue
   */
  _setValue(data: IValue, history = false) {
    this.setValue(data, { history, render: false, doEvent: false });
  }

  pushHistory(action: EditAction) {
    this.canvas.pushHistory(action);
  }

  showInput(pen: Pen, rect?: Rect) {
    this.canvas.showInput(pen, rect);
  }

  hideInput() {
    this.canvas.hideInput();
  }

  clearDropdownList() {
    this.canvas.clearDropdownList();
  }

  clearRuleLines() {
    this.canvas.clearRuleLines();
  }

  private onEvent = (eventName: string, e: any) => {
    switch (eventName) {
      case 'add':
        {
          e.forEach((pen: Pen) => {
            pen.onAdd?.(pen);
          });
        }
        this.onSizeUpdate();
        break;
      case 'enter':
        e && e.onMouseEnter && e.onMouseEnter(e, this.canvas.mousePos);
        this.store.data.locked && this.doEvent(e, eventName);
        break;
      case 'leave':
        e && e.onMouseLeave && e.onMouseLeave(e, this.canvas.mousePos);
        this.store.data.locked && this.doEvent(e, eventName);
        break;
      case 'active':
      case 'inactive':
        {
          this.store.data.locked &&
            e.forEach((pen: Pen) => {
              this.doEvent(pen, eventName);
            });
        }
        break;
      case 'click':
        if (this.store.data.locked && e.pen && !e.pen.disabled) {
          if (e.pen.switch) {
            e.pen.checked = !e.pen.checked;
            e.pen.calculative.checked = e.pen.checked;
            e.pen.calculative.gradient = undefined;
            e.pen.calculative.radialGradient = undefined;
          }
        }
        if(e.pen && e.pen.formId){
          const formPen = this.store.pens[e.pen.formId];
          if(e.pen.formType === 'submit'){
            this.store.data.locked && formPen && !formPen.disabled && this.doEvent(formPen, 'submit');
          }else if(e.pen.formType ==='reset'){
            reset(e.pen);
            this.store.data.locked && formPen && !formPen.disabled && this.doEvent(formPen, 'reset');
          }
        }
        e.pen &&
          e.pen.onClick &&
          !e.pen.disabled &&
          e.pen.onClick(e.pen, this.canvas.mousePos);
        this.store.data.locked &&
          e.pen &&
          !e.pen.disabled &&
          this.doEvent(e.pen, eventName);
        break;
      case 'contextmenu':
        e.pen &&
          e.pen.onContextmenu &&
          !e.pen.disabled &&
          e.pen.onContextmenu(e.pen, this.canvas.mousePos);
        this.store.data.locked &&
          e.pen &&
          !e.pen.disabled &&
          this.doEvent(e.pen, eventName);
        break;
      case 'mousedown':
        e.pen &&
          e.pen.onMouseDown &&
          !e.pen.disabled &&
          e.pen.onMouseDown(e.pen, this.canvas.mousePos);
        this.store.data.locked &&
          e.pen &&
          !e.pen.disabled &&
          this.doEvent(e.pen, eventName);
        break;
      case 'mouseup':
        e.pen &&
          e.pen.onMouseUp &&
          !e.pen.disabled &&
          e.pen.onMouseUp(e.pen, this.canvas.mousePos);
        this.store.data.locked &&
          e.pen &&
          !e.pen.disabled &&
          this.doEvent(e.pen, eventName);
        break;
      case 'dblclick':
        this.store.data.locked &&
          e.pen &&
          !e.pen.disabled &&
          this.doEvent(e.pen, eventName);
        break;
      case 'valueUpdate':
        e && updateFormData(e,e.formValue);
        this.store.data.locked && this.doEvent(e, eventName);
        this.canvas.tooltip.updateText(e as Pen);
        break;
      case 'update':
      case 'delete':
      case 'translatePens':
      case 'rotatePens':
      case 'resizePens':
        this.onSizeUpdate();
        break;
      case 'navigator':
        if (!this.store.data.id) {
          console.warn('请先保存当前图纸');
        }
        this.navigatorTo(e.params);
        break;
      case 'input':
        this.store.data.locked &&
          e &&
          !e.disabled &&
          this.doEvent(e, eventName);
        break;
      case 'change':
        e.pen && updateFormData(e.pen);
        if(e.pen){
          this.store.data.locked &&!e.pen.disabled &&
            this.doEvent(e.pen, eventName);
        }else{
          this.store.data.locked &&
            e &&
            !e.disabled &&
            this.doEvent(e, eventName);
        }
        break;
    }

    this.doMessageEvent(eventName,e);
  };

  private doEvent = (pen: Pen, eventName: EventName) => {
    if (!pen) {
      return;
    }
    let old = false; //是否是旧的事件
    let indexArr = []; //事件条件成立的索引
    pen.events?.forEach((event, index) => {
      if (event.actions && event.actions.length) {
        if (event.name === eventName) {
          //条件成立
          let flag = false;
          if (event.conditions && event.conditions.length) {
            if (event.conditionType === 'and') {
              flag = event.conditions.every((condition) => {
                return this.judgeCondition(pen, condition.key, condition);
              });
            } else if (event.conditionType === 'or') {
              flag = event.conditions.some((condition) => {
                return this.judgeCondition(pen, condition.key, condition);
              });
            }
          } else {
            flag = true;
          }
          if (flag) {
            // event.actions.forEach((action) => {
            //   if (this.events[action.action]) {
            //     this.events[action.action](pen, action);
            //   }
            // });
            indexArr.push(index);
          }
        }
      } else {
        old = true;
        if (this.events[event.action] && event.name === eventName) {
          let can = !event.where?.type;
          if (event.where) {
            const { fn, fnJs, comparison, key, value } = event.where;
            if (fn) {
              can = fn(pen, { meta2d: this });
            } else if (fnJs) {
              try {
                event.where.fn = new Function('pen', 'context', fnJs) as (
                  pen: Pen,
                  context?: {
                    meta2d: Meta2d;
                  }
                ) => boolean;
              } catch (err) {
                console.error('Error: make function:', err);
              }
              if (event.where.fn) {
                can = event.where.fn(pen, { meta2d: this });
              }
            } else {
              let pValue = pen[key];
              if (['x', 'y', 'width', 'height'].includes(key)) {
                pValue = this.getPenRect(pen)[key];
              }
              switch (comparison) {
                case '>':
                  can = pValue > +value;
                  break;
                case '>=':
                  can = pValue >= +value;
                  break;
                case '<':
                  can = pValue < +value;
                  break;
                case '<=':
                  can = pValue <= +value;
                  break;
                case '=':
                case '==':
                  can = pValue == value;
                  break;
                case '!=':
                  can = pValue != value;
                  break;
                case '[)':
                  can = valueInRange(+pValue, value);
                  break;
                case '![)':
                  can = !valueInRange(+pValue, value);
                  break;
                case '[]':
                  can = valueInArray(pValue, value);
                  break;
                case '![]':
                  can = !valueInArray(pValue, value);
                  break;
              }
            }
          }
          // can && this.events[event.action](pen, event);
          if (can) {
            indexArr.push(index);
          }
        }
      }
    });

    //所有的条件判断后，再统一执行条件成立的事件
    if (old) {
      pen.events?.forEach((event, index) => {
        if (indexArr.includes(index)) {
          this.events[event.action](pen, event);
        }
      });
    } else {
      pen.events?.forEach(async (event, index) => {
        if (indexArr.includes(index)) {
          if (event.confirm) {
            if (
              !(await this.canvas.popconfirm.showModal(
                pen,
                this.canvas.mousePos,
                event.confirmTitle
              ))
            ) {
              return;
            }
          }
          event.actions.forEach((action) => {
            if (action.timeout) {
              let timer = setTimeout(() => {
                if (this.events[action.action]) {
                  this.events[action.action](pen, action);
                  clearTimeout(timer);
                  timer = null;
                }
              }, action.timeout);
            } else {
              if (this.events[action.action]) {
                this.events[action.action](pen, action);
              }
            }
          });
        }
      });
    }

    if (eventName === 'valueUpdate') {
      pen.realTimes?.forEach((realTime) => {
        let indexArr = [];
        realTime.triggers?.forEach((trigger, index) => {
          let flag = false;
          if (trigger.conditions?.length) {
            if (trigger.conditionType === 'and') {
              flag = trigger.conditions.every((condition) => {
                return this.judgeCondition(pen, realTime.key, condition);
              });
            } else if (trigger.conditionType === 'or') {
              flag = trigger.conditions.some((condition) => {
                return this.judgeCondition(pen, realTime.key, condition);
              });
            }
          } else {
            //无条件
            flag = true;
          }
          if (flag) {
            indexArr.push(index);
            // trigger.actions?.forEach((event) => {
            //   this.events[event.action](pen, event);
            // });
          }
        });

        //执行
        realTime.triggers?.forEach((trigger, index) => {
          if (indexArr.includes(index)) {
            trigger.actions?.forEach((event) => {
              if (event.timeout) {
                let timer = setTimeout(() => {
                  if (this.events[event.action]) {
                    this.events[event.action](pen, event);
                    clearTimeout(timer);
                    timer = null;
                  }
                }, event.timeout);
              } else {
                this.events[event.action](pen, event);
              }
            });
          }
        });
      });

      //全局
      let indexArr = [];
      this.store.globalTriggers[pen.id]?.forEach((trigger, index) => {
        let flag = false;
        if (trigger.conditions?.length) {
          if (trigger.conditionType === 'and') {
            flag = trigger.conditions.every((condition) => {
              return this.judgeCondition(
                this.store.pens[condition.source],
                condition.key,
                condition
              );
            });
          } else if (trigger.conditionType === 'or') {
            flag = trigger.conditions.some((condition) => {
              return this.judgeCondition(
                this.store.pens[condition.source],
                condition.key,
                condition
              );
            });
          }
        } else {
          //无条件
          flag = true;
        }
        if (flag) {
          indexArr.push(index);
        }
      });
      this.store.globalTriggers[pen.id]?.forEach((trigger, index) => {
        if (indexArr.includes(index)) {
          trigger.actions?.forEach((event) => {
            if (event.timeout) {
              let timer = setTimeout(() => {
                if (this.events[event.action]) {
                  this.events[event.action](pen, event);
                  clearTimeout(timer);
                  timer = null;
                }
              }, event.timeout);
            } else {
              this.events[event.action](pen, event);
            }
          });
        }
      });

      //triggers
      if (pen.triggers?.length) {
        for (let trigger of pen.triggers) {
          if (trigger.status?.length) {
            for (let state of trigger.status) {
              let flag = false;
              if (state.conditions?.length) {
                if (state.conditionType === 'and') {
                  flag = state.conditions.every((condition) => {
                    return this.judgeCondition(pen, condition.key, condition);
                  });
                } else if (state.conditionType === 'or') {
                  flag = state.conditions.some((condition) => {
                    return this.judgeCondition(pen, condition.key, condition);
                  });
                }
              } else {
                //无条件
                flag = true;
              }
              if (flag) {
                state.actions?.forEach((event) => {
                  if (event.timeout) {
                    let timer = setTimeout(() => {
                      if (this.events[event.action]) {
                        this.events[event.action](pen, event);
                        clearTimeout(timer);
                        timer = null;
                      }
                    }, event.timeout);
                  } else {
                    this.events[event.action](pen, event);
                  }
                });
                break;
              }
            }
          }
        }
      }
    }

    // 事件冒泡，子执行完，父执行
    this.doEvent(this.store.pens[pen.parentId], eventName);
  };

  doMessageEvent(eventName: string, data?: any) {
    if (this.store.messageEvents[eventName]) {
      this.store.messageEvents[eventName].forEach((item) => {
        let flag = false;
        if (item.event.conditions && item.event.conditions.length) {
          if (item.event.conditionType === 'and') {
            flag = item.event.conditions.every((condition) => {
              return this.judgeCondition(item.pen, condition.key, condition);
            });
          } else if (item.event.conditionType === 'or') {
            flag = item.event.conditions.some((condition) => {
              return this.judgeCondition(item.pen, condition.key, condition);
            });
          }
        } else {
          flag = true;
        }
        if (flag) {
          item.event.actions.forEach((action) => {
            this.events[action.action](item.pen, action, data);
          });
        }
      });
    }
  }

  doDataEvent = (datas: { dataId?: string; id?: string; value: any }[]) => {
    if (!this.store.data.dataEvents?.length) {
      return;
    }
    const data = datas.reduce((accumulator, { dataId, id, value }) => {
      accumulator[id || dataId] = value;
      return accumulator;
    }, {});
    let indexArr = [];
    this.store.data.dataEvents?.forEach((event, index) => {
      let flag = false;
      if (event.conditions && event.conditions.length) {
        if (event.conditionType === 'and') {
          flag = event.conditions.every((condition) => {
            return this.dataJudegeCondition(data, condition.key, condition);
          });
        } else if (event.conditionType === 'or') {
          flag = event.conditions.some((condition) => {
            return this.dataJudegeCondition(data, condition.key, condition);
          });
        }
      } else {
        flag = true;
      }
      if (flag) {
        indexArr.push(index);
      }
    });

    this.store.data.dataEvents?.forEach((event, index) => {
      if (indexArr.includes(index)) {
        event.actions?.forEach((action) => {
          this.events[action.action](data, action);
        });
      }
    });
  };

  initGlobalTriggers() {
    this.store.globalTriggers = {};
    this.store.data.triggers?.forEach((trigger) => {
      trigger.conditions.forEach((condition) => {
        if (condition.source) {
          if (!this.store.globalTriggers[condition.source]) {
            this.store.globalTriggers[condition.source] = [];
          }
          if (!this.store.globalTriggers[condition.source].includes(trigger)) {
            this.store.globalTriggers[condition.source].push(trigger);
          }
        }
      });
    });
  }

  initMessageEvents() {
    this.store.messageEvents = {};
    this.store.data.pens.forEach((pen) => {
      pen.events?.forEach((event) => {
        if (event.name === 'message' && event.message) {
          if (!this.store.messageEvents[event.message]) {
            this.store.messageEvents[event.message] = [];
          }
          this.store.messageEvents[event.message].push({
            pen: pen,
            event: event,
          });
        }
      });
    });
  }

  dataJudegeCondition(data: any, key: string, condition: TriggerCondition) {
    const { type, target, fnJs, fn, operator, valueType } = condition;
    let can = false;
    if (type === 'fn') {
      //方法
      if (fn) {
        can = fn(data, { meta2d: this });
      } else if (fnJs) {
        try {
          condition.fn = new Function('data', 'context', fnJs) as (
            data: any,
            context?: {
              meta2d: Meta2d;
            }
          ) => boolean;
        } catch (err) {
          console.error('Error: make function:', err);
        }
        if (condition.fn) {
          can = condition.fn(data, { meta2d: this });
        }
      }
    } else {
      //TODO boolean类型 数字类型
      let value = condition.value;
      if (valueType === 'prop') {
        value = data[condition.value];
      }
      let compareValue = data[key];
      switch (operator) {
        case '>':
          can = compareValue > +value;
          break;
        case '>=':
          can = compareValue >= +value;
          break;
        case '<':
          can = compareValue < +value;
          break;
        case '<=':
          can = compareValue <= +value;
          break;
        case '=':
        case '==':
          can = compareValue == value;
          break;
        case '!=':
          can = compareValue != value;
          break;
        case '[)':
          can = valueInRange(+compareValue, value);
          break;
        case '![)':
          can = !valueInRange(+compareValue, value);
          break;
        case '[]':
          can = valueInArray(compareValue, value);
          break;
        case '![]':
          can = !valueInArray(compareValue, value);
          break;
      }
    }
    return can;
  }

  judgeCondition(pen: Pen, key: string, condition: TriggerCondition) {
    const { type, target, fnJs, fn, operator, valueType } = condition;
    let can = false;
    if (type === 'fn') {
      //方法
      if (fn) {
        can = fn(pen, { meta2d: this });
      } else if (fnJs) {
        try {
          condition.fn = new Function('pen', 'context', fnJs) as (
            pen: Pen,
            context?: {
              meta2d: Meta2d;
            }
          ) => boolean;
        } catch (err) {
          console.error('Error: make function:', err);
        }
        if (condition.fn) {
          can = condition.fn(pen, { meta2d: this });
        }
      }
    } else {
      //TODO boolean类型 数字类型
      let value = condition.value;
      if (valueType === 'prop') {
        value = this.store.pens[target][condition.value];
      }
      let compareValue = getter(pen, key);
      if (['x', 'y', 'width', 'height'].includes(key)) {
        compareValue = this.getPenRect(pen)[key];
      }
      switch (operator) {
        case '>':
          can = compareValue > +value;
          break;
        case '>=':
          can = compareValue >= +value;
          break;
        case '<':
          can = compareValue < +value;
          break;
        case '<=':
          can = compareValue <= +value;
          break;
        case '=':
        case '==':
          can = compareValue == value;
          break;
        case '!=':
          can = compareValue != value;
          break;
        case '[)':
          can = valueInRange(+compareValue, value);
          break;
        case '![)':
          can = !valueInRange(+compareValue, value);
          break;
        case '[]':
          can = valueInArray(compareValue, value);
          break;
        case '![]':
          can = !valueInArray(compareValue, value);
          break;
      }
    }
    return can;
  }

  pushChildren(parent: Pen, children: Pen[]) {
    const initUpdatePens: Pen[] = [deepClone(parent, true)];
    const addPens: Pen[] = [];
    if (!parent.children) {
      parent.children = [];
    }
    const updatePens: Pen[] = [];
    children.forEach((pen) => {
      let oldPen: Pen = deepClone(pen, true);
      if (!pen.id || !this.store.pens[pen.id]) {
        // 不存在于 store 中
        this.canvas.makePen(pen);
        oldPen = null; // 添加操作
      }
      if (pen.parentId) {
        const oldParent = this.store.pens[pen.parentId];
        const i = oldParent.children.findIndex((id) => id === pen.id);
        initUpdatePens.push(deepClone(oldParent, true));
        oldParent.children.splice(i, 1);
        updatePens.push(deepClone(oldParent, true));
      }
      parent.children.push(pen.id);
      pen.parentId = parent.id;
      const childRect = calcRelativeRect(
        pen.calculative.worldRect,
        parent.calculative.worldRect
      );
      Object.assign(pen, childRect);
      pen.locked = pen.lockedOnCombine ?? LockState.DisableMove;
      pen.locked =
        pen.interaction || isInteraction.includes(pen.name) ? 0 : pen.locked;
      if (!oldPen) {
        addPens.push(deepClone(pen, true));
      } else {
        initUpdatePens.push(oldPen);
        updatePens.push(deepClone(pen, true));
      }
    });
    updatePens.push(deepClone(parent, true));
    let step = 1;
    if (addPens.length) {
      step = 2;
      this.pushHistory({
        type: EditType.Add,
        pens: addPens,
        step,
      });
    }
    this.pushHistory({
      type: EditType.Update,
      initPens: initUpdatePens,
      pens: updatePens,
      step,
    });
  }

  renderPenRaw = renderPenRaw;

  toPng(
    padding?: Padding,
    callback?: BlobCallback,
    containBkImg = false,
    maxWidth?: number
  ) {
    return this.canvas.toPng(padding, callback, containBkImg, maxWidth);
  }

  activeToPng(padding?: Padding, maxWidth?: number) {
    return this.canvas.activeToPng(padding, maxWidth);
  }

  pensToPng(
    pens: Pen[] = this.store.active,
    padding?: Padding,
    maxWidth?: number
  ) {
    return this.canvas.pensToPng(pens, padding, maxWidth);
  }

  /**
   * 下载 png
   * @param name 传入参数自带文件后缀名 例如：'test.png'
   * @param padding 上右下左的内边距
   */
  downloadPng(name?: string, padding?: Padding, maxWidth?: number) {
    for (const pen of this.store.data.pens) {
      if (pen.calculative.img || ['iframe'].includes(pen.name)) {
        //重新生成绘制图片
        pen.onRenderPenRaw?.(pen);
      }
    }
    setTimeout(() => {
      const a = document.createElement('a');
      a.setAttribute(
        'download',
        (name || this.store.data.name || 'le5le.meta2d') + '.png'
      );
      a.setAttribute('href', this.toPng(padding, undefined, true, maxWidth));
      const evt = document.createEvent('MouseEvents');
      evt.initEvent('click', true, true);
      a.dispatchEvent(evt);
    }, 1000);
  }

  downloadSvg(defs?:string[]) {
    if (!(window as any).C2S) {
      console.error(
        '请先加载乐吾乐官网下的canvas2svg.js',
        'https://assets.le5lecdn.com/2d/canvas2svg.js'
      );
      throw new Error('请先加载乐吾乐官网下的canvas2svg.js');
    }
    let isV = false;
    const width = this.store.data.width || this.store.options.width;
    const height = this.store.data.height || this.store.options.height;
    if (width && height && !this.store.data.component) {
      isV = true;
    }
    const rect = this.getRect();
    if (isV) {
      rect.x = this.store.data.origin.x;
      rect.y = this.store.data.origin.y;
      rect.width = width * this.store.data.scale;
      rect.height = height * this.store.data.scale;
    }
    //TODO 不考虑无画布尺寸时背景图片
    // if(this.store.bkImg&&!isV){
    //   rect.x = rect.x < 0 ? -rect.x : 0;
    //   rect.y = rect.y < 0 ? -rect.y : 0;
    //   rect.width = this.canvas.canvasRect.width;
    //   rect.height =  this.canvas.canvasRect.height;
    // }
    rect.x -= 10;
    rect.y -= 10;
    const ctx = new (window as any).C2S(rect.width + 20, rect.height + 20);
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = this.store.styles.color // getGlobalColor(this.store);
    const background = this.store.options.downloadBgTransparent? undefined : (this.store.data.background || this.store.styles.background);
    // this.store.data.background || this.store.options.background;
    if (background && isV) {
      // 绘制背景颜色
      ctx.save();
      ctx.fillStyle = background;
      ctx.fillRect(
        0,
        0,
        rect.width,
        rect.height
      );
      ctx.restore();
    }
    if (this.store.bkImg) {
      if (isV) {
        ctx.drawImage(
          this.store.bkImg,
          0,
          0,
          rect.width,
          rect.height
        );
      } else {
        // const x = rect.x < 0 ? -rect.x : 0;
        // const y = rect.y < 0 ? -rect.y : 0;
        // ctx.drawImage(
        //   this.store.bkImg,
        //   x,
        //   y,
        //   this.canvas.canvasRect.width,
        //   this.canvas.canvasRect.height
        // );
      }
    }
    if (background && !isV) {
      // 绘制背景颜色
      ctx.save();
      ctx.fillStyle = background;
      ctx.fillRect(
        0,
        0,
        rect.width+20,
        rect.height+20
      );
      ctx.restore();

    }
    // if(this.store.bkImg&&!isV){
    //   ctx.translate(
    //     this.store.data.x,
    //     this.store.data.y
    //   );
    // }
    for (const pen of this.store.data.pens) {
      if (pen.visible == false || !isShowChild(pen, this.store)) {
        continue;
      }
      // if (pen.name === 'combine' && !pen.draw) {
      //   continue;
      // }
      renderPenRaw(ctx, pen, rect, true);
    }

    let mySerializedSVG = ctx.getSerializedSvg();
    if(defs?.length){
      mySerializedSVG = mySerializedSVG.replace(
        '<defs/>',
        `<defs>
          <style type="text/css">
            ${defs.join('\n')}
          </style>
          {{bk}}
        </defs>
        {{bkRect}}`
      );
    }
    if (background) {
      mySerializedSVG = mySerializedSVG.replace('{{bk}}', '');
      mySerializedSVG = mySerializedSVG.replace(
        '{{bkRect}}',
        `<rect x="0" y="0" width="100%" height="100%" fill="${background}"></rect>`
      );
    } else {
      mySerializedSVG = mySerializedSVG.replace('{{bk}}', '');
      mySerializedSVG = mySerializedSVG.replace('{{bkRect}}', '');
    }

    mySerializedSVG = mySerializedSVG.replace(/--le5le--/g, '&#x');

    const urlObject = window.URL;
    const export_blob = new Blob([mySerializedSVG]);
    const url = urlObject.createObjectURL(export_blob);

    const a = document.createElement('a');
    a.setAttribute('download', `${this.store.data.name || 'le5le.meta2d'}.svg`);
    a.setAttribute('href', url);
    const evt = document.createEvent('MouseEvents');
    evt.initEvent('click', true, true);
    a.dispatchEvent(evt);
  }

  getRect(pens: Pen[] = this.store.data.pens) {
    return getRect(pens);
  }

  hiddenTemplate() {
    this.canvas.canvasTemplate.hidden();
  }

  showTemplate() {
    this.canvas.canvasTemplate.show();
  }

  lockTemplate(lock: LockState) {
    //锁定
    this.store.data.pens.forEach((pen) => {
      // if (pen.template) {
      //   pen.locked = lock;
      // }
      if (pen.canvasLayer === CanvasLayer.CanvasTemplate) {
        pen.locked = lock;
      }
    });
  }

  /**
   * 放大到屏幕尺寸，并居中
   * @param fit true，填满但完整展示；false，填满，但长边可能截取（即显示不完整）
   */
  fitView(fit: boolean = true, viewPadding: Padding = 10, fill: boolean = true) {
    // 默认垂直填充，两边留白
    if (!this.hasView()) return;
    // 1. 重置画布尺寸为容器尺寸
    const { canvas } = this.canvas;
    const { offsetWidth: width, offsetHeight: height } = canvas;
    this.resize(width, height);
    // 2. 获取设置的留白值
    const padding = formatPadding(viewPadding);

    // 3. 获取图形尺寸
    const rect = this.getRect();

    // 4. 计算缩放比例
    const w = (width - padding[1] - padding[3]) / rect.width;
    const h = (height - padding[0] - padding[2]) / rect.height;
    let ratio = w;
    if (fit) {
      // 完整显示取小的
      ratio = w > h ? h : w;
    } else {
      ratio = w > h ? w : h;
    }
    if (this.store.data.fits?.length) {
      this.canvas.opening = true;
    }
    // 该方法直接更改画布的 scale 属性，所以比率应该乘以当前 scale
    this.scale(ratio * this.store.data.scale);

    // 5. 居中
    this.centerView();
    if (fill && this.store.data.fits?.length) {
      this.fillView();
    }
  }

  fillView() {
    if(this.store.options.unFill){
      return; //不自适应
    }
    const rect = this.getRect();
    const wGap = this.canvas.width - rect.width;
    const hGap = this.canvas.height - rect.height;
    //宽度拉伸
    if (Math.abs(wGap) > 10) {
      this.store.data.fits?.forEach((fit) => {
        let pens = [];
        fit.children.forEach((id) => {
          if(this.store.pens[id]){
            this.store.pens[id].locked = LockState.None;
            pens.push(this.store.pens[id]);
          }
        });
        let r = wGap / 2;
        if (fit.left && fit.right) {
          //整体拉伸
          let left = fit.leftValue;
          let right = fit.rightValue;
          if (left) {
            left = Math.abs(left) < 1 ? left * rect.width : left;
          } else {
            left = 0;
          }
          if (right) {
            right = Math.abs(right) < 1 ? right * rect.width : right;
          } else {
            right = 0;
          }
          let ratio =
            (this.canvas.width - left - right) / (rect.width - left - right);
          pens.forEach((pen) => {
            if (pen.image && pen.imageRatio) {
              if (pen.calculative.worldRect.width / this.canvas.width > 0.1) {
                pen.imageRatio = false;
                pen.ratio = false;
              }
            }
            if (pen.name === 'tablePlus') {
              pen.colWidth = (pen.colWidth ?? 150) * ratio;
              pen.styles.forEach((style) => {
                if (style.width) {
                  style.width = style.width * ratio;
                }
              });
            }
            if (Math.abs(fit.leftValue) < 1) {
              pen.calculative.worldRect.x =
                rect.x -
                wGap / 2 +
                left +
                (pen.calculative.worldRect.x - rect.x - left) * ratio;
            } else {
              pen.calculative.worldRect.x =
                rect.x -
                wGap / 2 +
                left +
                (pen.calculative.worldRect.x - rect.x) * ratio;
            }
            pen.calculative.worldRect.width *= ratio;
            pen.calculative.worldRect.ex =
              pen.calculative.worldRect.x + pen.calculative.worldRect.width;
            pen.calculative.width = pen.calculative.worldRect.width;
            pen.calculative.x = pen.calculative.worldRect.x;
            pen.width = pen.calculative.worldRect.width;
            pen.x = pen.calculative.worldRect.x;
            pen.textWidth *= ratio
            pen.calculative.textWidth *= ratio;
            this.canvas.updatePenRect(pen, { worldRectIsReady: false });
            if (pen.externElement) {
              pen.onResize?.(pen);
            }
            if(pen.children?.length){
              const cPens = getAllChildren(pen,this.store);
              cPens.forEach((cPen) => {
                if (cPen.externElement) {
                    cPen.onResize?.(cPen);
                }
              });
            }
          });
        } else if (fit.left) {
          //左移
          r = -r;
          if (fit.leftValue) {
            r +=
              Math.abs(fit.leftValue) < 1
                ? fit.leftValue * this.canvas.width
                : fit.leftValue;
          }
          this.translatePens(pens, r, 0);
        } else if (fit.right) {
          //右移
          if (fit.rightValue) {
            r =
              r -
              (Math.abs(fit.rightValue) < 1
                ? fit.rightValue * this.canvas.width
                : fit.rightValue);
          }
          this.translatePens(pens, r, 0);
        }
      });
      const iframePens = this.store.data.pens.filter(
        (pen) => pen.name === 'iframe'
      );
      iframePens?.forEach((pen) => {
        const worldRect = pen.calculative.worldRect;
        if (worldRect.width / this.store.data.scale > rect.width * 0.8) {
          let bfW = worldRect.width;
          pen.calculative.worldRect.x = worldRect.x - wGap / 2;
          pen.calculative.worldRect.width = worldRect.width + wGap;
          pen.calculative.worldRect.ex = worldRect.ex + wGap;
          pen.operationalRect.x =
            (pen.operationalRect.x * bfW) / pen.calculative.worldRect.width;
          pen.operationalRect.width =
            (pen.calculative.worldRect.width -
              (1 - pen.operationalRect.width) * bfW) /
            pen.calculative.worldRect.width;
          pen.onBeforeValue?.(pen, {
            operationalRect: pen.operationalRect,
          } as any);
          pen.onResize?.(pen);
        }
      });

      const videoPens = this.store.data.pens.filter(
        (pen) => pen.name === 'video'
      );
      videoPens?.forEach((pen) => {
        const worldRect = pen.calculative.worldRect;
        if (worldRect.width / this.store.data.scale > rect.width * 0.8) {
          //作为背景的video
          pen.calculative.worldRect.x = worldRect.x - wGap / 2;
          pen.calculative.worldRect.width = worldRect.width + wGap;
          pen.calculative.worldRect.ex = worldRect.ex + wGap;
          pen.onResize?.(pen);
        }
      });
    }
    //高度拉伸
    if (Math.abs(hGap) > 10) {
      this.store.data.fits?.forEach((fit) => {
        let pens = [];
        fit.children.forEach((id) => {
          if(this.store.pens[id]){
            this.store.pens[id].locked = LockState.None;
            pens.push(this.store.pens[id]);
          }
        });
        let r = hGap / 2;
        if (fit.top && fit.bottom) {
          let top = fit.topValue;
          let bottom = fit.bottomValue;
          if (top) {
            top = Math.abs(top) < 1 ? top * this.canvas.height : top;
          } else {
            top = 0;
          }
          if (bottom) {
            bottom =
              Math.abs(bottom) < 1 ? bottom * this.canvas.height : bottom;
          } else {
            bottom = 0;
          }

          let ratio =
            (this.canvas.height - top - bottom) / (rect.height);
          pens.forEach((pen) => {
            if (pen.image && pen.imageRatio) {
              if (pen.calculative.worldRect.height / this.canvas.height > 0.1) {
                pen.imageRatio = false;
                pen.ratio = false;
              }
            }
            pen.calculative.worldRect.y =
              rect.y -
              hGap / 2 +
              top +
              (pen.calculative.worldRect.y - rect.y) * ratio; //(fit.leftValue || 0)+ (pen.calculative.worldRect.x + pen.calculative.worldRect.width/2)-( pen.calculative.worldRect.width*ratio)*(range/2- (fit.rightValue || 0))/(range- (fit.leftValue || 0)-(fit.rightValue || 0));
            pen.calculative.worldRect.height *= ratio;
            pen.calculative.worldRect.ey =
              pen.calculative.worldRect.y + pen.calculative.worldRect.height;
            pen.calculative.height = pen.calculative.worldRect.height;
            pen.calculative.y = pen.calculative.worldRect.y;
            pen.height = pen.calculative.worldRect.height;
            pen.y = pen.calculative.worldRect.y;
            this.canvas.updatePenRect(pen, { worldRectIsReady: false });
            if (pen.externElement) {
              pen.onResize?.(pen);
            }
            if(pen.children?.length){
              const cPens = getAllChildren(pen,this.store);
              cPens.forEach((cPen) => {
                if (cPen.externElement) {
                    cPen.onResize?.(cPen);
                }
              });
            }
          });
        } else if (fit.top) {
          r = -r;
          if (fit.topValue) {
            r +=
              Math.abs(fit.topValue) < 1
                ? fit.topValue * this.canvas.height
                : fit.topValue;
          }
          this.translatePens(pens, 0, r);
        } else if (fit.bottom) {
          if (fit.bottomValue) {
            r =
              r -
              (Math.abs(fit.bottomValue) < 1
                ? fit.bottomValue * this.canvas.height
                : fit.bottomValue);
          }
          this.translatePens(pens, 0, r);
        }
      });
      const iframePens = this.store.data.pens.filter(
        (pen) => pen.name === 'iframe'
      );
      iframePens?.forEach((pen) => {
        const worldRect = pen.calculative.worldRect;
        if (worldRect.height / this.store.data.scale > rect.height * 0.8) {
          let bfH = worldRect.height;
          pen.calculative.worldRect.y = worldRect.y - hGap / 2;
          pen.calculative.worldRect.height = worldRect.height + hGap;
          pen.calculative.worldRect.ey = worldRect.ey + hGap;
          pen.operationalRect.y =
            (pen.operationalRect.y * bfH) / pen.calculative.worldRect.width;
          pen.operationalRect.height =
            (pen.calculative.worldRect.height -
              (1 - pen.operationalRect.height) * bfH) /
            pen.calculative.worldRect.height;
          pen.onBeforeValue?.(pen, {
            operationalRect: pen.operationalRect,
          } as any);
          pen.onResize?.(pen);
        }
      });
      const videoPens = this.store.data.pens.filter(
        (pen) => pen.name === 'video'
      );
      videoPens?.forEach((pen) => {
        const worldRect = pen.calculative.worldRect;
        if (worldRect.height / this.store.data.scale > rect.height * 0.8) {
          //作为背景的video
          pen.calculative.worldRect.y = worldRect.y - hGap / 2;
          pen.calculative.worldRect.height = worldRect.height + hGap;
          pen.calculative.worldRect.ey = worldRect.ey + hGap;
          pen.onResize?.(pen);
        }
      });
    }
    this.canvas.canvasTemplate.fit = true;
    this.canvas.canvasTemplate.init();
    this.canvas.canvasImage.init();
    this.canvas.canvasImageBottom.init();
    this.render(true);
  }

  trimPens() {
    //去除空连线
    let pens = this.store.data.pens.filter(
      (pen) => pen.name === 'line' && pen.anchors.length < 2
    );
    this.delete(pens);
  }

  /**
   * 放大到屏幕尺寸，并居中
   * @param fit true，填满但完整展示；false，填满，但长边可能截取（即显示不完整）
   */
  fitTemplateView(fit: boolean = true, viewPadding: Padding = 10) {
    //  默认垂直填充，两边留白
    if (!this.hasView()) return;
    // 1. 重置画布尺寸为容器尺寸
    const { canvas } = this.canvas;
    const { offsetWidth: width, offsetHeight: height } = canvas;
    // 2. 获取设置的留白值
    const padding = formatPadding(viewPadding);

    // 3. 获取图形尺寸
    const rect = this.getRect();

    // 4. 计算缩放比例
    const w = (width - padding[1] - padding[3]) / rect.width;
    const h = (height - padding[0] - padding[2]) / rect.height;
    let ratio = w;
    if (fit) {
      // 完整显示取小的
      ratio = w > h ? h : w;
    } else {
      ratio = w > h ? w : h;
    }

    // 该方法直接更改画布的 scale 属性，所以比率应该乘以当前 scale
    this.canvas.templateScale(ratio * this.store.data.scale);
    let _rect = this.getRect();

    let pens = this.store.data.pens.filter((pen) => !pen.parentId);
    this.canvas.templateTranslatePens(pens, -_rect.x, -_rect.y);
    // 5. 居中
    this.store.data.pens.forEach((pen) => {
      if (!pen.type) {
        this.canvas.updateLines(pen);
      } else {
        this.canvas.initLineRect(pen);
      }
    });
    this.centerView();
  }

  fitSizeView(fit: boolean | string = true, viewPadding: Padding = 10, fill: boolean = true) {
    // 默认垂直填充，两边留白
    // if (!this.hasView()) return;
    // 1. 重置画布尺寸为容器尺寸
    const { canvas } = this.canvas;
    const { offsetWidth: width, offsetHeight: height } = canvas;
    this.resize(width, height);
    // 2. 获取设置的留白值
    const padding = formatPadding(viewPadding);

    const _width =
      (this.store.data.width || this.store.options.width) *
      this.store.data.scale;
    const _height =
      (this.store.data.height || this.store.options.height) *
      this.store.data.scale;
    // 4. 计算缩放比例
    const w = (width - padding[1] - padding[3]) / _width;
    const h = (height - padding[0] - padding[2]) / _height;
    let ratio = w;
    if (fit === 'width') {
      ratio = w;
    } else if (fit === 'height') {
      ratio = h;
    } else {
      if (fit) {
        // 完整显示取小的
        ratio = w > h ? h : w;
      } else {
        ratio = w > h ? w : h;
      }
    }
    if (this.store.data.fits?.length) {
      this.canvas.opening = true;
    }
    // 该方法直接更改画布的 scale 属性，所以比率应该乘以当前 scale
    this.scale(ratio * this.store.data.scale);

    // 5. 居中
    this.centerSizeView();
    if (fill && this.store.data.fits?.length) {
      this.fillView();
    }
  }

  centerSizeView() {
    // if (!this.hasView()) return;
    const viewCenter = this.getViewCenter();
    //根据画布尺寸居中对齐
    const _width = this.store.data.width || this.store.options.width;
    const _height = this.store.data.height || this.store.options.height;
    const pensRect: any = {
      x: 0,
      y: 0,
      width: _width,
      height: _height,
    };
    calcCenter(pensRect);
    const { center } = pensRect;
    const { scale, origin, x: dataX, y: dataY } = this.store.data;
    this.translate(
      (viewCenter.x - origin.x) / scale - center.x - dataX / scale,
      (viewCenter.y - origin.y) / scale - center.y - dataY / scale
    );
    const { canvas } = this.canvas;
    const x = (canvas.scrollWidth - canvas.offsetWidth) / 2;
    const y = (canvas.scrollHeight - canvas.offsetHeight) / 2;
    canvas.scrollTo(x, y);
  }

  /**
   * 宽度放大到屏幕尺寸，并滚动到最顶部
   *
   */
  scrollView(viewPadding: Padding = 10, pageMode: boolean = false) {
    if (!this.hasView()) return;
    //滚动状态下
    if (!this.canvas.scroll) {
      return;
    }
    const { canvas } = this.canvas;
    const { offsetWidth: width, offsetHeight: height } = canvas;
    this.resize(width, height);
    const padding = formatPadding(viewPadding);
    let rect = null;
    const w = this.store.data.width || this.store.options.width;
    const h = this.store.data.height || this.store.options.height;
    if (w && h) {
      rect = {
        width: w * this.store.data.scale,
        height: h * this.store.data.scale,
      };
    } else {
      rect = this.getRect();
    }
    const ratio = (width - padding[1] - padding[3]) / rect.width;
    this.scale(ratio * this.store.data.scale);

    this.topView(padding[0]);
    if (pageMode) {
      this.canvas.scroll.changeMode(padding[0]);
    }
  }

  screenView(viewPadding: Padding = 10, WorH: boolean = true) {
    if (!this.hasView()) return;
    const { canvas } = this.canvas;
    const { offsetWidth: width, offsetHeight: height } = canvas;
    this.resize(width, height);
    const padding = formatPadding(viewPadding);
    const rect = this.getRect();
    //默认宽度充满
    let ratio = (width - padding[1] - padding[3]) / rect.width;
    if (!WorH) {
      ratio = (height - padding[0] - padding[2]) / rect.height;
    }
    this.scale(ratio * this.store.data.scale);
    //height充满时是居中
    this.topView(padding[0]);
  }

  topView(paddingTop: number = 10) {
    if (!this.hasView()) return;
    const rect = this.getRect();
    const viewCenter = this.getViewCenter();
    const w = this.store.data.width || this.store.options.width;
    const h = this.store.data.height || this.store.options.height;
    let pensRect: any = null;
    if (w && h) {
      pensRect = {
        x: 0,
        y: 0,
        width: w,
        height: h,
      };
    } else {
      pensRect = this.getPenRect(rect);
    }
    calcCenter(pensRect);
    const { center } = pensRect;
    const { scale, origin, x: dataX, y: dataY } = this.store.data;

    this.translate(
      (viewCenter.x - origin.x) / scale - center.x - dataX / scale,
      (paddingTop - origin.y) / scale - pensRect.y - dataY / scale
    );
    const { canvas } = this.canvas;
    const x = (canvas.scrollWidth - canvas.offsetWidth) / 2;
    const y = (canvas.scrollHeight - canvas.offsetHeight) / 2;
    canvas.scrollTo(x, y);
  }

  centerView() {
    if (!this.hasView()) return;
    const rect = this.getRect();
    const viewCenter = this.getViewCenter();
    const pensRect: Rect = this.getPenRect(rect);
    calcCenter(pensRect);
    const { center } = pensRect;
    const { scale, origin, x: dataX, y: dataY } = this.store.data;
    // center 的值，在缩放和拖拽画布过程中不发生变化，是相对值
    // viewCenter 是一个绝对值，需要根据 origin 的值，来计算出相对的值
    // store.data.x 是画布偏移值，在 translate 方法中与 scale 相关，这里也需要计算
    this.translate(
      (viewCenter.x - origin.x) / scale - center.x - dataX / scale,
      (viewCenter.y - origin.y) / scale - center.y - dataY / scale
    );
    const { canvas } = this.canvas;
    const x = (canvas.scrollWidth - canvas.offsetWidth) / 2;
    const y = (canvas.scrollHeight - canvas.offsetHeight) / 2;
    canvas.scrollTo(x, y);
  }

  /**
   * 画布是否有 画笔
   * RuleLine 不算
   */
  hasView(): boolean {
    return !!this.store.data.pens.filter((pen) => !pen.isRuleLine).length;
  }

  private getViewCenter() {
    const { width, height } = this.canvas;
    return {
      x: width / 2,
      y: height / 2,
    };
  }

  /**
   * 大小相同
   * @param pens 画笔们
   */
  beSameByFirst(pens: Pen[] = this.store.data.pens, attribute?: string) {
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下

    // 1. 得到第一个画笔的 宽高
    const firstPen = pens[0];
    const { width, height } = this.getPenRect(firstPen);
    for (let i = 1; i < pens.length; i++) {
      const pen = pens[i];
      if (attribute === 'width') {
        this.setValue({ id: pen.id, width }, { render: false, doEvent: false });
      } else if (attribute === 'height') {
        this.setValue(
          { id: pen.id, height },
          { render: false, doEvent: false }
        );
      } else {
        this.setValue(
          { id: pen.id, width, height },
          { render: false, doEvent: false }
        );
      }
    }
    this.render();

    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  /**
   * 大小相同
   * @param pens 画笔们
   */
  beSameByLast(pens: Pen[] = this.store.data.pens, attribute?: string) {
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下

    // 1. 得到最后一个画笔的 宽高
    const lastPen = pens[pens.length - 1];
    const { width, height } = this.getPenRect(lastPen);
    for (let i = 0; i < pens.length - 1; i++) {
      const pen = pens[i];
      if (attribute === 'width') {
        this.setValue({ id: pen.id, width }, { render: false, doEvent: false });
      } else if (attribute === 'height') {
        this.setValue(
          { id: pen.id, height },
          { render: false, doEvent: false }
        );
      } else {
        this.setValue(
          { id: pen.id, width, height },
          { render: false, doEvent: false }
        );
      }
    }
    this.render();

    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }
  /**
   * 格式刷（样式相同，大小无需一致。）
   * @param pens 画笔们
   */
  formatPainterByFirst(pens: Pen[] = this.store.data.pens) {
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下
    const firstPen = pens[0];
    // 格式刷修改的属性，除开宽高
    const attrs = {};
    formatAttrs.forEach((attr) => {
      attrs[attr] = firstPen[attr];
    });

    for (let i = 1; i < pens.length; i++) {
      const pen = pens[i];
      this.setValue(
        { id: pen.id, ...defaultFormat,...attrs },
        { render: false, doEvent: false }
      );
    }
    this.render();

    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }
  /**
   * 格式刷（样式相同，大小无需一致。）
   * @param pens 画笔们
   */
  formatPainterByLast(pens: Pen[] = this.store.data.pens) {
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下
    const firstPen = pens[pens.length - 1];
    // 格式刷修改的属性，除开宽高
    const attrs = {};
    formatAttrs.forEach((attr) => {
      attrs[attr] = firstPen[attr];
    });

    for (let i = 0; i < pens.length - 1; i++) {
      const pen = pens[i];
      this.setValue(
        { id: pen.id, ...defaultFormat,...attrs },
        { render: false, doEvent: false }
      );
    }
    this.render();

    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }
  setFormatPainter() {
    const pens = this.store.active;
    const attrs = {};
    if (pens.length > 0) {
      const firstPen = pens[0];
      formatAttrs.forEach((attr) => {
        attrs[attr] =
          firstPen[attr] !== undefined
            ? firstPen[attr]
            : this.store.options.defaultFormat[attr] ||
              this.store.data[attr] ||
              this.store.options[attr];
      });
    } else {
      //默认值
      const attrs = {};
      formatAttrs.forEach((attr) => {
        attrs[attr] =
          this.store.options.defaultFormat[attr] ||
          this.store.data[attr] ||
          this.store.options[attr] ||
          undefined;
      });
    }
    localStorage.setItem('meta2d-formatPainter', JSON.stringify(attrs));
  }

  formatPainter() {
    const pens = this.store.active;
    const initPens = deepClone(pens);
    const attrs = JSON.parse(localStorage.getItem('meta2d-formatPainter'));
    for (let i = 0; i < pens.length; i++) {
      const pen = pens[i];
      this.setValue(
        { id: pen.id, ...defaultFormat,...attrs },
        { render: false, doEvent: false }
      );
    }
    this.render();

    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  clearFormatPainter() {
    const pens = this.store.active;
    const initPens = deepClone(pens);
    formatAttrs.forEach((attr) => {
      for (let i = 0; i < pens.length; i++) {
        const pen = pens[i];
        const { fontSize, lineHeight } = this.store.options;
        if (attr === 'lineWidth') {
          pen.lineWidth = 1;
          pen.calculative.lineWidth = 1;
        } else if (attr === 'fontSize') {
          pen.fontSize = fontSize;
          pen.calculative.fontSize = fontSize;
        } else if (attr === 'lineHeight') {
          pen.lineHeight = lineHeight;
          pen.calculative.lineHeight = lineHeight;
        } else {
          delete pen[attr];
          delete pen.calculative[attr];
        }
      }
    });
    this.render();
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  alignNodes(align: string, pens: Pen[] = this.store.data.pens, rect?: Rect) {
    !rect && (rect = this.getPenRect(this.getRect(pens)));
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下
    for (const item of pens) {
      this.alignPen(align, item, rect);
    }
    this.initImageCanvas(pens);
    this.initTemplateCanvas(pens);
    this.render();
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  //对齐大屏
  alignNodesV(
    align: string,
    pens: Pen[] = this.store.data.pens,
    whole: boolean = false
  ) {
    const width = this.store.data.width || this.store.options.width;
    const height = this.store.data.height || this.store.options.height;
    let rect = {
      x: 0,
      y: 0,
      width,
      height,
    };
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下
    if (whole) {
      const scale = this.store.data.scale;
      const rect = this.getRect(pens);
      const x = (rect.x - this.store.data.origin.x) / scale;
      const y = (rect.y - this.store.data.origin.y) / scale;
      const w = rect.width / scale;
      const h = rect.height / scale;
      let moveX = 0;
      let moveY = 0;
      switch (align) {
        case 'left':
          moveX = -x;
          break;
        case 'right':
          moveX = width - (x + w);
          break;
        case 'top':
          moveY = -y;
          break;
        case 'bottom':
          moveY = height - (y + h);
          break;
        case 'center':
          moveX = width / 2 - (x + w / 2);
          break;
        case 'middle':
          moveY = height / 2 - (y + h / 2);
          break;
      }
      this.translatePens(pens, moveX * scale, moveY * scale);
    } else {
      for (const item of pens) {
        this.alignPen(align, item, rect);
      }
    }
    this.initImageCanvas(pens);
    this.initTemplateCanvas(pens);
    this.render();
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  /**
   * 对齐画笔，基于第一个画笔
   * @param align 左对齐，右对齐，上对齐，下对齐，居中对齐
   * @param pens
   */
  alignNodesByFirst(align: string, pens: Pen[] = this.store.data.pens) {
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下
    const firstPen = pens[0];
    const rect = this.getPenRect(firstPen);
    for (let i = 1; i < pens.length; i++) {
      const pen = pens[i];
      this.alignPen(align, pen, rect);
    }
    this.initImageCanvas(pens);
    this.initTemplateCanvas(pens);
    this.render();
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  /**
   * 对齐画笔，基于最后选中的画笔
   * @param align 左对齐，右对齐，上对齐，下对齐，居中对齐
   * @param pens
   */
  alignNodesByLast(align: string, pens: Pen[] = this.store.data.pens) {
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下
    const lastPen = pens[pens.length - 1];
    const rect = this.getPenRect(lastPen);
    for (let i = 0; i < pens.length - 1; i++) {
      const pen = pens[i];
      this.alignPen(align, pen, rect);
    }
    this.initImageCanvas(pens);
    this.initTemplateCanvas(pens);
    this.render();
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  /**
   * 将画笔参照 rect 进行 align 对齐
   * @param align 左对齐，右对齐，上对齐，下对齐，居中对齐
   * @param pen 当前需要对齐的画笔
   * @param rect 参照矩形
   * @returns
   */
  private alignPen(align: string, pen: Pen, rect: Rect) {
    const penRect = this.getPenRect(pen);
    switch (align) {
      case 'left':
        penRect.x = rect.x;
        break;
      case 'right':
        penRect.x = rect.x + rect.width - penRect.width;
        break;
      case 'top':
        penRect.y = rect.y;
        break;
      case 'bottom':
        penRect.y = rect.y + rect.height - penRect.height;
        break;
      case 'center':
        penRect.x = rect.x + rect.width / 2 - penRect.width / 2;
        break;
      case 'middle':
        penRect.y = rect.y + rect.height / 2 - penRect.height / 2;
        break;
    }
    this.setValue(
      { id: pen.id, ...penRect },
      { render: false, doEvent: false }
    );
  }

  /**
   * 水平或垂直方向的均分
   * @param direction 方向，width 说明水平方向间距相同
   * @param pens 节点们，默认全部的
   * @param distance 总的宽 or 高
   */
  private spaceBetweenByDirection(
    direction: 'width' | 'height',
    pens: Pen[] = this.store.data.pens,
    distance?: number
  ) {
    //TODO 暂时修复，待优化
    // !distance && (distance = this.getPenRect(this.getRect(pens))[direction]);
    if (!distance) {
      let start = Infinity,
        end = -Infinity,
        key = direction === 'width' ? 'x' : 'y';
      pens.forEach((item) => {
        start = Math.min(start, item.calculative.worldRect[key]);
        end = Math.max(end, item.calculative.worldRect['e' + key]);
      });
      distance = (end - start) / this.store.data.scale;
    }
    // 过滤出非父节点
    pens = pens.filter((item) => !item.parentId);
    if (pens.length <= 2) {
      return;
    }
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下
    // 计算间距
    const allDistance = pens.reduce((distance: number, currentPen: Pen) => {
      const currentPenRect = this.getPenRect(currentPen);
      return distance + currentPenRect[direction];
    }, 0);
    const space = (distance - allDistance) / (pens.length - 1);

    // 按照大小顺序排列画笔
    pens = pens.sort((a: Pen, b: Pen) => {
      if (direction === 'width') {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    const pen0Rect = this.getPenRect(pens[0]);
    let left = direction === 'width' ? pen0Rect.x : pen0Rect.y;
    for (const pen of pens) {
      const penRect = this.getPenRect(pen);
      direction === 'width' ? (penRect.x = left) : (penRect.y = left);
      left += penRect[direction] + space;
      this.setValue(
        { id: pen.id, ...penRect },
        { render: false, doEvent: false }
      );
    }
    this.initImageCanvas(pens);
    this.initTemplateCanvas(pens);
    this.render();
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  spaceBetween(pens?: Pen[], width?: number) {
    this.spaceBetweenByDirection('width', pens, width);
  }

  spaceBetweenColumn(pens?: Pen[], height?: number) {
    this.spaceBetweenByDirection('height', pens, height);
  }

  layout(
    pens: Pen[] = this.store.data.pens,
    width?: number,
    space: number = 30
  ) {
    const rect = this.getPenRect(getRect(pens));
    !width && (width = rect.width);

    // 1. 拿到全部节点中最大的高
    pens = pens.filter((item) => !item.type && !item.parentId);
    const initPens = deepClone(pens); // 原 pens ，深拷贝一下
    let maxHeight = 0;

    pens.forEach((pen: Pen) => {
      const penRect = this.getPenRect(pen);
      penRect.height > maxHeight && (maxHeight = penRect.height);
    });

    // 2. 遍历节点调整位置
    let currentX = rect.x;
    let currentY = rect.y;
    pens.forEach((pen: Pen, index: number) => {
      const penRect = this.getPenRect(pen);
      penRect.x = currentX;
      penRect.y = currentY + maxHeight / 2 - penRect.height / 2;

      this.setValue(
        { id: pen.id, ...penRect },
        { render: false, doEvent: false }
      );

      if (index === pens.length - 1) {
        return;
      }
      const currentWidth = currentX + penRect.width - rect.x;
      const nextPenRect = this.getPenRect(pens[index + 1]);
      if (
        Math.round(width - currentWidth) >=
        Math.round(nextPenRect.width + space)
      )
        // 当前行
        currentX += penRect.width + space;
      else {
        // 换行
        currentX = rect.x;
        currentY += maxHeight + space;
      }
    });
    this.initImageCanvas(pens);
    this.initTemplateCanvas(pens);
    this.render();
    this.pushHistory({
      type: EditType.Update,
      initPens,
      pens,
    });
  }

  gotoView(pen: Pen) {
    const center = this.getViewCenter();
    const x =
      center.x -
      pen.calculative.worldRect.x -
      pen.calculative.worldRect.width / 2;
    const y =
      center.y -
      pen.calculative.worldRect.y -
      pen.calculative.worldRect.height / 2;

    if (this.canvas.scroll && this.canvas.scroll.isShow) {
      this.canvas.scroll.translate(
        x - this.store.data.x,
        y - this.store.data.y
      );
    }

    this.store.data.x = x;
    this.store.data.y = y;

    for (const pen of this.store.data.pens) {
      calcInView(pen);
    }
    this.canvas.canvasImage.init();
    this.canvas.canvasImageBottom.init();
    this.render();
  }

  showMap() {
    if (!this.map) {
      this.map = new ViewMap(this.canvas);
    }
    this.map.show();
  }

  hideMap() {
    this.map.hide();
  }

  onSizeUpdate() {
    if (this.mapTimer) {
      clearTimeout(this.mapTimer);
      this.mapTimer = undefined;
    }

    this.mapTimer = setTimeout(() => {
      if (this.map && this.map.isShow) {
        this.map.show();
      }
      if (this.canvas && this.canvas.scroll && this.canvas.scroll.isShow) {
        this.canvas.scroll.resize();
      }
    }, 500);
  }

  toggleAnchorMode() {
    this.canvas.toggleAnchorMode();
  }

  addAnchorHand() {
    this.canvas.addAnchorHand();
  }

  removeAnchorHand() {
    this.canvas.removeAnchorHand();
  }

  toggleAnchorHand() {
    this.canvas.toggleAnchorHand();
  }

  /**
   * 将该画笔置顶，即放到数组最后，最后绘制即在顶部
   * @param pens pen 置顶的画笔
   */
  top(pens?: Pen | Pen[]) {
    if (!pens) pens = this.store.active;
    if (!Array.isArray(pens)) pens = [pens]; // 兼容
    for (const pen of pens as Pen[]) {
      const _pens = this.store.data.pens;
      // 获取它包含它的子节点
      const allIds = [...getAllChildren(pen, this.store), pen].map((p) => p.id);
      const allPens = _pens.filter((p) => allIds.includes(p.id));
      allPens.forEach((pen) => {
        const index = _pens.findIndex((p: Pen) => p.id === pen.id);
        if (index > -1) {
          _pens.push(_pens[index]);
          _pens.splice(index, 1);
          this.initTemplateCanvas([pen]);
          this.initImageCanvas([pen]);
        }
        this.specificLayerMove(pen, 'top');
      });
    }
    this.store.emitter.emit('layer', { type: 'top', pens });
  }

  /**
   * 若本次改变的画笔存在图片，并且在上层 or 下层，需要擦除上层 or 下层
   * 子节点中包含图片，也需要重绘
   * @param pens 本次改变的 pens
   */
  initImageCanvas(pens: Pen[]) {
    this.canvas && this.canvas.initImageCanvas(pens);
  }

  /**
   * 模版图元图层改变
   * @param pens 本次改变的 pens
   */
  initTemplateCanvas(pens: Pen[]) {
    this.canvas && this.canvas.initTemplateCanvas(pens);
  }

  /**
   * 该画笔置底，即放到数组最前，最后绘制即在底部
   * @param pens 画笔们，注意 pen 必须在该数组内才有效
   */
  bottom(pens?: Pen | Pen[]) {
    if (!pens) pens = this.store.active;
    if (!Array.isArray(pens)) pens = [pens]; // 兼容
    for (const pen of pens as Pen[]) {
      const _pens = this.store.data.pens;
      const allIds = [...getAllChildren(pen, this.store), pen].map((p) => p.id);
      const allPens = _pens.filter((p) => allIds.includes(p.id));
      // 从后往前，保证 allPens 顺序不变
      for (let i = allPens.length - 1; i >= 0; i--) {
        const pen = allPens[i];
        const index = _pens.findIndex((p: Pen) => p.id === pen.id);
        if (index > -1) {
          _pens.unshift(_pens[index]);
          _pens.splice(index + 1, 1);
          this.initTemplateCanvas([pen]);
          this.initImageCanvas([pen]);
        }
        this.specificLayerMove(pen, 'bottom');
      }
    }
    this.store.emitter.emit('layer', { type: 'bottom', pens });
  }

  /**
   * data.pens 决定了绘制顺序，即越后面的越在上层
   * 该方法通过区域重叠计算，找出该画笔之后第一个与其重叠的画笔，然后把该画笔放到找出的画笔之后
   * @param pen 画笔
   */
  upByArea(pen: Pen) {
    const index = this.store.data.pens.findIndex((p) => p.id === pen.id);
    if (index === -1) {
      // 画笔不在画布上，不处理
      console.warn('upByArea: pen not in canvas');
      return;
    }
    const allPens = [pen, ...getAllChildren(pen, this.store)];
    let allIndexs = allPens.map((p) =>
      this.store.data.pens.findIndex((p2) => p2.id === p.id)
    );

    if (allIndexs.includes(-1)) {
      // 画笔不在画布上，脏数据
      console.warn('upByArea: pen children not in canvas');
      allIndexs = allIndexs.filter((i) => i !== -1);
    }

    const minIndex = Math.min(...allIndexs);
    const penRect = pen.calculative.worldRect;
    const nextHitIndex = this.store.data.pens.findIndex((p, i) => {
      if (i <= minIndex) {
        // 不考虑前面的
        return false;
      }
      if (p.id === pen.id || isAncestor(p, pen)) {
        // 不考虑后代和自身
        return false;
      }
      const currentRect = p.calculative.worldRect;
      return rectInRect(penRect, currentRect);
    });

    if (nextHitIndex === -1) {
      this.up(pen);
      return;
    }

    this.store.data.pens.splice(nextHitIndex + 1, 0, ...allPens);

    // 删除靠前的 allPens
    for (const pen of allPens) {
      const index = this.store.data.pens.findIndex((p) => p.id === pen.id);
      if (index > -1) {
        this.store.data.pens.splice(index, 1);
      }
    }

    this.initImageCanvas([pen]);
  }

  //特殊图元层级处理
  specificLayerMove(pen: Pen, type: string) {
    //image
    if (pen.image && pen.name !== 'gif') {
      // let isBottom = false;
      // if (type === 'bottom' || type === 'down') {
      //   isBottom = true;
      // }
      // this.setValue(
      //   { id: pen.id, isBottom },
      //   { render: false, doEvent: false, history: false }
      // );
      let layer = CanvasLayer.CanvasImageBottom;
      if (type === 'top') {
        layer = CanvasLayer.CanvasImage;
      } else if (type === 'up' || type === 'down') {
        layer = CanvasLayer.CanvasMain;
      }
      this.setValue(
        { id: pen.id, canvasLayer: layer },
        { render: false, doEvent: false, history: false }
      );
    } else if (pen.externElement || pen.name === 'gif') {
      let zIndex = 0;
      // let zIndex = pen.calculative.zIndex === undefined ? 5 : pen.calculative.zIndex + 1;
      if (type === 'top') {
        pen.calculative.canvas.maxZindex += 1;
        zIndex = pen.calculative.canvas.maxZindex;
      } else if (type === 'up') {
        zIndex =
          pen.calculative.zIndex === undefined ? 6 : pen.calculative.zIndex + 1;
      } else if (type === 'down') {
        zIndex =
          pen.calculative.zIndex === undefined ? 3 : pen.calculative.zIndex - 1;
        if (zIndex < 0) {
          zIndex = 0;
        }
      }
      this.setValue(
        { id: pen.id, zIndex },
        { render: false, doEvent: false, history: false }
      );
      pen.calculative.singleton?.div &&
        setElemPosition(pen, pen.calculative.singleton.div);
    }
  }

  /**
   * 该画笔上移，即把该画笔在数组中的位置向后移动一个
   * @param pens 画笔
   */
  up(pens?: Pen | Pen[]) {
    if (!pens) pens = this.store.active;
    if (!Array.isArray(pens)) pens = [pens]; // 兼容
    for (const pen of pens as Pen[]) {
      const _pens = this.store.data.pens;
      if (pen.children && pen.children.length) {
        //组合图元
        const preMovePens = [...getAllChildren(pen, this.store), pen];
        //先保证组合图元的顺序正确。
        const orderPens = [];
        for (let index = 0; index < _pens.length; index++) {
          const _pen: any = _pens[index];
          if (preMovePens.findIndex((p: Pen) => p.id === _pen.id) !== -1) {
            _pen.temIndex = index;
            orderPens.push(_pen);
          }
        }
        let lastIndex = -1;
        let offset = 0;
        orderPens.forEach((_pen: any) => {
          _pen.temIndex -= offset;
          _pens.splice(_pen.temIndex, 1);
          offset += 1;
          lastIndex = _pen.temIndex;
          delete _pen.temIndex;
          this.specificLayerMove(_pen, 'up');
        });
        _pens.splice(lastIndex + 1, 0, ...orderPens);
        this.initTemplateCanvas(orderPens);
        this.initImageCanvas(orderPens);
      } else {
        const index = _pens.findIndex((p: Pen) => p.id === pen.id);
        if (index > -1 && index !== _pens.length - 1) {
          _pens.splice(index + 2, 0, _pens[index]);
          _pens.splice(index, 1);
          this.initTemplateCanvas([pen]);
          this.initImageCanvas([pen]);
        }
        this.specificLayerMove(pen, 'up');
      }
    }
    this.store.emitter.emit('layer', { type: 'up', pens });
  }

  /**
   * 该画笔下移，即把该画笔在该数组中的位置前移一个
   * @param pen 画笔
   */
  down(pens?: Pen | Pen[]) {
    if (!pens) pens = this.store.active;
    if (!Array.isArray(pens)) pens = [pens]; // 兼容
    for (const pen of pens as Pen[]) {
      const _pens = this.store.data.pens;
      if (pen.children && pen.children.length) {
        //组合图元
        const preMovePens = [...getAllChildren(pen, this.store), pen];
        //先保证组合图元的顺序正确。
        const orderPens = [];
        for (let index = 0; index < _pens.length; index++) {
          const _pen: any = _pens[index];
          if (preMovePens.findIndex((p: Pen) => p.id === _pen.id) !== -1) {
            _pen.temIndex = index;
            orderPens.push(_pen);
          }
        }
        let firstIndex = -1;
        let offset = 0;
        orderPens.forEach((_pen: any, index) => {
          _pen.temIndex -= offset;
          _pens.splice(_pen.temIndex, 1);
          offset += 1;
          if (index === 0) {
            firstIndex = _pen.temIndex;
          }
          delete _pen.temIndex;
          this.specificLayerMove(_pen, 'down');
        });
        _pens.splice(firstIndex - 1, 0, ...orderPens);
        this.initTemplateCanvas(orderPens);
        this.initImageCanvas(orderPens);
      } else {
        const index = _pens.findIndex((p: Pen) => p.id === pen.id);
        if (index > -1 && index !== 0) {
          _pens.splice(index - 1, 0, _pens[index]);
          _pens.splice(index + 1, 1);
          this.initTemplateCanvas([pen]);
          this.initImageCanvas([pen]);
        }
        this.specificLayerMove(pen, 'down');
      }
    }
    this.store.emitter.emit('layer', { type: 'down', pens });
  }

  setLayer(pen: Pen, toIndex: number, pens = this.store.data.pens) {
    const index = pens.findIndex((p: Pen) => p.id === pen.id);
    if (index > -1) {
      if (index > toIndex) {
        // 原位置在后，新位置在前
        pens.splice(toIndex, 0, pens[index]);
        pens.splice(index + 1, 1);
      } else if (index < toIndex) {
        // 新位置在后
        pens.splice(toIndex, 0, pens[index]);
        pens.splice(index, 1);
      }
    }
    this.initTemplateCanvas([pen]);
    this.initImageCanvas([pen]);
  }

  changePenId(oldId: string, newId: string): void {
    this.canvas.changePenId(oldId, newId);
  }

  /**
   * 得到与当前节点连接的线
   * @param node 节点，非连线
   * @param type 类型，全部的连接线/入线/出线
   */
  getLines(node: Pen, type: 'all' | 'in' | 'out' = 'all'): Pen[] {
    if (node.type === PenType.Line) {
      return [];
    }
    const lines: Pen[] = [];
    node.connectedLines?.forEach(({ lineId }) => {
      const line = this.store.pens[lineId];
      if (!line) {
        console.warn(node, 'node contain a error connectedLine');
        return;
      }
      if (lines.find((_line) => _line.id === line.id)) {
        //去重
        return;
      }
      switch (type) {
        case 'all':
          lines.push(line);
          break;
        case 'in':
          // 进入该节点的线，即 线锚点的最后一个 connectTo 对应该节点
          getToAnchor(line).connectTo === node.id && lines.push(line);
          break;
        case 'out':
          // 从该节点出去的线，即 线锚点的第一个 connectTo 对应该节点
          getFromAnchor(line).connectTo === node.id && lines.push(line);
          break;
      }
    });

    return lines;
  }

  /**
   * 得到当前节点的下一个节点，即出口节点数组
   * 得到当前连线的出口节点
   * @param pen 节点或连线
   */
  nextNode(pen: Pen): Pen[] {
    if (pen.type === PenType.Line) {
      const nextNode = this.store.pens[getToAnchor(pen).connectTo];
      return nextNode ? [nextNode] : [];
    } else {
      // 1. 得到所有的出线
      const lines = this.getLines(pen, 'out');
      const nextNodes: Pen[] = [];
      // 2. 遍历出线的 nextNode
      lines.forEach((line) => {
        const lineNextNode = this.nextNode(line);
        for (const node of lineNextNode) {
          const have = nextNodes.find((next) => next.id === node.id);
          // 3. 不重复的才加进去
          !have && nextNodes.push(node);
        }
      });
      return nextNodes;
    }
  }

  /**
   * 得到当前节点的上一个节点，即入口节点数组
   * 得到当前连线的入口节点
   * @param pen 节点或连线
   */
  previousNode(pen: Pen): Pen[] {
    if (pen.type === PenType.Line) {
      const preNode = this.store.pens[getFromAnchor(pen).connectTo];
      return preNode ? [preNode] : [];
    } else {
      // 1. 得到所有的入线
      const lines = this.getLines(pen, 'in');
      const preNodes: Pen[] = [];
      // 2. 遍历入线的 preNode
      lines.forEach((line) => {
        const linePreNode = this.previousNode(line);
        for (const node of linePreNode) {
          const have = preNodes.find((pre) => pre.id === node.id);
          // 3. 不重复的才加进去
          !have && preNodes.push(node);
        }
      });
      return preNodes;
    }
  }

  /**
   * 获取节点所有的下一个连接关系
   * @param pen
   *
   */
  getNext(pen: Pen): any[] {
    if (pen.type === PenType.Line) {
      console.warn('非连线节点');
      return;
    }
    const next: any[] = [];
    pen.connectedLines?.forEach(({ lineId, anchor }) => {
      const fromAnchor = pen.anchors?.filter(
        (_anchor) => _anchor.id === anchor
      )[0];
      const line = this.findOne(lineId);
      if (line.anchors[0].connectTo == pen.id) {
        //from
        const connectTo = line.anchors[line.anchors.length - 1].connectTo;
        if (connectTo) {
          const _next: Pen = this.findOne(connectTo);
          const connectedLine = _next.connectedLines?.filter(
            (item) => item.lineId === line.id
          )[0];
          const penAnchor = _next.anchors.filter(
            (_anchor) => _anchor.id === connectedLine.anchor
          )[0];
          next.push({
            from: pen,
            fromAnchor,
            line,
            to: _next,
            toAnchor: penAnchor,
          });
        }
      }
    });
    return next;
  }

  /**
   * 为画布添加锚点
   * @param pen 画笔
   * @param anchor 待添加锚点
   * @param index 连线类型 添加锚点到哪个位置
   */
  addAnchor(pen: Pen, anchor: Point, index?: number) {
    if (!pen) {
      return;
    }
    if (!pen.anchors) {
      pen.anchors = [];
    }
    if (!pen.calculative.worldAnchors) {
      pen.calculative.worldAnchors = [];
    }
    if (pen.type === PenType.Line) {
      if (index < 0) {
        index = pen.anchors.length + 1 + index;
      }
      if (index > pen.anchors.length) {
        index = pen.anchors.length;
      }
      if (index < 0) {
        index = 0;
      }
      if (
        (index == 0 && pen.anchors[0].connectTo) ||
        (index == pen.anchors.length && pen.anchors[index - 1].connectTo)
      ) {
        console.warn('端点存在连接关系');
        return;
      }
    }
    let _anchor = null;
    let _worldAnchor = null;
    if (anchor.x <= 1 && anchor.x >= 0 && anchor.y <= 1 && anchor.y >= 0) {
      //relative
      _worldAnchor = {
        id: anchor.id || s8(),
        penId: pen.id,
        x:
          pen.calculative.worldRect.x +
          pen.calculative.worldRect.width * anchor.x,
        y:
          pen.calculative.worldRect.y +
          pen.calculative.worldRect.height * anchor.y,
      };
      if (pen.calculative.worldRect) {
        if (pen.rotate % 360) {
          rotatePoint(
            _worldAnchor,
            pen.rotate,
            pen.calculative.worldRect.center
          );
        }
      }
      _anchor = {
        id: _worldAnchor.id,
        penId: pen.id,
        x: anchor.x,
        y: anchor.y,
      };
    } else {
      //absolute
      _worldAnchor = {
        id: anchor.id || s8(),
        penId: pen.id,
        x: anchor.x,
        y: anchor.y,
      };
      if (pen.calculative.worldRect) {
        if (pen.rotate % 360) {
          rotatePoint(anchor, -pen.rotate, pen.calculative.worldRect.center);
        }
        _anchor = {
          id: _worldAnchor.id,
          penId: pen.id,
          x:
            (anchor.x - pen.calculative.worldRect.x) /
            pen.calculative.worldRect.width,
          y:
            (anchor.y - pen.calculative.worldRect.y) /
            pen.calculative.worldRect.height,
        };
      }
    }

    if (pen.type === PenType.Line) {
      //Line
      pen.calculative.worldAnchors.splice(index, 0, _worldAnchor);
      pen.anchors.splice(index, 0, _anchor);
      this.canvas.updateLines(pen);
      this.canvas.initLineRect(pen);
      this.render();
    } else {
      //Node
      pen.calculative.worldAnchors.push(_worldAnchor);
      pen.anchors.push(_anchor);
    }
  }
  /**
   *
   * @param from 连接节点
   * @param fromAnchor 连接节点锚点
   * @param to 被连接节点
   * @param toAnchor 被连接节点锚点
   */
  connectLine(
    from: Pen,
    to: Pen,
    fromAnchor?: Point,
    toAnchor?: Point,
    render: boolean = true
  ): Pen {
    if (!fromAnchor) {
      const _worldRect = to.calculative.worldRect;
      fromAnchor = nearestAnchor(from, {
        x: _worldRect.x + _worldRect.width / 2,
        y: _worldRect.y + _worldRect.height / 2,
      });
    }
    if (!toAnchor) {
      const _worldRect = from.calculative.worldRect;
      toAnchor = nearestAnchor(to, {
        x: _worldRect.x + _worldRect.width / 2,
        y: _worldRect.y + _worldRect.height / 2,
      });
    }
    const absWidth = Math.abs(fromAnchor.x - toAnchor.x);
    const absHeight = Math.abs(fromAnchor.y - toAnchor.y);
    const line: Pen = {
      height: absHeight,
      lineName: 'line',
      lineWidth: 1,
      name: 'line',
      type: 1,
      width: absWidth,
      x: Math.min(fromAnchor.x, toAnchor.x),
      y: Math.min(fromAnchor.y, toAnchor.y),
      anchors: [
        {
          x: fromAnchor.x > toAnchor.x ? 1 : 0,
          y: fromAnchor.y > toAnchor.y ? 1 : 0,
          id: s8(),
        },
        {
          x: fromAnchor.x > toAnchor.x ? 0 : 1,
          y: fromAnchor.x > toAnchor.x ? 0 : 1,
          id: s8(),
        },
      ],
    };
    this.addPens([line]);

    connectLine(from, fromAnchor, line, line.calculative.worldAnchors[0]);
    connectLine(to, toAnchor, line, line.calculative.worldAnchors[1]);
    line.calculative.active = false;
    this.canvas.updateLines(line);
    this.canvas.updateLines(from);
    this.canvas.updateLines(to);
    this.canvas.initLineRect(line);
    if (render) {
      this.render();
    }
    return line;
  }
  /**
   * 生成一个拷贝组合后的 画笔数组（组合图形），不影响原画布画笔，常用作 二次复用的组件
   * @param pens 画笔数组
   * @param showChild 是否作为状态复用（参考 combine showChild）
   * @param anchor 是否产生默认的锚点
   * @returns 组合图形
   */
  toComponent(
    pens = this.store.data.pens,
    showChild?: number,
    anchor?: boolean
  ): Pen[] {
    if (pens.length === 1) {
      const pen: Pen = deepClone(pens[0]);
      pen.type = PenType.Node;
      pen.id = undefined;
      return [pen];
    }

    const components = deepClone(pens, true);
    const rect = getRect(components);
    let parent: Pen = {
      id: s8(),
      name: 'combine',
      ...rect,
      children: [],
      showChild,
    };

    if (anchor) {
      parent.anchors = [
        {
          id: '0',
          penId: parent.id,
          x: 0.5,
          y: 0,
        },
        {
          id: '1',
          penId: parent.id,
          x: 1,
          y: 0.5,
        },
        {
          id: '2',
          penId: parent.id,
          x: 0.5,
          y: 1,
        },
        {
          id: '3',
          penId: parent.id,
          x: 0,
          y: 0.5,
        },
      ];
    }
    //如果本身就是 一个 组合图元
    const parents = components.filter((pen) => !pen.parentId);
    const p = components.find((pen) => {
      return pen.width === rect.width && pen.height === rect.height;
    });
    const oneIsParent = p && showChild === undefined;
    if (parents.length === 1) {
      parent = parents[0];
    } else if (oneIsParent) {
      if (!p.children) {
        p.children = [];
      }
      parent = p;
    } else {
      // 不影响画布数据，生成一个组合图形便于二次复用
      // this.canvas.makePen(parent);
    }

    components.forEach((pen) => {
      if (pen === parent || pen.parentId === parent.id) {
        return;
      }
      if (pen.parentId) {
        // 已经是其它节点的子节点，x,y,w,h 已经是百分比了
        return;
      }
      parent.children.push(pen.id);
      pen.parentId = parent.id;
      const childRect = calcRelativeRect(pen.calculative.worldRect, rect);
      Object.assign(pen, childRect);
      pen.locked = pen.lockedOnCombine ?? LockState.DisableMove;
      // pen.type = PenType.Node;
    });

    return oneIsParent || parents.length === 1
      ? deepClone(components)
      : deepClone([parent, ...components]);
  }
  // TODO 安装pen插件 此处是否应当进行相关的适配？不再让插件内部处理install的目标逻辑？
  /**
   * @description 安装插件方法
   * @param plugins 插件列表及其配置项
   * @param pen {string | Pen} 接受tag、name、或者Pen对象*/
  installPenPlugins(
    pen: { tag?: string; name?: string; id?: string },
    plugins: PluginOptions[]
  ) {
    if (!pen.tag && !pen.name && !pen.id) return;
    let type;
    pen.id
      ? (type = 'id')
      : pen.tag
      ? (type = 'tag')
      : pen.name
      ? (type = 'name')
      : '';
    plugins.forEach((pluginConfig) => {
      let plugin = pluginConfig.plugin;
      let option = pluginConfig.options;
      if (!plugin) return;
      // 插件校验
      if (validationPlugin(plugin) && type) {
        plugin.install(pen, option);
        // 若当前不存在此插件
        if (!this.penPluginMap.has(plugin)) {
          this.penPluginMap.set(plugin, [{ [type]: pen[type], option }]);
        } else {
          let op = this.penPluginMap.get(plugin).find((i) => {
            return i[type] === pen[type];
          });
          // 存在替换
          if (op) {
            op.option = option;
          } else {
            this.penPluginMap.get(plugin).push({
              [type]: pen[type],
              option,
            });
          }
        }
      }
    });
  }

  uninstallPenPlugins(
    pen: { tag?: string; name?: string; id?: string },
    plugins: PluginOptions[]
  ) {
    let type;
    pen.id
      ? (type = 'id')
      : pen.tag
      ? (type = 'tag')
      : pen.name
      ? (type = 'name')
      : '';
    if (!type) return;
    plugins.forEach((pluginConfig) => {
      let plugin = pluginConfig.plugin;
      plugin.uninstall(pen, pluginConfig.options);
      let mapList = this.penPluginMap.get(plugin);
      let op = mapList.findIndex((i) => i[type] === pen[type]);
      if (op !== -1) {
        mapList.splice(op, 1);
        // TODO 在运行时 插件卸载后是否需要移除？
        if (mapList.length === 0) {
          this.penPluginMap.delete(plugin);
        }
      }
    });
  }

  setVisible(pen: Pen, visible: boolean, render = true) {
    this.onSizeUpdate();
    this.setValue({ id: pen.id, visible }, { render: false, doEvent: false });
    if (pen.children) {
      for (const childId of pen.children) {
        const child = this.store.pens[childId];
        child && this.setVisible(child, visible, false);
      }
    }
    let allPens = getAllChildren(pen, this.store);
    allPens.push(pen);
    this.initImageCanvas(allPens);
    render && this.render();
  }

  clearHover(): void {
    this.canvas.clearHover();
  }

  closeSocket() {
    this.closeWebsocket();
    this.closeMqtt();
    this.closeHttp();
  }

  setElemPosition = setElemPosition;

  setLifeCycleFunc = setLifeCycleFunc;
  destroy(onlyData?: boolean) {
    this.clear(false);
    clearIframes();
    this.stopDataMock();
    this.closeSocket();
    this.closeNetwork();
    this.closeAll();
    le5leTheme.destroyThemeSheet(this.store.id);
    this.store.emitter.all.clear(); // 内存释放
    this.canvas.destroy();
    this.canvas = undefined;
    globalStore[this.store.id] = undefined;
    if (!onlyData) {
      for (const k in globalStore) {
        delete globalStore[k];
      }
      globalStore.path2dDraws = {};
      globalStore.canvasDraws = {};
      globalStore.anchors = {};
      globalStore.htmlElements = {};
    }
  }
}
