import { Dialog } from './component/dialog';
import { inArray, inRange } from './math';
import { Meta2d } from './meta2d';
import { Condition, Event, EventType, Pen, PenAction, PenActionType, TargetType } from './models';
import { WorkerMessage } from './types';
import { getLocalVars, getter, getURLParams, replaceStringTemplateVars } from './utils';

export const events: { [key: number]: Function } = {
  [PenActionType.Link]: onLink,
  [PenActionType.SetProps]: onSetProps,
  [PenActionType.StartAnimate]: onStartAnimate,
  [PenActionType.PauseAnimate]: onPauseAnimate,
  [PenActionType.StopAnimate]: onStopAnimate,
  [PenActionType.JS]: onJS,
  [PenActionType.GlobalFn]: onGlobalFn,
  [PenActionType.Emit]: onEmit,
  [PenActionType.StartVideo]: onStartVideo,
  [PenActionType.PauseVideo]: onPauseVideo,
  [PenActionType.StopVideo]: onStopVideo,
  [PenActionType.Navigator]: onNavigator,
  [PenActionType.Dialog]: onDialog,
  [PenActionType.SendData]: onSendData,
  [PenActionType.PostMessage]: onPostMessage,
  [PenActionType.PostMessageToParent]: onPostMessageToParent,
  [PenActionType.MessageBox]: onMessageBox,
};

let vars: any = {};

const FnMap = new WeakMap<Object, Function>();

export function dispatchEvent(this: Meta2d, pen: Pen, typeOrEvents?: EventType | Event[]) {
  if (pen.disabled) {
    return;
  }
  let events: Event[] = [];
  if (typeof typeOrEvents === 'number') {
    events = pen.events?.filter((e) => e.type === typeOrEvents);
  } else {
    events = typeOrEvents;
  }

  if (!events || !events.length) {
    return;
  }

  for (const event of events) {
    const actions = event.actions;
    if (!actions || !actions.length) {
      continue;
    }

    // 判断条件是否成立
    if (shouldExecute.call(this, pen, event)) {
      executeActions.call(this, pen, actions);
    }
  }
}

export function executeActions(this: Meta2d, pen: Pen, actions: PenAction[]) {
  // 获取最新变量
  vars = globalThis.getVars ? globalThis.getVars() : getLocalVars();

  // 执行动作
  for (const action of actions) {
    if (action.timeout) {
      setTimeout(() => {
        events[action.type].call(this, pen, action);
      }, action.timeout);
    } else {
      events[action.type].call(this, pen, action);
    }
  }
}

export function shouldExecute(this: Meta2d, pen: Pen, event: Event) {
  let exec = false;
  if (event.conditions?.length) {
    if (event.isAny) {
      exec = event.conditions.some((condition) => {
        return judgeCondition.call(this, pen, condition);
      });
    } else {
      exec = event.conditions.every((condition) => {
        return judgeCondition.call(this, pen, condition);
      });
    }
  } else {
    exec = true;
  }
  return exec;
}

export function isRelated(conditions: Condition[], arr: string[]) {
  return conditions.some(
    (condition) => arr.includes(condition.key) || arr.some((k) => condition.fn?.includes('pen.' + k)),
  );
}

function judgeCondition(this: Meta2d, pen: Pen, condition: Condition) {
  const { type, target, fn, operator, targetType, targetKey, key } = condition;
  let can = false;
  if (type) {
    if (fn) {
      if (FnMap.has(condition)) {
        can = FnMap.get(condition)?.(pen, { meta2d: this });
      } else {
        try {
          const func = new Function('pen', 'context', fn) as (
            pen: Pen,
            context?: {
              meta2d: Meta2d;
            },
          ) => boolean;

          FnMap.set(condition, func);
          can = func(pen, { meta2d: this });
        } catch (err) {
          console.error('[meta2d]: 在创建函数时出现错误:', err, 'code:', fn);
          can = false;
        }
      }
    }
  } else {
    let value = target;
    if (targetType === TargetType.Pen) {
      value = this.penMap.get(target)[targetKey];
    }
    let compareValue = getter(pen, key);
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
        can = inRange(+compareValue, value);
        break;
      case '![)':
        can = !inRange(+compareValue, value);
        break;
      case '[]':
        can = inArray(compareValue, value);
        break;
      case '![]':
        can = !inArray(compareValue, value);
        break;
    }
  }
  return can;
}

function getSendData(meta2d: Meta2d, data: any[], pen: Pen) {
  if (!data) {
    return null;
  }
  const value: any = {};
  data.forEach((item: any) => {
    if (item.prop) {
      if (item.id && item.id !== '固定值') {
        const pen = meta2d.find(item.id)[0];
        value[item.prop] = getter(pen, item.key);
      } else {
        if (typeof item.value === 'string' && item.value.includes('${')) {
          value[item.prop] = replaceStringTemplatePenVars(item.value, pen, vars);
        } else {
          value[item.prop] = convertType(item.value, item.type);
        }
      }
    }
  });
  return value;
}

function convertType(value: string, type: string) {
  if (typeof value === 'string') {
    if (['switch', 'bool', 'boolean'].includes(type)) {
      if (value === 'false') {
        return false;
      } else if (value === 'true') {
        return true;
      }
    } else if (['integer', 'number', 'int', 'enum', 'double', 'float'].includes(type)) {
      if (!isNaN(Number(value))) {
        return Number(value);
      }
    }
  } else if (typeof value === 'object') {
    let bodyStr = JSON.stringify(value);
    bodyStr = replaceStringTemplateVars(bodyStr, vars);
    return JSON.parse(bodyStr);
  }
  return value;
}

function replaceStringTemplatePenVars(str: string, pen: Pen, vars: Record<string, any>) {
  return str.replace(/\${(.*?)}/g, (match, key) => {
    const val = getter(pen, key) || getter(vars, key);
    return val?.toString() || '';
  });
}

function onLink(this: Meta2d, pen: Pen, e: PenAction) {
  const { value, params } = e.payload;
  if (value && typeof value === 'string') {
    let url = value;
    if (url.includes('${')) {
      url = replaceStringTemplatePenVars(url, pen, vars);
    }
    window.open(url, params ?? '_blank');
    return;
  }
  console.warn('[meta2d] 链接地址不是字符串');
}

function onSetProps(this: Meta2d, pen: Pen, e: PenAction) {
  const { value } = e.payload;
  if (value && typeof value === 'object') {
    const pens = this.find(e.target || pen.id);
    const _value: any = {};
    for (let key in value) {
      if (value[key]?.id) {
        _value[key] = this.penMap.get(value[key].id)?.[value[key].key];
      } else {
        if (typeof value[key] === 'string' && value[key].includes('${')) {
          _value[key] = replaceStringTemplatePenVars(value[key], pen, vars);
        } else if (
          typeof value[key] === 'string' &&
          ((value[key].startsWith('{') && value[key].endsWith('}')) ||
            (value[key].startsWith('[') && value[key].endsWith(']')))
        ) {
          try {
            _value[key] = JSON.parse(value[key]);
          } catch (e) {
            _value[key] = value[key];
          }
        } else {
          _value[key] = value[key];
        }
      }
    }
    let vals = [];
    pens.forEach((pen: Pen) => {
      vals.push({ id: pen.id, ..._value });
    });
    vals.length && this.setValue(vals, { preventEvent: true });
    return;
  }
}

function onStartAnimate(this: Meta2d, pen: Pen, e: PenAction) {
  const pens = this.find(e.target || pen.id);
  const { params } = e.payload;
  if (pens.length) {
    const stopPens = [];
    pens.forEach((pen: Pen) => {
      let idx = pen.animations.findIndex((item) => item.name === params);
      if (idx !== pen.currentAnimation) {
        stopPens.push(pen);
      }
    });
    // 动画切换
    this.stopAnimate(stopPens);
    this.startAnimate(pens, { name: params });
    return;
  }
  console.warn('[meta2d] 没有指定要播放动画的图元');
}

function onPauseAnimate(this: Meta2d, pen: Pen, e: PenAction) {
  this.pauseAnimate(e.target || pen.id);
  return;
}

function onStopAnimate(this: Meta2d, pen: Pen, e: PenAction) {
  this.stopAnimate(e.target || pen.id);
}

function onJS(this: Meta2d, pen: Pen, e: PenAction) {
  if (!e.payload.value) {
    return;
  }
  if (!FnMap.has(e)) {
    try {
      const func = new Function('pen', 'params', 'context', e.payload.value) as (
        pen: Pen,
        params: any,
        context?: { meta2d: Meta2d },
      ) => void;
      FnMap.set(e, func);
      func(pen, e.payload.params, { meta2d: this });
    } catch (err) {
      console.error('[meta2d]: 在创建函数时出现错误:', err, 'code:', e.payload.value);
    }
  } else {
    FnMap.get(e)?.(pen, e.payload.params, { meta2d: this });
  }
}

function onGlobalFn(this: Meta2d, pen: Pen, e: PenAction) {
  const { value, params } = e.payload;
  if (typeof value !== 'string') {
    console.warn('[meta2d] 全局函数名必须为字符串类型');
    return;
  }

  if (globalThis[value]) {
    globalThis[value](pen, params);
  }
}

function onEmit(this: Meta2d, pen: Pen, e: PenAction) {
  const { value, params } = e.payload;
  if (typeof value !== 'string') {
    console.warn('[meta2d] Emit值必须为字符串');
    return;
  }
  this.emitter.emit(value, {
    pen,
    params: params,
  });
}

function onStartVideo(this: Meta2d, pen: Pen, e: PenAction) {
  this.startVideo(e.target || pen.id);
}

function onPauseVideo(this: Meta2d, pen: Pen, e: PenAction) {
  this.pauseVideo(e.target || pen.id);
}

function onStopVideo(this: Meta2d, pen: Pen, e: PenAction) {
  this.stopVideo(e.target || pen.id);
}

async function onNavigator(this: Meta2d, pen: Pen, e: PenAction) {
  const { value: id } = e.payload;
  if (!id) {
    return;
  }
  const hasId = getURLParams().id;
  if (hasId) {
    const url = new URL(window.location as any);
    url.searchParams.set('id', id);
    history.pushState({}, '', url);
  }
  const data = await this.getMeta2dData(id);
  if (data) {
    this.open(data);
    this.fitView(true, 10);
  }
}

function onDialog(this: Meta2d, pen: Pen, e: PenAction) {
  let url = e.payload.params;
  if (url.includes('${')) {
    url = replaceStringTemplatePenVars(url, pen, vars);
  }
  if (!this.dialog) {
    this.dialog = new Dialog(this);
  }
  this.dialog.show(e.payload.value, url, e.payload);
}

function onSendData(this: Meta2d, pen: Pen, e: PenAction) {
  const { datasource, data, callback } = e.payload;
  let processedDatasource = datasource ? structuredClone(datasource) : undefined;

  // HTTP 类型的 datasource 需要预处理 URL 和请求头
  if (processedDatasource && processedDatasource.type === 'HTTP' && processedDatasource.connectConfig) {
    const config = processedDatasource.connectConfig;

    // 预处理 headers：替换模板变量
    if (config.headers && typeof config.headers === 'object') {
      let headersStr = JSON.stringify(config.headers);
      headersStr = replaceStringTemplateVars(headersStr, vars);
      config.headers = JSON.parse(headersStr);
    }

    // 预处理 URL：替换模板变量
    if (config.url && typeof config.url === 'string' && config.url.includes('${')) {
      config.url = replaceStringTemplatePenVars(config.url, pen, vars);
    }
  }

  // 如果有 callback 且数据源类型为 HTTP，直接在主线程执行 HTTP 请求
  if (callback && processedDatasource?.type === 'HTTP') {
    sendHttpDataInMainThread.call(this, processedDatasource, pen, getSendData(this, data, pen), callback);
    return;
  }

  this.utilityWorker.postMessage({
    action: WorkerMessage.SendData,
    datasource: processedDatasource,
    data: getSendData(this, data, pen),
    callback,
  });
}

// 在主线程执行 HTTP 请求，callback 可以直接访问 meta2d 实例
async function sendHttpDataInMainThread(this: Meta2d, datasource: any, pen: Pen, data: any, callback: string) {
  const { connectConfig } = datasource;
  let url = connectConfig.url;

  // 处理 GET 请求：将数据附加到 URL 查询参数
  if (connectConfig.method === 'GET') {
    url = appendQueryToUrl(url, data);
  }

  try {
    const response = await fetch(url, {
      method: connectConfig.method || 'GET',
      headers: connectConfig.headers,
      body: connectConfig.method !== 'GET' ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      console.error(`[meta2d] HTTP 请求失败: ${response.status} ${response.statusText}`);
      return;
    }

    const responseData = await response.json();

    // 执行 callback，this 绑定到 meta2d 实例
    try {
      const fn = new Function('context', 'data', 'pen', callback) as (
        context: { meta2d: Meta2d },
        data: any,
        pen: Pen,
      ) => void;
      fn({ meta2d: this }, JSON.stringify(responseData), pen);
    } catch (error: any) {
      console.error('[meta2d] callback 执行失败:', error);
    }
  } catch (error: any) {
    console.error('[meta2d] HTTP 请求错误:', error);
  }
}

// 将数据对象附加到 URL 查询参数
function appendQueryToUrl(url: string, data: any) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return url;
  }

  const query = new URLSearchParams();
  for (const key in data) {
    if (data[key] != undefined) {
      query.set(key, data[key].toString());
    }
  }

  if (!query.toString()) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}${query.toString()}`;
}

function onPostMessage(this: Meta2d, pen: Pen, e: PenAction) {
  const _pen = this.find(e.target)[0];
  if (_pen.type !== 'iframe' || !_pen.iframe) {
    console.warn('不是iframe页面');
    return;
  }
  const data: any = getSendData(this, e.payload.data, pen);
  const div = this.componentElementMap.get(_pen.id);
  div &&
    (div.children[0] as HTMLIFrameElement).contentWindow?.postMessage(
      JSON.stringify({
        name: e.payload.value,
        data,
      }),
      '*',
    );
}

function onPostMessageToParent(this: Meta2d, pen: Pen, e: PenAction) {
  const data: any = getSendData(this, e.payload.data, pen);
  window.parent.postMessage(JSON.stringify({ name: e.payload.value, data }), '*');
}

function onMessageBox(this: Meta2d, pen: Pen, e: PenAction) {
  const { params: theme, value: content } = e.payload;
  this.messageBox({
    theme,
    content,
  });
}
