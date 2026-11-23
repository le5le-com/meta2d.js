import { createMeta2d } from '@meta2d/core';

/** 1000 个图元：足够铺满一屏，fitView 会明显缩小（scale 变化大，最容易踩到 panBlit 的平移判定） */
const PEN_COUNT = 1000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildData(count = PEN_COUNT) {
  const cols = Math.ceil(Math.sqrt(count));
  const cell = 140;
  const size = 100;
  const pens: any[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    pens.push({
      id: 'p' + i,
      type: 'rectangle',
      x: col * cell,
      y: row * cell,
      width: size,
      height: size,
      background: '#2f6fdf',
      text: String(i),
      color: '#ffffff',
      fontSize: 14,
      textAlign: 'center',
      textBaseline: 'middle',
    });
  }
  return { pens };
}

createMeta2d();
const meta2d: any = document.querySelector('le5le-meta2d');

const $diff = document.getElementById('diff')!;
const $state = document.getElementById('state')!;
const $log = document.getElementById('log')!;
const $toggle = document.getElementById('toggle')!;

let panBlit = true;
let running = false;

function log(s: string) {
  $log.textContent = s + '\n' + $log.textContent;
}

async function audit(): Promise<number | null> {
  const report = await meta2d.getPerfReport({ canvasAudit: true, reset: false });
  const a = report?.render?.canvasAudit;
  if (!a) {
    log('canvasAudit: no render report');
    return null;
  }
  if (a.error) {
    log('canvasAudit error: ' + a.error);
    return null;
  }
  log(
    `canvasAudit px=${a.px} truthPens=${a.truthPens} blocks=${JSON.stringify(a.blocks)}`,
  );
  return a.px as number;
}

/**
 * 最小复现：open 之后**立刻** fitView。
 * open 只是把数据发给 calc；fitView 会马上改主线程的 data.x/y/scale。
 * 于是 calc 用旧视口算出的 penIds，会和主线程转发时的新视口拼在一起送给 render。
 */
async function reproduce(withAudit = true) {
  if (running) return;
  running = true;
  $state.textContent = 'open + fitView 中…';
  $diff.textContent = '…';
  $diff.className = '';

  meta2d.setOptions({ panBlit });
  meta2d.open(buildData());
  meta2d.fitView(0.6);

  // 等 render 把首屏画完（比固定 sleep 稳一点）
  await wait(1200);

  if (!withAudit) {
    $state.textContent = '已 open + fitView（未审计）';
    running = false;
    return;
  }

  const px = await audit();
  $diff.textContent = px === null ? 'n/a' : String(px);
  $diff.className = px ? 'bad' : 'good';
  $state.textContent =
    px === null
      ? '没拿到审计结果'
      : px > 0
        ? `panBlit=${panBlit}：有 ${px} 个像素没画出来（鼠标划过那块就会补上）`
        : `panBlit=${panBlit}：整屏一致`;
  running = false;
}

$toggle.textContent = 'panBlit: on';
$toggle.onclick = () => {
  panBlit = !panBlit;
  $toggle.textContent = 'panBlit: ' + (panBlit ? 'on' : 'off');
  reproduce();
};
document.getElementById('again')!.onclick = () => reproduce();

// 给自动化用
(window as any).__repro = {
  run: reproduce,
  audit,
  setPanBlit: (v: boolean) => {
    panBlit = v;
    meta2d.setOptions({ panBlit: v });
  },
  meta2d: () => meta2d,
};

(async () => {
  await meta2d.ready;
  meta2d.setOptions({ perfProbe: true });
  const auto = !location.search.includes('noaudit');
  await reproduce(auto);
  (window as any).__reproDone = true;
})();
