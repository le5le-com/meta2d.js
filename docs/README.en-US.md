[简体中文](./README.md) | English

# Meta2d.js 2.x Documentation

Meta2d.js is a framework-agnostic 2D visualization engine for web SCADA/HMI, dashboards, flowcharts and similar use cases. Version 2.x ships as a Web Component (`<le5le-meta2d>`) and renders with 4 Workers plus OffscreenCanvas.

| Document                         | Contents                                                                    |
| -------------------------------- | --------------------------------------------------------------------------- |
| [README](./README.en-US.md)      | Concepts, quick start, differences from 1.x                                 |
| [api](./api.en-US.md)            | Meta2d instance: properties, methods, options                               |
| [pen](./pen.en-US.md)            | Pen data structure                                                          |
| [data](./data.en-US.md)          | Real-time data: setValue, datasources, mock data, variables, collaboration  |
| [event](./event.en-US.md)        | Event listeners, pen events and actions, triggers, lifecycle, hotkeys       |
| [extend](./extend.en-US.md)      | Installation, extension libraries, custom pens, SVG import, 1.x data upgrade |

## Core concepts

- **Diagram** (`Meta2dData`): a serializable JSON object holding the pen list `pens` and page settings (background, grid, datasources, etc.). Open it with `open()` and export it with `getData()`.
- **Pen** (`Pen`): an element on the canvas. `category` splits pens into three kinds: node (Node=0), line (Line=1) and DOM element (HtmlElement=2, e.g. video, iframe, echarts). The concrete shape is set by `type`.
- **Mode**: `Mode.Run` (0, default, runtime interaction) and `Mode.Edit` (1, drag-and-drop editing). Pen events and triggers only work in run mode; hotkeys only work in edit mode.
- **Coordinates**: a pen's `x/y/width/height` and a line's `anchors` are canvas logical coordinates (absolute), independent of zoom and pan. Screen coordinate = logical coordinate × `data.scale` + `data.x/y`.
- **Threads**: the main thread only handles data and DOM. The render thread draws; the calc thread does picking and geometry; the hover thread draws the interaction layer (selection box, anchors); the utility thread handles background, rulers and data communication. So pen data must be changed through the API (`setValue`, `addPens`, etc.). Mutating the objects directly won't redraw.

## Quick start

```ts
import { createMeta2d, Mode, type Meta2d } from '@meta2d/core';

// 1. Register the <le5le-meta2d> custom element (once)
createMeta2d();

// 2. Put it on the page. The element is 100% width/height, so its parent needs a height
document.querySelector('#app')!.innerHTML = '<le5le-meta2d></le5le-meta2d>';
const meta2d = document.querySelector('le5le-meta2d') as Meta2d;

// 3. Wait for the Workers to initialize
await meta2d.ready;

// 4. Open a diagram
meta2d.setMode(Mode.Edit);
meta2d.open({
  pens: [
    { id: 'a', type: 'rectangle', x: 100, y: 100, width: 120, height: 60, text: 'Start' },
    { id: 'b', type: 'circle', x: 320, y: 100, width: 60, height: 60, text: 'End' },
  ],
});
meta2d.fitView();

// 5. Interaction and data
meta2d.on('active', (pens) => console.log('selected', pens));
meta2d.setValue({ id: 'a', text: 'Running', background: '#52c41a' });
```

In Vue projects, declare it as a custom element:

```ts
// vite.config.ts
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'le5le-meta2d' } } });
```

When the element is removed from the DOM (`disconnectedCallback`), it tears down its Workers and timers automatically. There's no destroy function to call.

## Differences from 1.x

| 1.x                                         | 2.x                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `new Meta2d('id', options)`                 | `createMeta2d()` + `<le5le-meta2d>`, then `setOptions(options)` after `await meta2d.ready` |
| Pen type in `name`                          | Pen type in `type`; `name` is only a display name                                           |
| Line type in `lineName`                     | The line's `type`: `line` / `curve` / `mind` / `orthogonal`                                 |
| Relative coordinates + `calculative.worldRect` | Absolute coordinates, no worldRect                                                       |
| `meta2d.data()`                             | `meta2d.getData()`                                                                          |
| `addPen` / `delete`                         | `addPens` / `deletePens`                                                                    |
| `combine` / `uncombine`                     | `group` / `ungroup`                                                                         |
| Animation fields `frames`, `lineAnimateType` | `animations[]`, holding both frame and line animations                                     |
| `realTimes` binding                         | `properties[].bind` binds data points                                                       |
| `locked` as a level enum                    | `locked` is a boolean                                                                       |
| `beforeAddPens` / `beforeRemovePens`        | `beforeAdd` / `beforeDelete`                                                                |

Convert 1.x diagrams with `@meta2d/data-upgrade`. See [extend](./extend.en-US.md#upgrading-1x-data).
