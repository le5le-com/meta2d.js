import { Meta2dData, Options, WorkerMessage } from '../../types';
import { deepClone } from '../../utils';
import { renderBackground, setBackgroundCtx } from './background';
import {
  onAddOrUpdateDataPoint,
  onDeleteDataPoints,
  // onPatch,
  onAddOrUpdateConnect,
  onStopConnect,
  register,
  setMessageNormalizer,
  onStartConnect,
  onSetConnections,
  setVarMap,
  onSendData,
} from './communications';
import { setMockData, stopMock } from './communications/mock';
import { onFetchImage } from './image';
import { renderRule, setRuleCtx } from './rule';
import { onJoinRoom, onPatch } from './collaborate';
import { onIotVars } from './communications/iot';
import { onSqlVars } from './communications/sql';

let options: Options = {};
let data: Meta2dData = { x: 0, y: 0, scale: 1 };
let guideLines: any[] = [];

let dpr = 1;
let width: number;
let height: number;
let bgCtx: CanvasRenderingContext2D;
let ruleCtx: CanvasRenderingContext2D;

const workerFns: { [key: number]: Function } = {
  [WorkerMessage.Init]: onInit,
  [WorkerMessage.Resize]: onResize,
  [WorkerMessage.Option]: onOption,
  [WorkerMessage.FetchImage]: onFetchImage,
  [WorkerMessage.RenderGuidelines]: onRenderGuidelines,
  [WorkerMessage.RegisterConnection]: register,
  [WorkerMessage.SetConnections]: onConnections,
  [WorkerMessage.AddOrUpdateConnect]: onAddOrUpdateConnect,
  [WorkerMessage.StartConnect]: onStartConnect,
  [WorkerMessage.StopConnect]: onStopConnect,
  [WorkerMessage.SendData]: onSendData,
  [WorkerMessage.AddOrUpdateDataPoint]: onAddOrUpdateDataPoint,
  [WorkerMessage.DeleteDataPoints]: onDeleteDataPoints,
  [WorkerMessage.Patch]: onPatch,
  [WorkerMessage.Destory]: onDestory,
  [WorkerMessage.JoinRoom]: onJoinRoom,
};

self.onmessage = (e: MessageEvent) => {
  workerFns[e.data.action](e);
};

if (typeof structuredClone === 'undefined') {
  globalThis.structuredClone = deepClone;
}

function onConnections(e: MessageEvent) {
  // 带请求编号的消息只完成变量请求，不能进入连接配置流程。
  if (!('requestId' in e.data)) return onSetConnections(e);
  const { requestId } = e.data;
  if (typeof requestId !== 'string') return;
  if (requestId.startsWith('iot:')) onIotVars(e);
  else if (requestId.startsWith('sql:')) onSqlVars(e);
}

function onInit(e: MessageEvent) {
  options = e.data.options || {};

  width = e.data.bgOffscreen.width;
  height = e.data.bgOffscreen.height;
  dpr = e.data.dpr || 1;
  bgCtx = e.data.bgOffscreen.getContext('2d');
  ruleCtx = e.data.ruleOffscreen.getContext('2d');
  setBackgroundCtx(bgCtx, dpr, width, height);
  setRuleCtx(ruleCtx, dpr, width, height);
}

function onResize(e: MessageEvent) {
  width = e.data.width;
  height = e.data.height;
  bgCtx.canvas.width = width;
  bgCtx.canvas.height = height;
  ruleCtx.canvas.width = width;
  ruleCtx.canvas.height = height;
  setBackgroundCtx(bgCtx, dpr, width, height);
  setRuleCtx(ruleCtx, dpr, width, height);
  renderBackground(options, data);
  renderRule(options, data, guideLines);
}

function onOption(e: MessageEvent) {
  e.data.options && Object.assign(options, e.data.options);
  e.data.data && Object.assign(data, e.data.data);
  e.data.guideLines && (guideLines = e.data.guideLines);
  setVarMap(e.data.vars);

  renderBackground(options, data);
  renderRule(options, data, guideLines);

  if (e.data.data && 'messageNormalizer' in e.data.data) {
    setMessageNormalizer(e.data.data.messageNormalizer);
  }

  // open 时传入模拟开关和图元快照，只有配置发生同步时才重启定时器。
  if (e.data.data?.mock !== undefined || e.data.data?.pens !== undefined) {
    setMockData({ mock: data.mock, pens: data.pens });
  }
}

function onRenderGuidelines(e: MessageEvent) {
  guideLines = e.data.guideLines;
  renderRule(options, data, guideLines);
}

async function onDestory(e: MessageEvent) {
  stopMock();
  await onStopConnect({ data: {} } as MessageEvent);
  self.close();
}
