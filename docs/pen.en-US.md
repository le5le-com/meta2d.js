[简体中文](./pen.md) | English

# Pen

A pen is a plain object. Only `type` is required; every other field is optional. To change an existing pen, use `meta2d.setValue({ id, ...props })`.

```ts
{
  id: 'p1',
  type: 'rectangle',
  x: 100, y: 100, width: 120, height: 60,
  text: 'Pump',
  color: '#1890ff',
  background: '#e6f7ff',
  borderRadius: 0.1,
}
```

## Built-in types

| Kind | type |
| --- | --- |
| Lines | `line` polyline, `curve` curve, `mind` mind-map curve, `orthogonal` orthogonal line |
| Basic shapes | `rectangle`, `square`, `circle`, `triangle`, `diamond`, `pentagon`, `pentagram`, `hexagon`, `cube`, `cloud`, `file`, `message` (speech bubble), `people`, `leftArrow`, `rightArrow`, `twowayArrow` |
| Images | `image`, `gif` (URL in the `image` field) |
| Path | `svgPath` (references `data.paths` through `pathId`) |
| Group | `group` (the container itself isn't drawn) |
| DOM | `video`, `iframe`, `le5le-meta2d` (embeds another diagram, set by `dataId`) |

The `chart`, `form`, `uml`, `fta` and `echarts` extension packages add more types. See [extend](./extend.en-US.md). An unregistered `type` is drawn as a gray placeholder rectangle.

## Basics and geometry

| Property | Type | Description |
| --- | --- | --- |
| id | string | Unique id, generated if omitted |
| type | string | Pen type |
| name | string | Display name |
| category | PenCategory | Node=0, Line=1, HtmlElement=2. Set automatically for built-in types; DOM-based extension pens must set 2 manually |
| tags | string[] | Tags, usable with `find`, `setValue({ tag })` and as action targets |
| x, y, width, height | number | Logical coordinates and size. For lines these are computed from `anchors` |
| rotate | number | Rotation in degrees around `pivot`; `pivot` defaults to the center |
| ratio | boolean | Keep aspect ratio when resizing |
| flipX / flipY | boolean | Horizontal / vertical flip |
| opacity | number | Opacity 0–1 |
| parentId / children | string / string[] | Parent-child relation. Children also use absolute coordinates and move with the parent |
| showChild | number | Show only the child at this index (handy for state switching) |
| container | Rect | Container area (0–1 ratios). Pens dropped into it become children |

## Style

| Property | Description |
| --- | --- |
| color | Foreground color (border, line) |
| background | Fill color |
| gradient / bkType | Fill gradient; `bkType`: Color=0, LinearGradient=1, RadialGradient=2, Image=3 |
| backgrounds | Layered backgrounds: `[{ type, color, gradient, image, imageRepetition }]` |
| backgroundImage | Background image |
| lineWidth / lineDash / lineDashOffset / lineCap / lineJoin | Same meaning as the Canvas properties of the same name |
| lineGradient / lineType / lineImage | Stroke gradient. `lineType` is the stroke fill type (same values as bkType), not the line shape |
| borderWidth / borderColor / borderRadius | Border and corner radius. A `borderRadius` between 0 and 1 is a ratio of the shorter side; otherwise it's in pixels |
| shadowColor / shadowBlur / shadowOffsetX / shadowOffsetY | Shadow |
| blur / blurBackground | Blur |
| hoverColor / hoverBackground | Hover style |
| activeColor / activeBackground | Selected style |
| disabledColor / disabledBackground / disabledTextColor | Disabled style |

Gradient `Gradient`: `{ type: 1 linear | 2 radial, x0, y0, r0, x1, y1, r1, colorStops: [{ i: 0~1, color }] }`.

## Text

| Property | Description |
| --- | --- |
| text | Text content |
| textVisible | Hidden when set to false |
| fontFamily / fontSize / fontWeight / fontStyle / lineHeight / letterSpacing | Font |
| textColor / textBackground / textGradient | Text color, background, gradient |
| textHoverColor / textActiveColor | Text color on hover / when selected |
| textAlign | Left=1, Center=2 (default), Right=3 |
| textVertical | Top=1, Middle=2 (default), Bottom=3 |
| textWrap | Normal=0 (auto wrap), Line=1 (wrap on newlines only), Nowrap=2 |
| textWidth / textHeight | Text area size; defaults to the pen size |
| textLeft / textTop / textRight / textBottom / textUnit | Text offsets; `textUnit: 1` means percentages |
| ellipsis | Show an ellipsis on overflow |
| keepDecimal | Decimal places for numbers |
| textDecoration | None=0, Underline=1, LineThrough=2, with `textDecorationColor` / `textDecorationDash` |
| textShadow / textShadowColor / textShadowBlur / textShadowOffsetX/Y | Text shadow |
| textRotate / textFlip | Whether text follows the pen's rotation / flip |
| textAutoSize | Resize to fit the text after input |

## Images and icons

| Property | Description |
| --- | --- |
| image | Image URL |
| imageRatio / imageRadius / crossOrigin | Keep ratio, corner radius, CORS setting |
| icon / iconFamily / iconWeight / iconSize / iconColor / iconGradient | Font icon (load the font with `setIconfonts` first) |
| iconTop / iconLeft / iconWidth / iconHeight / iconRotate | Icon position and size |
| iconAlign | Bit flags: Center=0, Bottom=1, Top=2, Right=4, Left=8; combinable |
| pathId / pathFill | Path referenced by svgPath; `pathFill: true` fills the path |
| video / audio / autoPlay / playLoop | Audio and video |
| iframe | iframe URL |

## Lines

A line's shape comes from `anchors`, each point in absolute coordinates.

| Property | Description |
| --- | --- |
| anchors | Path points `Point[]`. Endpoints connect to pens through `connectedPen` / `connectedAnchor` |
| close | Whether the path is closed |
| lineSmooth | Polyline smoothing, applied when greater than 0 |
| fromArrow / toArrow | Start / end arrow: `triangle`, `reverseTriangle`, `circle`, `diamond`, `line`, `lineUp`, `lineDown` |
| fromArrowSize / fromArrowColor / fromArrowFillColor | Start arrow size and colors (the end arrow uses the `toArrow*` set) |
| fromLineCap / toLineCap | Line caps at each end |
| length | Line length (computed) |
| connectedLines | Lines connected to a node: `[{ penId, penAnchor, anchor, in? }]` (maintained automatically) |

Text on a line is a child pen positioned by `segment` (which segment) and `position` (0–1 along that segment).

### Anchor: Point

| Field | Description |
| --- | --- |
| id, x, y | Anchor id and absolute coordinates |
| radius / color / background / visible / disabled / title | Anchor look and tooltip |
| twoWay | Connection direction: Both=0, In=1, Out=2, None=3 |
| cp1 / cp2 / handleType | Bézier control points; `handleType`: Mirror=0, Smooth=1, Free=2 |
| connectedPen / connectedAnchor | Pen and anchor the line endpoint is attached to |

Nodes without `anchors` get default anchors by type (most shapes get 4: top, right, bottom, left).

## State and interaction

| Property | Description |
| --- | --- |
| visible | Hidden when set to false |
| locked | Can't be selected or dragged in edit mode |
| disabled | Disabled: ignores events and uses the disabled style |
| disableInput / disableRotate / disableSize / disableAnchor | Disable double-click input, rotation, resizing, anchors individually |
| interactive | Bit flags: Style=1 (hover/selected styles), Event=2 (responds to events) |
| input | Double-click input mode: None=0, Text=1, Number=2, Custom=3 (calls the pen's `input` hook) |
| tooltip / tooltipJs | Hover tooltip, supports markdown; `tooltipJs` is a script returning the tooltip content |
| progress / progressMin / progressMax / progressColors / verticalProgress / reverseProgress | Progress bar |

## Data and events

| Property | Description |
| --- | --- |
| properties | Business properties and data binding. See [data](./data.en-US.md#data-binding) |
| events | Interaction events and actions. See [event](./event.en-US.md#pen-events) |
| triggers | Data-change triggers (states). See [event](./event.en-US.md#triggers) |
| form | Auxiliary data for form pens |

## Animation

A pen can have several animations; `currentAnimation` is the index of the active one. Pens with `autoPlay: true` start playing when the diagram opens.

```ts
{
  animations: [{
    name: 'Blink',
    cycle: 0,                  // loop count, 0 = infinite
    keepAnimationState: false, // keep the last frame when finished
    frames: [                  // node frame animation
      { duration: 500, properties: { opacity: 0.2 } },
      { duration: 500, properties: { opacity: 1 } },
    ],
    nextAnimation: 1,          // index of the animation to play next
  }],
  currentAnimation: 0,
  autoPlay: true,
}
```

| Animation field | Description |
| --- | --- |
| name / cycle / keepAnimationState | Name, loop count, whether to keep the final state |
| frames | `[{ duration, properties, transitional?, timingFunction? }]`. `transitional` lists the properties to interpolate |
| lineAnimation | Line animation config (lines only) |
| next / nextType / nextAnimation | Target and animation to chain when finished |

Line animation `lineAnimation`:

| Field | Description |
| --- | --- |
| type | Default=0 water flow, Beads=1, Dot=2, Arrow=3, WaterDrop=4, Image=5, Icon=6, Pen=7, Element=8 |
| color / lineWidth / dotSize / lineDash | Appearance |
| span | Speed |
| reverse | Reverse direction |
| count / markerSpacing | Count and spacing |
| shadow / shadowColor / shadowBlur | Glow |
| image / icon / iconFamily / target | Assets for types 5–8 |

Control playback with `meta2d.startAnimate(id, { name })`, `pauseAnimate` and `stopAnimate`.
