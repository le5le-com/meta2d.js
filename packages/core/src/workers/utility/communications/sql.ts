import type { Connection, Datasource, SqlConfig } from '../../../types';
import { replaceStringTemplateVars } from '../../../utils/vars';
import { WorkerMessage } from '../../../types/message';

export function connectSQL(datasource: Datasource, callback: (msg: unknown, datasource: Datasource) => void): Connection {
  const config = datasource.connectConfig as SqlConfig;
  const instance = { cancel: false, timer: undefined as ReturnType<typeof setTimeout>, controller: new AbortController() };
  // 旧结构不自动迁移，缺少必要配置时明确报错，避免持续发送无效查询。
  try { buildSqlRequest(config); }
  catch (error) {
    instance.cancel = true;
    console.error('SQL 配置错误：', error);
    return { instance, datasource };
  }
  const run = async () => {
    try {
      const vars = await requestVars(config, instance.controller.signal);
      if (instance.cancel) return;
      const request = buildSqlRequest(config, vars);
      const headers = resolveHeaders(request.headers, vars);
      const response = await fetch(replaceStringTemplateVars(request.url, vars), {
        method: request.method, headers,
        body: request.body,
        signal: instance.controller.signal,
      });
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) instance.cancel = true;
        throw new Error('SQL 请求失败：' + response.status);
      }
      const result = await response.json();
      if (result?.error) throw new Error(String(result.error));
      if (!instance.cancel) callback(sqlValues(config.dataPoint, result), datasource);
    } catch (error) {
      if (!instance.controller.signal.aborted) console.error('SQL 查询失败：', error);
    } finally {
      // 上次请求完成后再轮询，避免慢查询堆积；断开后不再回调或安排新任务。
      if (!instance.cancel && config.interval > 0) {
        instance.timer = setTimeout(run, config.interval);
      }
    }
  };
  void run();
  return { instance, datasource };
}

export function disconnectSQL(connection: Connection) {
  connection.instance.cancel = true;
  clearTimeout(connection.instance.timer);
  connection.instance.controller.abort();
}

export function buildSqlRequest(config: SqlConfig, vars: Record<string, unknown> = {}) {
  if (!config.url || !config.db || !config.sql?.trim() || (config.method && !['get', 'list'].includes(config.method))) {
    throw new Error('SQL 配置不完整或查询方式无效，请重新配置并保存数据源');
  }
  const sourceSql = replaceStringTemplateVars(config.sql, vars, true);
  const sql = buildPagedSql(sourceSql, config);
  return {
    // 分页在运行时根据 params 生成，画布中只保存原始 SQL。
    url: config.url,
    method: 'POST', headers: config.headers,
    body: JSON.stringify({ dbId: config.db, sql }),
  };
}

/** 根据保存的分页参数生成本次请求 SQL，避免把运行态分页结果写回画布。 */
function buildPagedSql(sourceSql: string, config: SqlConfig): string {
  const rawPageSize = config.params?.pageSize;
  if (config.method !== 'list' || rawPageSize === undefined || Number(rawPageSize) === -1) return sourceSql;
  const size = Number(rawPageSize);
  const current = Number(config.params.current ?? 1);
  if (!Number.isInteger(size) || size <= 0 || !Number.isInteger(current) || current <= 0) {
    throw new Error('页码和每页数量必须为正整数，每页数量也可填 -1');
  }
  let sql = sourceSql;
  // 屏蔽引号和注释后定位最外层的末尾分页，避免重复追加或误删子查询分页。
  const masked = sql.replace(/'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|`(?:``|[^`])*`|--[^\r\n]*|\/\*[\s\S]*?\*\//g,
    text => ' '.repeat(text.length));
  const paging = /\b(?:LIMIT\s+\d+(?:\s*,\s*\d+|\s+OFFSET\s+\d+)?|OFFSET\s+\d+\s+ROWS\s+FETCH\s+NEXT\s+\d+\s+ROWS\s+ONLY)\s*;?\s*$/i.exec(masked);
  if (paging) {
    const prefix = masked.slice(0, paging.index);
    const depth = [...prefix].reduce((value, char) => value + (char === '(' ? 1 : char === ')' ? -1 : 0), 0);
    if (depth === 0) sql = sql.slice(0, paging.index);
  }
  sql = sql.replace(/;\s*$/, '').trimEnd();
  const offset = (current - 1) * size;
  if (String(config.params?.dbType || '').toLowerCase() === 'oracle') {
    return `${sql}\nOFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY`;
  }
  return `${sql}\nLIMIT ${size}${offset ? ` OFFSET ${offset}` : ''}`;
}

/** 按不区分大小写的名称合并请求头，避免 Authorization 被重复拼接。 */
function resolveHeaders(headers: HeadersInit | undefined, vars: Record<string, unknown>): Record<string, string> {
  const entries: Array<[string, unknown]> = [];
  if (headers instanceof Headers) {
    headers.forEach((value, key) => entries.push([key, value]));
  } else if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => entries.push([key, value]));
  } else {
    entries.push(...Object.entries(headers || {}));
  }
  const result: Record<string, string> = {};
  for (const [key, value] of entries) {
    const normalized = key.toLowerCase();
    const outputKey = normalized === 'authorization' ? 'Authorization' : normalized === 'content-type' ? 'Content-Type' : key;
    result[outputKey] = replaceStringTemplateVars(String(value), vars);
  }
  return result;
}

/** 同时保留整体结果、行和叶子字段，点位变化时不依赖上次测试结果。 */
export function sqlValues(key: string, value: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const visit = (path: string, current: unknown) => {
    result[path] = current;
    if (current && typeof current === 'object') {
      Object.entries(current).forEach(([name, child]) => visit(`${path}#${name}`, child));
    }
  };
  visit(key, value);
  return result;
}

let sequence = 0;
const requests = new Map<string, (vars: Record<string, unknown>) => void>();

/** 每次请求都向主线程读取最新变量，协议前缀用于隔离并发响应。 */
function requestVars(value: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (signal?.aborted) return Promise.resolve({});
  const keys = [...new Set([...(JSON.stringify(value) || '').matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1]))];
  const requestId = 'sql:' + ++sequence;
  return new Promise((resolve) => {
    const finish = (vars: Record<string, unknown>) => {
      clearTimeout(timer);
      requests.delete(requestId);
      signal?.removeEventListener('abort', abort);
      resolve(vars);
    };
    const abort = () => finish({});
    const timer = setTimeout(() => finish({}), 5000);
    requests.set(requestId, finish);
    signal?.addEventListener('abort', abort, { once: true });
    self.postMessage({ action: WorkerMessage.SetConnections, requestId, keys });
  });
}

export function onSqlVars(e: MessageEvent) {
  requests.get(e.data.requestId)?.(e.data.vars || {});
}
