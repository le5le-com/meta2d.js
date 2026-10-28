import { MessageReport, PerfReport, Stats, TimingReport } from './types';

/**
 * 性能探针。关闭时所有方法为空操作且不分配内存，可以安全地留在热路径上。
 *
 * 用法（worker 内）：
 *   import { probe } from '../../perf/probe';
 *   probe.setEnabled(options.perfProbe);
 *   probe.hookPostMessage();            // 统计所有 postMessage
 *   const t = probe.now(); ...; probe.time('pick', t);
 *   const report = probe.collect('calc');
 */

const RING = 4096;
/** 按 60fps 的帧长分箱，统计每帧消息数 */
const FRAME_MS = 1000 / 60;

function emptyStats(): Stats {
  return { count: 0, avg: 0, p50: 0, p95: 0, max: 0 };
}

/** 环形采样器。固定容量，push 无分配 */
export class Sampler {
  private buf = new Float64Array(RING);
  /** 累计样本数（可能超过容量） */
  private total = 0;
  private w = 0;

  push(v: number) {
    this.buf[this.w] = v;
    this.w = (this.w + 1) % RING;
    this.total++;
  }

  get count() {
    return this.total;
  }

  reset() {
    this.total = 0;
    this.w = 0;
  }

  stats(): Stats {
    const len = Math.min(this.total, RING);
    if (!len) {
      return emptyStats();
    }
    const a = Array.prototype.slice.call(this.buf.subarray(0, len)) as number[];
    a.sort((x, y) => x - y);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += a[i];
    }
    return {
      count: this.total,
      avg: sum / len,
      p50: a[Math.floor(len * 0.5)],
      p95: a[Math.min(len - 1, Math.floor(len * 0.95))],
      max: a[len - 1],
    };
  }
}

/** 按时间戳记录消息，事后分箱得到「每帧发了几条」 */
class MessageRing {
  private times = new Float64Array(RING * 4);
  private actions = new Int16Array(RING * 4);
  private total = 0;
  private w = 0;
  private startTime = 0;

  push(t: number, action: number) {
    if (!this.total) {
      this.startTime = t;
    }
    const cap = this.times.length;
    this.times[this.w] = t;
    this.actions[this.w] = action;
    this.w = (this.w + 1) % cap;
    this.total++;
  }

  reset() {
    this.total = 0;
    this.w = 0;
    this.startTime = 0;
  }

  report(nowMs: number): MessageReport {
    const cap = this.times.length;
    const len = Math.min(this.total, cap);
    const byAction: Record<number, number> = {};
    if (!len) {
      return { total: 0, byAction, perFrame: emptyStats(), windowMs: 0 };
    }

    // 环形展开为时间有序序列
    const start = this.total > cap ? this.w : 0;
    const ts: number[] = [];
    for (let i = 0; i < len; i++) {
      const k = (start + i) % cap;
      ts.push(this.times[k]);
      const a = this.actions[k];
      byAction[a] = (byAction[a] || 0) + 1;
    }

    // 按 FRAME_MS 分箱
    const t0 = ts[0];
    const bins = new Map<number, number>();
    for (let i = 0; i < len; i++) {
      const b = Math.floor((ts[i] - t0) / FRAME_MS);
      bins.set(b, (bins.get(b) || 0) + 1);
    }
    const counts = Array.from(bins.values()).sort((a, b) => a - b);
    let sum = 0;
    for (const c of counts) {
      sum += c;
    }
    const perFrame: Stats = {
      count: counts.length,
      avg: sum / counts.length,
      p50: counts[Math.floor(counts.length * 0.5)],
      p95: counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.95))],
      max: counts[counts.length - 1],
    };

    return {
      total: this.total,
      byAction,
      perFrame,
      windowMs: nowMs - (this.total > cap ? ts[0] : this.startTime),
    };
  }
}

class Probe {
  private enabled = false;
  private timers = new Map<string, Sampler>();
  private counters = new Map<string, number>();
  private messages = new MessageRing();
  private hooked = false;
  private rawPostMessage: ((msg: any, ...rest: any[]) => void) | undefined;
  /** 由宿主注入，返回当前拾取网格的体检报告 */
  private gridReporter: (() => PerfReport['grid']) | undefined;

  get on() {
    return this.enabled;
  }

  setEnabled(v?: boolean) {
    const next = !!v;
    if (next === this.enabled) {
      return;
    }
    this.enabled = next;
    if (!next) {
      this.reset();
    }
  }

  setGridReporter(fn: () => PerfReport['grid']) {
    this.gridReporter = fn;
  }

  now(): number {
    return this.enabled ? performance.now() : 0;
  }

  /** 记一次耗时，单位微秒。t0 由 now() 取得；t0 为 0 时直接跳过 */
  time(label: string, t0: number) {
    if (!this.enabled || !t0) {
      return;
    }
    let s = this.timers.get(label);
    if (!s) {
      s = new Sampler();
      this.timers.set(label, s);
    }
    s.push((performance.now() - t0) * 1000);
  }

  /** 记一个数量样本（如拾取候选数），不做单位换算 */
  sample(label: string, v: number) {
    if (!this.enabled) {
      return;
    }
    let s = this.timers.get(label);
    if (!s) {
      s = new Sampler();
      this.timers.set(label, s);
    }
    s.push(v);
  }

  count(label: string, delta = 1) {
    if (!this.enabled) {
      return;
    }
    this.counters.set(label, (this.counters.get(label) || 0) + delta);
  }

  /**
   * 接管 self.postMessage 以统计跨线程消息量。
   * 只包一层计数，消息内容与顺序不变；即使探针关闭也只多一个 if。
   */
  hookPostMessage() {
    if (this.hooked || typeof self === 'undefined' || !(self as any).postMessage) {
      return;
    }
    this.hooked = true;
    const raw = (self as any).postMessage.bind(self);
    this.rawPostMessage = raw;
    (self as any).postMessage = (msg: any, ...rest: any[]) => {
      if (this.enabled) {
        this.messages.push(performance.now(), (msg && msg.action) | 0);
      }
      return raw(msg, ...rest);
    };
  }

  /** 绕过计数直接发送，用于探针自身的上报消息 */
  rawPost(msg: any) {
    (this.rawPostMessage || (self as any).postMessage)(msg);
  }

  reset() {
    this.timers.clear();
    this.counters.clear();
    this.messages.reset();
  }

  collect(source: PerfReport['source'], reset = true): PerfReport {
    const timing: TimingReport = {};
    for (const [k, v] of this.timers) {
      timing[k] = v.stats();
    }
    for (const [k, v] of this.counters) {
      timing['count:' + k] = { count: v, avg: v, p50: v, p95: v, max: v };
    }
    const report: PerfReport = {
      source,
      timestamp: Date.now(),
      message: this.messages.report(performance.now()),
      timing,
      grid: this.gridReporter ? this.gridReporter() : undefined,
    };
    if (reset) {
      this.reset();
    }
    return report;
  }
}

export const probe = new Probe();
