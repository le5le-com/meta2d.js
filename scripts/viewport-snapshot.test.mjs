// Run with Node.js 24: node --test scripts/viewport-snapshot.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

// Execute the actual handlers without starting browser workers. Their imported
// geometry/drawing dependencies are stubbed; message payloads are not.
function handlers(path, names, globals) {
  const source = stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const context = vm.createContext(globals);
  for (const name of names) {
    const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`));
    assert.ok(match, `Missing source handler: ${name}`);
    vm.runInContext(match[0], context);
  }
  return context;
}

function calc() {
  const messages = [];
  const context = handlers('../packages/core/src/workers/calc/worker.ts',
    ['onData', 'onResize', 'onTranslateScale', 'onDataChunk'], {
      x: 0, y: 0, scale: 1, canvasWidth: 600, canvasHeight: 400,
      view: {}, paint: {}, penMap: new Map(), inViewImageIds: [],
      WorkerMessage: { UpdateView: 'view', DataChunkDone: 'chunk' },
      self: { postMessage: message => messages.push(structuredClone(message)) },
      probe: { on: false },
      clearAnimate() {}, fillDefaultAnchors() {}, initPickGrid() {},
      syncViewWorld() {}, updateBoundingCPs() {}, addPens() {},
      makePen: pen => pen, isTinyPen: () => false,
      calcInViewPens: () => ['near'],
    });
  return { context, messages };
}

function relay() {
  const messages = [];
  const context = handlers('../packages/core/src/meta2d-message.ts',
    ['postView', 'onViewRendered', 'onUpdateView'], {
      WorkerMessage: { UpdateView: 'view' },
      probe: { now: () => 0, time() {}, count() {}, sample() {} },
      loadImages() {},
    });
  const instance = {
    data: { x: 900, y: 700, scale: 0.25, pens: [], vectors: {} },
    resizeId: 1,
    renderWorker: { postMessage: message => messages.push(structuredClone(message)) },
    setInViewPenIds() {}, startProgressiveLoad() {}, emitter: { emit() {} },
  };
  return { context, instance, messages };
}

for (const [name, event, expected] of [
  ['onData', { data: { x: 12, y: -8, scale: 0.5, pens: [] }, canvasWidth: 600, canvasHeight: 400 },
    { x: 12, y: -8, scale: 0.5 }],
  ['onResize', { canvasWidth: 800, canvasHeight: 600, resizeId: 1 },
    { x: 0, y: 0, scale: 1 }],
  ['onTranslateScale', { x: -200, y: 30, scale: 0.35 },
    { x: -200, y: 30, scale: 0.35 }],
  ['onDataChunk', { pens: [{ x: 10, y: 10, ex: 20, ey: 20 }] },
    { x: 0, y: 0, scale: 1 }],
]) {
  test(`${name} snapshots the viewport used for its pen IDs`, () => {
    const { context, messages } = calc();
    context[name]({ data: event });
    const message = messages.find(item => item.action === 'view');
    assert.ok(message);
    assert.deepEqual(message.viewport, expected);
    context.onTranslateScale({ data: { x: 99, y: 88, scale: 2 } });
    assert.deepEqual(message.viewport, expected, 'queued snapshots must not change');
  });
}

test('relay uses the worker viewport, not the newer main-thread transform', async () => {
  const { context: worker, messages: replies } = calc();
  worker.onTranslateScale({ data: { x: 0, y: 0, scale: 1 } });
  const { context, instance, messages } = relay();
  await context.onUpdateView.call(instance, { data: replies[0] });
  const { x, y, scale } = messages[0].data;
  assert.deepEqual({ x, y, scale }, { x: 0, y: 0, scale: 1 });
  assert.deepEqual(messages[0].penIds, ['near']);
  assert.equal(instance.data.scale, 0.25, 'relaying must not roll back user state');
});

test('backpressure preserves the latest worker snapshot and repaint request', async () => {
  const { context, instance, messages } = relay();
  for (const [scale, repaint] of [[1, false], [0.5, true], [0.25, false]]) {
    await context.onUpdateView.call(instance, { data: {
      viewport: { x: 0, y: 0, scale }, penIds: [`scale-${scale}`], repaint,
    } });
  }
  instance.data.scale = 3;
  context.onViewRendered.call(instance);
  assert.equal(messages.length, 2, 'intermediate pending views should still be dropped');
  assert.deepEqual(messages.map(message => message.data.scale), [1, 0.25]);
  assert.deepEqual(messages[1].penIds, ['scale-0.25']);
  assert.equal(messages[1].repaint, true);
});

test('stale resize responses remain ignored', async () => {
  const { context, instance, messages } = relay();
  await context.onUpdateView.call(instance, { data: {
    resizeId: 2, viewport: { x: 0, y: 0, scale: 1 }, penIds: ['near'],
  } });
  assert.equal(messages.length, 0);
});
