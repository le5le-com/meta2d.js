[简体中文](./api.md) | English

# Meta2d Instance API

`meta2d` refers to the `<le5le-meta2d>` element on the page. Below, `idOrTag` means a pen id or tag, and `pens` means `Pen[]`.

## Common properties

| Property   | Type              | Description                                                                         |
| ---------- | ----------------- | ----------------------------------------------------------------------------------- |
| ready      | Promise\<void\>   | Resolves once Workers and the initializer finish. Call `open` only after this       |
| data       | Meta2dData        | Page settings of the current diagram. `data.pens` is cleared after opening; `penMap` is the source of truth |
| options    | Options           | Current options. Change them with `setOptions`                                      |
| penMap     | Map\<string, Pen\> | Latest data of every pen (read-only; change pens through the API)                  |
| activePens | Pen[]             | Currently selected pens                                                             |
| emitter    | mitt Emitter      | Event bus; `on` / `off` are shortcuts to it                                         |
| dialog     | Dialog            | Dialog component instance                                                           |

## Options

Set with `meta2d.setOptions(options)`. You can call it at any time; repeated calls are merged.

| Name | Default | Description |
| --- | --- | --- |
| mode | Mode.Run | 0 run, 1 edit |
| anchorMode | AnchorMode.Hidden | Bit flags: Hidden=0, Hover=1 (show anchors on hover), Drawline=2 (line drawing mode), Pencil=4 (pencil mode) |
| editPivot | | Show and allow editing of the rotation pivot |
| minScale / maxScale | 0.1 / 10 | Zoom range |
| background | | Canvas background color |
| grid | | Grid: `{ enable, color, size }` |
| alignGrid | | Snap to grid while dragging |
| rule | | Rulers: `{ enable, style, color, background, textColor, guidelineColor }` |
| origin | | Ruler origin |
| disableRotate / disableSize | | Disable rotating / resizing globally |
| ignoreHotkeys | | Keys to ignore (`KeyboardEvent.key` values) |
| clipboard | true | Use the system clipboard for copy/paste; `false` uses localStorage |
| drawingLineOptions | | Presets for new lines: `color`, `lineWidth`, `lineSmooth`, `lineGradient`, `fromArrow`, `toArrow` |
| fromArrow / toArrow | | Default arrows for new lines |
| pencilTolerance | | Simplification tolerance for pencil strokes |
| color / textColor / fontFamily | `#222222` / / YaHei etc. | Default pen color and font |
| activeColor / activeBackground | `#278df8` | Selection color |
| hoverColor / hoverBackground / hoverCursor | `rgba(39,141,248,0.8)` / / `pointer` | Hover style |
| hoverBoxColor / activeBoxColor / dragSelectionColor | | Colors of the hover box, selection box and marquee |
| anchorColor / hoverAnchorColor / anchorRadius / anchorBackground | `#fa541c` / `#FF4101` / 4 / `#fff` | Anchor style |
| dockColor | `#00a00020` | Snap guide color |
| lineTextBackground | `#ffffff` | Background of text on lines |
| animateInterval | 20 | Animation frame interval (ms) |
| patchQueueDelay | 16 | Minimum interval (ms) between `setValue` display batches; 0 means no limit. See [data](./data.en-US.md#setvalue) |
| progressiveLoad | true | With many pens (≥20k), draw the viewport first and fill in the rest in batches, then emit `loaded` |
| collaborateColors | 8 colors | Colors of collaboration members |
| perfProbe | false | Enable the performance probe; use with `getPerfReport()` |

The remaining options such as `panBlit`, `animBatch` and `patchAudit` are performance-debugging switches. Their defaults are already the recommended values, so you normally don't need to touch them.

## Diagram data: Meta2dData

The argument of `open(data)` and the return value of `getData()`.

| Name | Description |
| --- | --- |
| id / name / version | Diagram identity; `version` is written by `getData()` |
| pens | Pen array. Array order is layer order (later items are on top) |
| x / y / scale | Canvas pan and zoom |
| width / height | Fixed canvas size (dashboards). If unset, the canvas is unbounded |
| background / backgroundGradient / backgroundImage | Canvas background |
| grid / rule / origin | Grid, rulers, ruler origin |
| theme | Theme name, default `dark`. Built-in: `dark` / `light` |
| color / textColor / penBackground / fontSize | Default pen color, text color, background, font size |
| lineGradient / textGradient / penGradient | Default pen gradients |
| minScale / maxScale / disableTranslate / disableScale | Zoom and pan limits |
| lineIntersect | Draw hop-over arcs where lines cross |
| smoothNum | Smoothing amount for pencil strokes |
| initJs | Script run when the diagram opens, with `context = { meta2d }`. When set, `beforeRender` is not called |
| datasources / mock / messageNormalizer / vars | Datasources, mock data, message conversion script, global variables. See [data](./data.en-US.md) |
| paths | Path data referenced by svgPath pens: `{ pathId: d }` |
| iconfonts | List of icon font CSS URLs |

## Methods

### Diagram

| Method | Description |
| --- | --- |
| `open(data?: Meta2dData)` | Open a diagram: reset state, compute data bindings, connect datasources, play `autoPlay` animations, then emit `opened` |
| `whenLoaded(): Promise<void>` | Wait for progressive loading to finish. Image export waits automatically |
| `getData(): Meta2dData` | Export the full diagram (deep copy, pens sorted by layer) |
| `setPageConfig(data: Partial<Meta2dData>)` | Change page settings (excluding pens), such as background, grid, variables |
| `setOptions(o: Options)` | Change options |
| `setMode(mode: Mode)` | Switch between run and edit mode |
| `setTheme(name)` / `registerTheme(name, theme)` | Switch / register a theme. Switching emits `changeTheme` |
| `setIconfonts(urls: string[])` / `removeIconfont(url)` | Add / remove icon fonts |
| `loadFonts(fontFaceCss: string): Promise<void>` | Load `@font-face` fonts (in the main thread and every Worker) |
| `getVersion(): string` | Engine version |

### Add, delete, update, find pens

| Method | Description |
| --- | --- |
| `addPens(pens, mode?, parentId?): Promise` | Add pens, optionally under a parent. Without `mode`, the `beforeAdd` hook runs first |
| `deletePens(pens, mode?): Promise` | Delete pens and their children; line connections are cleaned up too. Without `mode`, `beforeDelete` runs first |
| `setValue(val: IValue \| IValue[], options?)` | Change pen properties. See [data](./data.en-US.md#setvalue) |
| `find(idOrTag): Pen[]` | Find by id, falling back to tag |
| `findOne(idOrTag): Pen` | First result of `find` |

```ts
await meta2d.addPens([{ type: 'rectangle', x: 0, y: 0, width: 100, height: 50 }]);
meta2d.setValue({ id: 'a', x: 200, rotate: 45 }, { render: true });
await meta2d.deletePens(meta2d.find('temp'));
```

### Selection, grouping, layers

| Method | Description |
| --- | --- |
| `active(pens?)` | Select pens (locked and hidden pens are filtered out). With no argument, recomputes the selection box |
| `clearActive()` | Clear selection |
| `selectAll(invert = false)` | Select all; `invert: true` inverts the selection |
| `group(pens?, showChild?)` | Group at least 2 pens into a `type: 'group'`; defaults to the current selection. `showChild` shows only the child at that index |
| `ungroup(pens?)` | Ungroup |
| `toComponent(pens?): Pen[]` | Build reusable component data (deep copy wrapped in a group) |
| `moveLayer(isForward)` | Move the selection up / down one layer |
| `toFrontOrBack(toTop)` | Bring the selection to front / send to back |
| `movePenToFrontOf(pen, target)` / `movePenToBackOf(pen, target)` | Place one layer above / below the target pen (same parent only) |
| `normalizeLayers()` | Renumber layers |

### Align and distribute (acts on the selection)

| Method | Description |
| --- | --- |
| `alignPens(type: AlignType, last = false)` | Align to the first (or last) selected pen |
| `alignPensToPage(type, whole = true)` | Align to the canvas (requires `data.width/height`). `whole: true` moves the selection as a whole |
| `distributePensEvenly(direction)` | Distribute evenly: `AlignType.HorizontalDistribute` / `VerticalDistribute` |

`AlignType`: Left, Center, Right, Top, Middle, Bottom, HorizontalDistribute, VerticalDistribute.

### View

| Method | Description |
| --- | --- |
| `fitView(fitContent = true, padding = 0, origin = FitViewOrigin.Center)` | Zoom and center to the window. Fits `data.width/height` when set, otherwise the content |
| `scale(scale, center?)` | Zoom to a scale. `center` is in screen (client) coordinates, default is the canvas center |
| `translateCanvas(x, y)` | Pan the canvas by an offset from its current position |
| `setViewPosition(x, y)` | Set the canvas's absolute pan position |
| `gotoView(pen)` | Pan so the pen is centered |
| `showMap()` / `hideMap()` | Show / hide the minimap |
| `toggleRule(enabled?)` | Toggle rulers |
| `showMagnifier(enabled)` | Toggle the magnifier |
| `resize()` | Resize the canvas to the element's current size. The engine doesn't watch size changes itself, so the host must call this when the container resizes (e.g. in a `ResizeObserver` callback) |

### Editing

| Method | Description |
| --- | --- |
| `undo()` / `redo()` | Undo / redo |
| `pushAction(action)` | Push an undo record manually: `{ add?, remove?, beforeUpdate?, update? }` |
| `setLineType(type)` | Line type for new lines: `line` / `curve` / `mind` / `orthogonal` |
| `toggleAnchorEdit(enabled?)` | Enter or leave anchor editing |
| `setAnchorHandleType(type?: HandleType)` | Control handles of the hovered anchor: Mirror=0, Smooth=1, Free=2; no argument removes them |
| `enterTextInput(pen)` / `exitTextInput()` | Enter / leave text editing on a pen |
| `setRotateCursors(cursors: string[4])` | Custom rotation cursors for the 4 directions |

### Animation and media

| Method | Description |
| --- | --- |
| `startAnimate(idOrTagOrPens?, { name?, currentAnimation? }?)` | Play a pen's `animations`, chosen by name or index. With no pens, plays every `autoPlay` pen |
| `pauseAnimate(idOrTagOrPens)` / `stopAnimate(idOrTagOrPens)` | Pause / stop. The argument is required |
| `startVideo(idOrTagOrPens?)` / `pauseVideo(...)` / `stopVideo(...)` | Control video pens |

### Export

| Method | Description |
| --- | --- |
| `toPng(params?, callback?)` | Export PNG. `params`: `{ pens?, padding?, backgroundImage?, maxWidth? }`. With `callback(buffer: ArrayBuffer, error?)` the data is returned through the callback; without it, the file is downloaded |
| `toSvg(defs?: string[])` | Export and download SVG |

```ts
meta2d.toPng({ padding: 20 }, (buf, err) => {
  if (!err) {
    const url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
  }
});
```

### Data, communication, collaboration

For `calcBoundDataPoints`, `addOrUpdateDatasource`, `deleteDatasource`, `stopConnect`, `startDataMock`, `stopDataMock`, `joinRoom` and related methods, see [data](./data.en-US.md).

### Extension registration

For `register(url)`, `registerElement(defs)` and `registerDatasource(url)`, see [extend](./extend.en-US.md).

### Other

| Method | Description |
| --- | --- |
| `messageBox(options)` / `closeAllMessageBox()` | Message toasts. See [event](./event.en-US.md#message-box-and-dialog) |
| `getPerfReport(opt?)` | Performance data from each thread (requires `perfProbe: true`) |
| `on(name, fn)` / `off(name, fn)` | Listen to events. See [event](./event.en-US.md) |

## Assignable hooks

Assign them on the instance to take effect. See [event](./event.en-US.md#lifecycle-hooks).

```ts
meta2d.beforeAdd = async (pens) => true;          // return false to cancel adding
meta2d.beforeDelete = async (pens) => confirm('Delete?');
meta2d.beforeConnectLine = (line, from, to) => true;
meta2d.beforeRender = () => {};                    // called during open
meta2d.getMeta2dData = (id) => fetch(`/api/diagram/${id}`).then((r) => r.json()); // used by navigation and dialogs
meta2d.uploadFn = async (file) => '/upload/url';  // upload image files dropped onto the canvas
```
