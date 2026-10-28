[简体中文](./event.md) | English

# Events and Interaction

Interaction logic can live in three places:

| Approach | Where | Use for |
| --- | --- | --- |
| Engine events | Host code, `meta2d.on(name, fn)` | Editor wiring, business logic |
| Pen events `events` | Diagram JSON | Actions on click, hover, etc., saved with the diagram |
| Triggers `triggers` | Diagram JSON | Switching state by condition when data changes (alarms, switches, etc.) |

## Engine events

```ts
const onActive = (pens) => {};
meta2d.on('active', onActive);
meta2d.off('active', onActive);
meta2d.on('*', (name, payload) => {}); // listen to all events
```

| Event | When | Payload |
| --- | --- | --- |
| opened | `open()` finished | — |
| loaded | Progressive loading finished | — |
| click | A pen was clicked (any mode) | `{ e, pen }` |
| active | Selection changed | `Pen[]` (`[]` when cleared) |
| patch | Pens added, deleted or updated | `{ add, remove, beforeUpdate, update }` |
| valueUpdate | `setValue` called (without `preventEvent`) | `IValue[]` |
| layer | Layer order changed | — |
| scale | Canvas zoomed | New scale |
| translate | Canvas panned | `{ x, y }` |
| resizeView | Canvas size changed | `{ width, height }` |
| viewRendered | Viewport finished drawing | `{ pens }` number of pens drawn |
| changeTheme | Theme switched | `{ name, theme }` |
| collaborate / dataUpdate | Collaboration message / collaborative page data updated | See [data](./data.en-US.md#collaboration) |
| openFile | Ctrl+O pressed | — |
| error | PNG / SVG export failed | Error message |
| Custom name | Pen action `Emit` | `{ pen, params }` |

## Pen events

Pen events (`events`) only work in **run mode**. Pens with `disabled` don't fire them.

```ts
{
  events: [{
    type: EventType.Click,         // 0
    isAny: false,                  // with multiple conditions: false = all must match, true = any
    conditions: [{ type: 0, key: 'status', operator: '==', target: 'on' }],
    actions: [
      { type: PenActionType.SetProps, target: 'lamp', payload: { value: { background: 'red' } } },
      { type: PenActionType.Emit, payload: { value: 'pumpClick' }, timeout: 500 },
    ],
  }],
}
```

### Event types: EventType

| Value | Name | Value | Name |
| --- | --- | --- | --- |
| 0 | Click | 5 | Active (selected) |
| 1 | Dblclick | 6 | Inactive (deselected) |
| 2 | Contextmenu | 7 | Mousedown |
| 3 | Enter (mouse in) | 8 | Mouseup |
| 4 | Leave (mouse out) | | |

The enum also defines Message, ValueUpdate, Input, Change, Submit and Reset (9–14), but the engine doesn't dispatch them yet.

### Actions

Fields of an action (`PenActionType`):

| Field | Description |
| --- | --- |
| type | Action type, see below |
| target | Target pen id or tag; empty means the current pen |
| payload | Action parameters, mainly `value` and `params` |
| timeout | Delay in milliseconds before running |

| Value | Action | payload |
| --- | --- | --- |
| 0 | Link: open a URL | `value`: URL (supports `${}`), `params`: window name, default `_blank` |
| 1 | SetProps: set properties | `value`: property object. Values can be constants, `${}` templates, or `{ id, key }` referencing another pen's property |
| 2 / 3 / 4 | Start / pause / stop animation | For start, `params` is the animation name |
| 5 | JS: run a script | `value`: function body, with arguments `pen`, `params`, `context` (`context.meta2d`) |
| 6 | GlobalFn: call a global function | `value`: function name; calls `window[value](pen, params)` |
| 7 | Emit: fire an event | `value`: event name; receive it in the host with `meta2d.on(value, fn)` |
| 8 / 9 / 10 | Play / pause / stop video | — |
| 13 | Navigator: go to a diagram | `value`: diagram id; fetched with `meta2d.getMeta2dData(id)` and opened |
| 14 | Dialog | `value`: title, `params`: diagram id or URL, other fields are dialog config |
| 15 | SendData | `datasource`: datasource id, `data`: `[{ prop, value \| id+key, type }]`, optional `callback` |
| 16 | PostMessage | Sends `{ name: value, data }` to the target iframe pen |
| 17 | PostMessageToParent | Sends `{ name: value, data }` to the parent window |
| 18 | MessageBox | `value`: content, `params`: theme |

In the `data` of SendData / PostMessage, each item names its field with `prop`. The value is either a fixed `value` (supports `${}`, converted by `type`) or a pen property read via `id` + `key`.

### Conditions

| Field | Description |
| --- | --- |
| type | 0 compare; 1 function (`fn` is a function body with arguments `pen`, `context`, returning a boolean) |
| key | Property of the current pen to compare (dot paths supported) |
| operator | Comparison operator, see below |
| targetType | 0 fixed value (default); 1 another pen's property: `target` is the pen id, `targetKey` the property |
| target | Value to compare against |

| Operator | Meaning | target example |
| --- | --- | --- |
| `==` `=` `!=` | Equal / not equal (loose comparison) | `on` |
| `>` `>=` `<` `<=` | Numeric comparison | `80` |
| `[)` / `![)` | In range / not in range | `[10,20)` |
| `[]` / `![]` | In set / not in set; `..` denotes a range | `[1,20,30..50]` |

## Triggers

Triggers (`triggers`) run in **run mode** when a pen property changes through `setValue` (unless `preventEvent` is set). They describe "states".

```ts
{
  triggers: [{
    name: 'Temperature alarm',
    events: [   // evaluated in order, stops at the first match
      { conditions: [{ key: 'temp', operator: '>=', target: '80' }], actions: [{ type: 1, payload: { value: { background: 'red' } } }] },
      { conditions: [{ key: 'temp', operator: '>=', target: '60' }], actions: [{ type: 1, payload: { value: { background: 'orange' } } }] },
      { conditions: [{ key: 'temp', operator: '<', target: '60' }],  actions: [{ type: 1, payload: { value: { background: 'green' } } }] },
    ],
  }],
}
```

- A trigger is only evaluated when a property used in its conditions changed this time; other property changes don't trigger it.
- Each trigger's `events` is a state table: evaluated in order, and the actions of the first matching condition run.
- SetProps inside actions uses `preventEvent`, so it won't cause trigger loops.

## Lifecycle hooks

Assign functions on the instance:

| Hook | When | Returning false |
| --- | --- | --- |
| `beforeRender()` | During `open()`. If the diagram has `initJs`, that runs instead | — |
| `beforeAdd(pens)` | `addPens()` without `mode`, including drop and paste | Cancels adding |
| `beforeDelete(pens)` | `deletePens()` without `mode` | Cancels deleting |
| `beforeConnectLine(line, from?, to?)` | When a line is completed | Cancels the line |

All hooks may return a Promise. Note: deleting with the Delete key and placing with the T/R/L hotkeys pass `Mode.Edit`, so they skip `beforeDelete` / `beforeAdd`.

Global initializer (runs once for each `<le5le-meta2d>` when mounted; a good place to register libraries and fonts):

```ts
import { setMeta2dInitializer } from '@meta2d/core';
setMeta2dInitializer(async (meta2d) => {
  await meta2d.register('/npm/@meta2d_chart.js');
});
```

## Message box and dialog

```ts
meta2d.messageBox({
  content: 'Saved',
  theme: 'success',     // success | info (default) | warning | error | question
  placement: 'top',     // top | bottom | left | right
  duration: 3000,       // 0 = don't close automatically
  closeBtn: true,
});
meta2d.closeAllMessageBox();

// Dialog: mode 1 (default) opens a diagram in a child canvas, mode 0 opens an iframe URL
meta2d.dialog.show('Details', 'diagram-id', { mode: 1, width: 800, height: 600 });
```

Dialog config also supports `x`, `y`, `background`, `maskBackground`, `hideClose`, `closeTop` and `closeRight`.

## Hotkeys

Hotkeys only work in edit mode (run mode keeps only Space for panning). Block keys with `options.ignoreHotkeys`, e.g. `['Delete', 'z']`. Ctrl in the table is Cmd on macOS.

| Group | Keys | Action |
| --- | --- | --- |
| View | Hold Space and drag | Pan the canvas |
| | `+` / `-` | Zoom in / out |
| | Shift+1 | Fit to window |
| | Shift+0 | Fit to window, left-aligned |
| | Shift+2 | Zoom in around the center |
| | Z | Magnifier |
| | M / Shift+R / Alt+R | Minimap / rulers / grid |
| Edit | Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) | Undo / redo |
| | Ctrl+C / X / V | Copy / cut / paste |
| | Delete / Backspace | Delete |
| | Ctrl+A / Ctrl+Shift+A | Select all / invert selection |
| | Esc | Clear selection or cancel the current operation |
| | Arrow keys (with Shift) | Move 1px (5px) |
| | Ctrl+arrow keys (with Shift) | Resize 1px (10px) |
| | Ctrl+G / Ctrl+Shift+G | Group / ungroup |
| | Ctrl+Shift+L / Ctrl+Shift+H | Toggle lock / visibility |
| | Shift+H / Shift+V | Flip vertically / horizontally |
| Layers | Ctrl+] / Ctrl+[ | Up / down one layer |
| | Ctrl+Alt+] / Ctrl+Alt+[ | Bring to front / send to back |
| Align | Alt+A / D / W / S / H | Align left / right / top / bottom / center |
| | Alt+Shift+H / Alt+Shift+V | Distribute horizontally / vertically |
| Text | Ctrl+B / Ctrl+I | Bold / italic |
| | Ctrl+Shift+> / < | Font size ±1 |
| | Ctrl+Alt+> / < | Line height ±0.1 |
| | Ctrl+Alt+L / T / R | Text align left / center / right |
| Draw | T / R / L | Place text / rectangle / line at the mouse position |
| | P | Line drawing mode (press P while drawing to finish the current line) |
| | O | Orthogonal line mode |
| | Shift+P | Pencil freehand drawing |
| | Space while drawing | Toggle between the original line type and orthogonal |
| | Enter | Finish drawing; with one line selected, toggle closed |
| Anchors | E | Show / hide anchors |
| | A | Anchor editing mode |
| | 1 / 2 / 3 / 4 | Control handles: remove / mirror / smooth / free |
| Other | Ctrl+O | Fire the `openFile` event |
