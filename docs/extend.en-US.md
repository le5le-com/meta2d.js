[简体中文](./extend.md) | English

# Installation, Integration and Extensions

## Installation

```bash
npm i @meta2d/core
# Extension libraries as needed
npm i @meta2d/chart @meta2d/form @meta2d/uml @meta2d/fta @meta2d/echarts
# Tools
npm i @meta2d/svg @meta2d/data-upgrade
```

**Runtime**: the browser must support Module Workers and OffscreenCanvas (current Chrome, Edge, Firefox and Safari all do).

**Bundling**: the engine creates Workers with `new Worker(new URL('./workers/xxx/index.js', import.meta.url), { type: 'module' })`. Your bundler must support this pattern (Vite does natively, and so does webpack 5). There's no Worker path to configure and nothing to copy into a public directory.

## Extension libraries

| Package | types provided |
| --- | --- |
| @meta2d/chart | `lineChart`, `histogram`, `pieChart`, `gauge`, `heatmap` |
| @meta2d/form | `radio`, `switch`, `checkbox`, `slider`, `time` |
| @meta2d/uml | Flowchart: `flowComment`, `flowData`, `flowDisplay`, `flowDb`, `flowDocument`, `flowExternStorage`, `flowInternalStorage`, `flowManually`, `flowParallel`, `flowQueue`, `flowSubprocess`; swimlanes: `swimlaneH`, `swimlaneV`; activity, sequence and class diagrams: `activityFinal`, `forkH`, `forkV`, `lifeline`, `sequenceFocus`, `simpleClass`, `interfaceClass` |
| @meta2d/fta | Fault tree: `andGate`, `orGate`, `xorGate`, `priorityAndGate`, `votingGate`, `forbiddenGate`, `basicEvent`, `event`, `conditionalEvent`, `switchEvent`, `unexpandedEvent`, `transferSymbol` |
| @meta2d/echarts | `echarts` (DOM pen, depends on echarts) |

### Registration

Libraries are registered by **URL**:

```ts
await meta2d.register(url);
```

The main thread, the render thread and the hover thread (plus the calc thread in edit mode) each `import(url)` it. That leads to two requirements:

- `url` must be an ES Module URL the browser can load directly, not a bare package name like `@meta2d/chart`.
- Editors must **call `setMode(Mode.Edit)` before `register`**. Otherwise the calc thread won't load the library, which affects picking while editing.

For Vite, the recommended setup is an alias to the source in development and fixed-name chunks per package in production.

```ts
// vite.config.ts
export default defineConfig(({ command }) => ({
  resolve: { alias: { '/npm/': path.resolve('node_modules') + '/' } }, // dev: /npm/@meta2d/chart/index.js
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const m = id.match(/@meta2d[\\/](chart|form|uml|fta|echarts)[\\/]/);
          if (m) return `npm/@meta2d_${m[1]}`;
        },
        chunkFileNames: (c) => (c.name.startsWith('npm/') ? `${c.name}.js` : 'assets/[name]-[hash].js'),
      },
    },
  },
}));
```

```ts
// Production needs a static reference so the package isn't tree-shaken away
if (import.meta.env.PROD) import('@meta2d/chart');

const url = (pkg: string) =>
  import.meta.env.DEV ? `/npm/@meta2d/${pkg}/index.js` : `/npm/@meta2d_${pkg}.js`;

await meta2d.register(url('chart'));
```

### echarts pens

```ts
{
  type: 'echarts',
  category: 2,              // PenCategory.HtmlElement
  x: 0, y: 0, width: 300, height: 200,
  echarts: {
    option: {
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
      yAxis: { type: 'value' },
      series: [{ type: 'line', data: [820, 932, 901] }],
    },
  },
}
```

## Custom pens

A library is an ES Module that exports a `penDefines` array. Each item defines one pen type:

```ts
// my-pens/index.ts
import { calcAbsPoint, type Pen } from '@meta2d/core';

function draw(ctx: OffscreenCanvasRenderingContext2D, pen: Pen) {
  const { x, y, width: w, height: h } = pen;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  pen.fillStyles?.forEach((fill) => {   // the engine has already computed fills from background / gradient / state
    ctx.fillStyle = fill;
    ctx.fill();
  });
  ctx.stroke();                         // strokeStyle, lineWidth, rotation and flip are already set
}

function anchors(pen: Pen) {
  return [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }].map((p, i) => ({
    ...calcAbsPoint(pen, p),            // ratio coordinates to absolute coordinates
    id: String(i),
  }));
}

export const penDefines = [{ type: 'myTriangle', draw, defaultAnchorFn: anchors }];
```

```ts
await meta2d.register('/my-pens/index.js');
meta2d.addPens([{ type: 'myTriangle', x: 100, y: 100, width: 80, height: 60 }]);
```

### Definition fields

| Field | Thread | Signature | Description |
| --- | --- | --- | --- |
| type | — | string | Pen type |
| draw | render / hover | `(ctx, pen)` | Draw function, in world coordinates |
| defaultAnchorFn | main | `(pen) => Point[]` | Default anchors when the pen has none (absolute coordinates, with ids) |
| edgeFn | calc | | Custom picking edge |
| create | main | `(pen) => HTMLElement` | Create the DOM element (for DOM pens) |
| beforeUpdate | main | `(pen, oldPen) => boolean` | Return false to drop this update |
| afterUpdate | main | `(pen, values)` | Called after properties update |
| mouseDown / mouseMove / mouseUp | main | `(pen, point) => boolean` | Return false to prevent default behavior |
| mouseEnter / mouseLeave | main | `(pen)` | Mouse in / out |
| wheel | main | `(pen, e)` | Mouse wheel |
| input | main | `(meta2d, pen, mousedown)` | Called on double-click when `pen.input === 3` (Custom); for dropdowns, date pickers, etc. |
| scale | main | `(pen, scale)` | Called when the canvas zooms |
| toPng | main | `(pen) => Promise<ImageBitmap>` | Snapshot of a DOM pen for image export |
| changeTheme | main | `(pen, themeVars)` | Called when the theme switches |
| destroy | main | `(pen)` | Called when the pen is deleted |
| dragover / drop | main | | Called when dragged onto the canvas |

In main-thread hooks, `this` is meta2d (except `input`, which receives meta2d as its first argument). For an interactive pen, see `switch` in `@meta2d/form`: its `mouseDown` calls `this.setValue({ id: pen.id, checked: !pen.checked })`.

### Notes

- The module runs inside Workers, so **its top level must not touch `window` or `document`**. Hooks that only run on the main thread can use the DOM.
- Functions aren't serialized; each thread imports the module itself. Closure variables are not shared between the main thread and Workers, so keep everything a pen needs on `pen`.
- Pure DOM pens (no Canvas drawing) can use `meta2d.registerElement(defs)` instead, which registers only on the main thread. It doesn't support `mouseDown`, `mouseEnter`, `mouseLeave`, `input` or `wheel`.
- Pens that define `beforeUpdate` / `afterUpdate` receive a full pen snapshot on every setValue, which costs more under high-frequency updates.

## SVG import

```ts
import { parseSvg } from '@meta2d/svg';
const pens = parseSvg(svgText);   // returns the child pens plus a group container (the last item)
await meta2d.addPens(pens);
```

## Upgrading 1.x data

```ts
import { dataUpgrade, versionIsBefore } from '@meta2d/data-upgrade';

let data = await fetch('/old.json').then((r) => r.json());
if (versionIsBefore(data.version || '1.0.0')) {   // compares the major version only
  data = dataUpgrade(data);       // returns a new object; you must use the return value
}
meta2d.open(data);
```

`dataUpgrade` converts relative coordinates to absolute, `name` to `type`, and converts animations, datasources, bindings and other fields. The package also exports single-purpose converters such as `convertPens`, `convertDatasources` and `componentsUpgrade`.
