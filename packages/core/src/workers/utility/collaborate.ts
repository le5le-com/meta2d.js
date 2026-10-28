import { WorkerMessage } from '../../types';
import type { Datasource, Meta2dData } from '../../types';
import type { Pen } from '../../models';
import { collaboratePageKeys, defaultCollaborateColors } from '../../const';
import type { Meta2d } from '../../meta2d';
import { getPathBBox, getPathBBoxCache } from './svg';

type CollaboratePageKey = (typeof collaboratePageKeys)[number];

interface CollaborateDocumentDataPatch {
  page?: {
    set?: Partial<Pick<Meta2dData, CollaboratePageKey>>;
    unset?: CollaboratePageKey[];
  };
  datasources?: {
    upsert?: Datasource[];
    remove?: string[];
  };
  paths?: {
    upsert?: Record<string, string>;
  };
  iconfonts?: {
    add?: string[];
    remove?: string[];
  };
}

interface CollaboratePatch {
  add?: Pen[];
  remove?: Pen[];
  beforeUpdate?: Pen[];
  update?: Pen[];
  documentData?: CollaborateDocumentDataPatch;
}

const stringPageKeys = new Set<CollaboratePageKey>([
  'background',
  'backgroundImage',
  'color',
  'penBackground',
  'theme',
  'initJs',
  'messageNormalizer',
]);
const sensitiveDatasourceKeys = new Set([
  'accesstoken',
  'authorization',
  'cookie',
  'password',
  'token',
  'instance',
  'timer',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOnlyKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function isPageValue(key: CollaboratePageKey, value: unknown): boolean {
  if (key === 'width' || key === 'height') {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }
  if (key === 'disableTranslate' || key === 'disableScale') {
    return typeof value === 'boolean';
  }
  if (stringPageKeys.has(key)) {
    return typeof value === 'string';
  }
  if (key === 'backgroundGradient' || key === 'lineGradient' || key === 'penGradient') {
    return isRecord(value);
  }
  return key === 'vars' && Array.isArray(value);
}

function isDatasource(value: unknown): value is Datasource {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.name === 'string' &&
    isNonEmptyString(value.type) &&
    isRecord(value.connectConfig) &&
    !value.collaborator
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isCollaborateDocumentDataPatch(value: unknown): value is CollaborateDocumentDataPatch {
  if (!hasOnlyKeys(value, ['page', 'datasources', 'paths', 'iconfonts'])) return false;

  const page = value.page;
  if (page !== undefined) {
    if (!hasOnlyKeys(page, ['set', 'unset'])) return false;
    const set = page.set;
    const unset = page.unset;
    if (
      set !== undefined &&
      (!hasOnlyKeys(set, collaboratePageKeys) ||
        Object.entries(set).some(
          ([key, item]) =>
            !collaboratePageKeys.includes(key as CollaboratePageKey) || !isPageValue(key as CollaboratePageKey, item),
        ))
    ) {
      return false;
    }
    if (
      unset !== undefined &&
      (!Array.isArray(unset) || unset.some((key) => !collaboratePageKeys.includes(key as CollaboratePageKey)))
    ) {
      return false;
    }
  }

  const datasources = value.datasources;
  if (datasources !== undefined) {
    if (!hasOnlyKeys(datasources, ['upsert', 'remove'])) return false;
    if (datasources.upsert !== undefined && (!Array.isArray(datasources.upsert) || !datasources.upsert.every(isDatasource))) {
      return false;
    }
    if (datasources.remove !== undefined && !isStringArray(datasources.remove)) return false;
  }

  const paths = value.paths;
  if (paths !== undefined) {
    if (!hasOnlyKeys(paths, ['upsert'])) return false;
    if (
      paths.upsert !== undefined &&
      (!isRecord(paths.upsert) ||
        Object.entries(paths.upsert).some(([id, path]) => !isNonEmptyString(id) || !isNonEmptyString(path)))
    ) {
      return false;
    }
  }

  const iconfonts = value.iconfonts;
  if (iconfonts !== undefined) {
    if (!hasOnlyKeys(iconfonts, ['add', 'remove'])) return false;
    if (iconfonts.add !== undefined && !isStringArray(iconfonts.add)) return false;
    if (iconfonts.remove !== undefined && !isStringArray(iconfonts.remove)) return false;
  }

  return true;
}

function cloneWithoutSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneWithoutSensitive);
  if (!isRecord(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!sensitiveDatasourceKeys.has(key.toLowerCase())) {
      result[key] = cloneWithoutSensitive(item);
    }
  }
  return result;
}

export function sanitizeCollaborateDatasource(datasource: Datasource): Datasource {
  return JSON.parse(JSON.stringify(cloneWithoutSensitive(datasource))) as Datasource;
}

function extractSensitiveTree(value: unknown): unknown {
  if (Array.isArray(value)) {
    const result = value.map(extractSensitiveTree);
    return result.some((item) => item !== undefined) ? result : undefined;
  }
  if (!isRecord(value)) return undefined;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (sensitiveDatasourceKeys.has(key.toLowerCase())) {
      result[key] = item;
      continue;
    }
    const nested = extractSensitiveTree(item);
    if (nested !== undefined) result[key] = nested;
  }
  return Object.keys(result).length ? result : undefined;
}

function restoreSensitiveTree(current: unknown, incoming: unknown): unknown {
  if (Array.isArray(current) && Array.isArray(incoming)) {
    return incoming.map((item, index) => restoreSensitiveTree(current[index], item));
  }
  if (!isRecord(current) || !isRecord(incoming)) return incoming;

  const result: Record<string, unknown> = { ...incoming };
  for (const [key, currentValue] of Object.entries(current)) {
    const incomingKey = Object.keys(incoming).find((item) => item.toLowerCase() === key.toLowerCase());
    if (sensitiveDatasourceKeys.has(key.toLowerCase())) {
      if (incomingKey === undefined) result[key] = currentValue;
      continue;
    }
    if (incomingKey !== undefined) {
      result[incomingKey] = restoreSensitiveTree(currentValue, incoming[incomingKey]);
    } else {
      const sensitiveTree = extractSensitiveTree(currentValue);
      if (sensitiveTree !== undefined) result[key] = sensitiveTree;
    }
  }
  return result;
}

function restoreSensitiveDatasource(current: Datasource | undefined, incoming: Datasource): Datasource {
  return current ? (restoreSensitiveTree(current, incoming) as Datasource) : incoming;
}

/** 校验并应用协作补丁。所有资源预校验完成后才修改画布，避免部分更新。 */
export function applyCollaboratePatch(this: Meta2d, value: unknown): boolean {
  try {
    if (!isRecord(value)) throw new Error('补丁必须是对象');
    for (const key of ['add', 'remove', 'beforeUpdate', 'update']) {
      if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error(`${key} 必须是数组`);
    }
    if (value.documentData !== undefined && !isCollaborateDocumentDataPatch(value.documentData)) {
      throw new Error('文档补丁格式无效');
    }

    const patch = value as CollaboratePatch;
    const documentData = patch.documentData;
    const pathResources: Record<string, { path: string; rect: ReturnType<typeof getPathBBox> }> = {};
    for (const [id, path] of Object.entries(documentData?.paths?.upsert || {})) {
      const rect = getPathBBox(path);
      if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
        throw new Error(`自定义路径 ${id} 的包围盒无效`);
      }
      pathResources[id] = { path, rect };
    }

    if (Object.keys(pathResources).length) {
      const pathBBoxCache = getPathBBoxCache() as Record<string, ReturnType<typeof getPathBBox>>;
      this.data.paths = this.data.paths || {};
      for (const [id, item] of Object.entries(pathResources)) {
        this.data.paths[id] = item.path;
        pathBBoxCache[id] = item.rect;
      }
      this.renderWorker.postMessage({ action: WorkerMessage.AddPath, paths: pathResources });
      if (this.options.mode) this.hoverWorker.postMessage({ action: WorkerMessage.AddPath, paths: pathResources });
    }

    const addIconfonts = documentData?.iconfonts?.add || [];
    if (addIconfonts.length) this.setIconfonts(addIconfonts, false);

    if (documentData?.page) {
      const pageData: Partial<Meta2dData> = { ...(documentData.page.set || {}) };
      for (const key of documentData.page.unset || []) {
        if (key === 'theme') pageData.theme = 'dark';
        else (pageData as Record<string, unknown>)[key] = undefined;
      }
      this.setPageConfig(pageData, false);
    }

    for (const datasource of documentData?.datasources?.upsert || []) {
      const current = this.data.datasources?.find((item) => item.id === datasource.id);
      const sanitized = sanitizeCollaborateDatasource(structuredClone(datasource));
      this.addOrUpdateDatasource(restoreSensitiveDatasource(current, sanitized), false);
    }
    for (const id of documentData?.datasources?.remove || []) {
      if (this.data.datasources?.some((item) => item.id === id)) this.deleteDatasource(id, false);
    }

    this.patch(patch.add, patch.remove, patch.beforeUpdate, patch.update);

    for (const url of documentData?.iconfonts?.remove || []) this.removeIconfont(url, false);
    if (documentData) this.emitter.emit('dataUpdate', documentData);
    return true;
  } catch (error) {
    console.warn('[meta2d] 收到无效协作文档补丁：', error);
    return false;
  }
}

const maxReconnects = 10;
let reconnects = 0;
let client: WebSocket | undefined;
let msgId = 0;
let readonly = false;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let connectionGeneration = 0;
type CollaborateMessageStatus = 'pending' | 'failed';

interface CollaborateMessage {
  msgId: number;
  status: CollaborateMessageStatus;
  patch?: unknown;
  patchs?: unknown[];
}

// 保存尚未收到服务端确认的消息，拒绝时用于重发。
const messageQueue = new Map<number, CollaborateMessage>();
let resendTimer: ReturnType<typeof setTimeout> | undefined;

export interface CollaborateMemberInfo {
  username: string;
  color: string;
}

interface CollaborateMember {
  uid: string;
  username?: string;
  [key: string]: unknown;
}

// 当前协作会话的 uid、用户名与颜色映射，后续可直接同步给 hover 线程。
export const uidMemberMap = new Map<string, CollaborateMemberInfo>();
let colorIndex = 0;

function getCollaborateColors(meta2d: Meta2d): string[] {
  const colors = meta2d.options.collaborateColors?.filter((color) => typeof color === 'string' && color.trim());
  return colors?.length ? colors : defaultCollaborateColors;
}

function getMemberColor(meta2d: Meta2d, uid: string): string {
  const existingMember = uidMemberMap.get(uid);
  if (existingMember) {
    return existingMember.color;
  }

  const colors = getCollaborateColors(meta2d);
  const color = colors[colorIndex % colors.length];
  colorIndex += 1;
  uidMemberMap.set(uid, { username: '', color });
  return color;
}

function addMemberColors(meta2d: Meta2d, members: unknown): unknown[] {
  if (!Array.isArray(members)) {
    return [];
  }

  return members.map((member) => {
    if (!member || typeof member !== 'object' || Array.isArray(member)) {
      return member;
    }

    const record = member as Partial<CollaborateMember>;
    if (typeof record.uid !== 'string' || !record.uid) {
      return member;
    }

    const previous = uidMemberMap.get(record.uid);
    const username = typeof record.username === 'string' ? record.username : previous?.username || '';
    const color = getMemberColor(meta2d, record.uid);
    uidMemberMap.set(record.uid, { username, color });

    return {
      ...record,
      username,
      color,
    };
  });
}

/** 重新加入房间时清理当前协作会话的成员颜色分配状态。 */
export function resetCollaborateColors() {
  uidMemberMap.clear();
  colorIndex = 0;
}

function getPatchPens(patch: unknown, key: 'add' | 'remove' | 'beforeUpdate' | 'update'): Pen[] {
  if (!patch || typeof patch !== 'object') {
    return [];
  }
  const pens = (patch as Record<string, unknown>)[key];
  return Array.isArray(pens) ? (pens as Pen[]) : [];
}

/** 根据实时 patch 更新图元操作者，并将最新快照交给 hover 线程。 */
export function updateCollaboratePointers(this: Meta2d, patch: unknown, uid: unknown) {
  const memberUid = typeof uid === 'string' || typeof uid === 'number' ? String(uid) : undefined;
  const member = memberUid ? uidMemberMap.get(memberUid) : undefined;
  const removePens = getPatchPens(patch, 'remove');
  const changedPens = [
    ...getPatchPens(patch, 'add'),
    ...getPatchPens(patch, 'beforeUpdate'),
    ...getPatchPens(patch, 'update'),
  ];
  const changedPenMap = new Map<string, Pen>();
  for (const pen of changedPens) {
    if (pen.id) {
      // update 通常包含最新坐标，后出现的同 id 数据覆盖前面的快照。
      changedPenMap.set(pen.id, pen);
    }
  }

  for (const pen of removePens) {
    if (pen.id) {
      for (const [memberUid, pointer] of this.collaboratePointers) {
        if (pointer.id === pen.id) {
          this.collaboratePointers.delete(memberUid);
        }
      }
    }
  }

  const changedIds = new Set<string>();
  for (const pen of changedPens) {
    if (pen.id) {
      changedIds.add(pen.id);
    }
  }

  for (const id of changedIds) {
    // this.patch 的 penMap 写入发生在 calc Worker 回调中，因此优先使用当前 patch 快照。
    const pen = changedPenMap.get(id) || this.penMap.get(id);
    if (!memberUid || !member) {
      continue;
    }
    if (!pen) {
      continue;
    }

    this.collaboratePointers.set(memberUid, {
      id,
      uid: memberUid,
      username: member.username,
      color: member.color,
      x: pen.x,
      y: pen.y,
      width: pen.width,
      height: pen.height,
    });
  }

  // patch 可能通过父级、分组或间接布局改变其他图元位置，因此每次都同步已有标识的最新坐标。
  for (const [uid, collaboratePointer] of this.collaboratePointers) {
    const id = collaboratePointer.id;
    const pen = changedPenMap.get(id) || this.penMap.get(id);
    if (!pen) {
      this.collaboratePointers.delete(uid);
      continue;
    }
    collaboratePointer.x = pen.x;
    collaboratePointer.y = pen.y;
    collaboratePointer.width = pen.width;
    collaboratePointer.height = pen.height;
  }

  this.hoverWorker?.postMessage({
    action: WorkerMessage.Collaborate,
    pointers: Array.from(this.collaboratePointers.values()),
  });
}

function resendMessages() {
  const failedMessages = [...messageQueue.values()].filter((message) => message.status === 'failed');
  if (!failedMessages.length || !client || client.readyState !== WebSocket.OPEN) {
    return;
  }

  const patchs: unknown[] = [];
  for (const message of failedMessages) {
    if (message.patchs) {
      patchs.push(...message.patchs);
    } else if (message.patch !== undefined) {
      patchs.push({ patch: message.patch });
    }
    messageQueue.delete(message.msgId);
  }

  if (!patchs.length) {
    return;
  }

  const message: CollaborateMessage = {
    msgId: ++msgId,
    patchs,
    status: 'pending',
  };
  // 将所有失败消息合并成一次 patchs 请求，并用新的 msgId 重新等待确认。
  messageQueue.set(message.msgId, message);
  const payload = {
    msgId: message.msgId,
    patchs: message.patchs,
  };
  client.send(JSON.stringify(payload));
}

function scheduleResend() {
  if (resendTimer !== undefined) {
    return;
  }

  resendTimer = setTimeout(() => {
    resendTimer = undefined;
    resendMessages();
  }, 5000);
}

function removeMessage(msgId: number) {
  messageQueue.delete(msgId);
  if (!messageQueue.size && resendTimer !== undefined) {
    clearTimeout(resendTimer);
    resendTimer = undefined;
  }
}

export function onJoinRoom(e: MessageEvent) {
  resetCollaborateColors();
  connectionGeneration += 1;
  const generation = connectionGeneration;
  readonly = e.data.readonly;

  if (reconnectTimer !== undefined) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }

  if (client) {
    const previousClient = client;
    // 主动切换房间时先移除旧连接的关闭回调，避免 close 触发自动重连。
    previousClient.onclose = null;
    client = undefined;
    previousClient.close();
  }

  reconnects = 0;
  connectRoom(e, generation);
}

function connectRoom(e: MessageEvent, generation: number) {
  const { url } = e.data;
  const socket = new WebSocket(url);
  client = socket;

  socket.onmessage = (e) => {
    self.postMessage({
      action: WorkerMessage.MessageCallback,
      type: 'collaborater',
      msgs: e.data,
    });
  };

  socket.onclose = () => {
    // 旧连接或旧房间的事件不能影响当前连接。
    if (generation !== connectionGeneration || client !== socket) {
      return;
    }

    if (maxReconnects && reconnects >= maxReconnects) {
      client = undefined;
      console.info('Websocket 已达到最大重连次数。');
      return;
    }

    reconnects += 1;

    console.info('Websocket 重连...');
    // 使用递增延迟重连，避免服务端异常时形成连接请求风暴。
    const reconnectDelay = Math.min(reconnects * 1000, 5000);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      if (generation === connectionGeneration) {
        connectRoom(e, generation);
      }
    }, reconnectDelay);
  };

  socket.onopen = () => {
    // 如果连接建立期间已经主动切换房间，立即关闭这个过期连接。
    if (generation !== connectionGeneration || client !== socket) {
      socket.onclose = null;
      socket.close();
    }
  };
}

// 发送多人协作数据
export function onPatch(e: MessageEvent) {
  if (!client || readonly || !e.data.patch || client.readyState !== WebSocket.OPEN) {
    return;
  }

  const message: CollaborateMessage = {
    msgId: ++msgId,
    status: 'pending',
    patch: e.data.patch,
  };

  if (message.patch !== undefined) {
    messageQueue.set(message.msgId, message);
  }
  client.send(
    JSON.stringify({
      msgId: message.msgId,
      patch: message.patch,
    }),
  );
}

export function onCollaborateCallback(this: Meta2d, e: MessageEvent) {
  let data: any;
  try {
    data = JSON.parse(e.data.msgs);
  } catch (error) {
    console.warn('多人协作消息格式错误：', error);
    return;
  }
  // 房间成员变化
  if (data.action && Array.isArray(data.members)) {
    const members = addMemberColors(this, data.members);
    if (data.action === 'leave') {
      for (const member of data.members) {
        if (member?.uid !== undefined && member.uid !== null) {
          this.collaboratePointers.delete(String(member.uid));
        }
      }
      this.hoverWorker?.postMessage({
        action: WorkerMessage.Collaborate,
        pointers: Array.from(this.collaboratePointers.values()),
      });
    }
    this.emitter.emit('collaborate', {
      type: 'members',
      data: { ...data, members },
    });
    return;
  }

  if (data.msgId) {
    const message = messageQueue.get(data.msgId);
    if (data.rejected) {
      if (message) {
        message.status = 'failed';
        // 服务端拒绝时保留失败消息，稍后合并成 patchs 格式重发。
        scheduleResend();
      }
    } else {
      // 服务端确认后只删除对应消息，其他未确认消息继续保留。
      removeMessage(data.msgId);
    }
  }

  if (data.msgs && data.historyIncomplete !== undefined) {
    // 广播过来的数据
    if (data.historyIncomplete) {
      //lastSeq 过时，需要重新加载方案
      this.emitter.emit('collaborate', {
        type: 'reload',
        data,
      });
    } else {
      // 多人协作实时数据
      this.data.seq = data.seq;

      // 多人协作历史数据
      if (data.msgs?.length) {
        for (const item of data.msgs) {
          if (!applyCollaboratePatch.call(this, item.patch)) {
            this.emitter.emit('collaborate', {
              type: 'reload',
              data: { ...data, reason: 'invalidPatch' },
            });
            return;
          }
          if (data.uid) {
            updateCollaboratePointers.call(this, item.patch, data.uid);
          }
        }
        this.emitter.emit('collaborate', {
          type: 'patch',
          data: data.msgs,
        });
        return;
      }
    }
  }
}
