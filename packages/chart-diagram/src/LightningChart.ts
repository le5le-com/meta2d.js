import { Pen, setElemPosition, Topology } from '@topology/core';

declare const lcjs: any;

export function lightningCharts(pen: Pen): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
  }

  const path = new Path2D();
  const worldRect = pen.calculative.worldRect;
  let lightningChart = globalThis.lcjs;
  if (!(pen as any).lightningCharts || !lightningChart) {
    return;
  }

  if (typeof (pen as any).lightningCharts === 'string') {
    try {
      (pen as any).lightningCharts = JSON.parse((pen as any).lightningCharts);
    } catch (e) {}
  }
  if (!(pen as any).lightningCharts) {
    return;
  }

  if (!(pen.calculative as any).lightningChartDiv) {
    // 1. 创建父容器
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = worldRect.width + 'px';
    div.style.height = worldRect.height + 'px';
    div.id = pen.id;
    document.body.appendChild(div);
    (pen.calculative as any).lightningChartDiv = div;

    setTimeout(() => {
      setLightningCharts(pen);
    }, 100);

    // 加载到div layer
    setTimeout(() => {
      pen.calculative.canvas.externalElements &&
        pen.calculative.canvas.externalElements.appendChild(div);
      setElemPosition(pen, div);
    }, 200);
  }

  path.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);

  if (
    pen.calculative.patchFlags &&
    (pen.calculative as any).lightningChartDiv
  ) {
    setElemPosition(pen, (pen.calculative as any).lightningChartDiv);
  }

  return path;
}

//将16进制格式和rgb格式转化为数字数组
function colorRgb(bcolor: String) {
  let color = bcolor.toLowerCase();
  const pattern = /^#([0-9|a-f]{3}|[0-9|a-f]{6})$/;
  const pattern2 = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
  if (color && pattern.test(color)) {
    if (color.length == 4) {
      // 将三位转换为六位
      color =
        '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    //处理六位的颜色值
    var colorNew = [];
    for (var i = 1; i < 7; i += 2) {
      colorNew.push(parseInt('0x' + color.slice(i, i + 2)));
    }
    return colorNew; //.join(',');
  } else if (color && pattern2.test(color)) {
    const first = color.match(/\(([^)]*)\)/)[1];
    let arr = first.split(',').map((item) => {
      return parseInt(item);
    });
    return arr;
  }
  return color;
}

function setLightningCharts(pen: Pen) {
  const {
    lightningChart,
    PieChartTypes,
    LegendBoxBuilders,
    SliceLabelFormatters,
    Themes,
    GaugeChartTypes,
    SolidLine,
    SolidFill,
    ColorRGBA,
    UIOrigins,
    emptyLine,
    AutoCursorModes,
    AxisScrollStrategies,
    AxisTickStrategies,
    UIElementBuilders,
  } = lcjs;
  const data = (pen as any).lightningCharts.option.data;
  const title = (pen as any).lightningCharts.option.title || 'Title';
  const theme = Themes[(pen as any).lightningCharts.option.theme || 'lightNew'];
  (pen.calculative as any).lightningChart = lightningChart();
  switch ((pen as any).lightningCharts.option.type) {
    case 'line':
      const charts = (pen.calculative as any).lightningChart
        .ChartXY({
          container: pen.id,
        })
        .setTitle(title);
      data.forEach((item) => {
        charts.addLineSeries().setName(item.name).add(item.data);
      });
      //   (pen.calculative as any).lightningChart = charts;
      break;
    case 'bar':
      const lc = (pen.calculative as any).lightningChart;
      let barChart;
      {
        barChart = (options) => {
          const figureThickness = 10;
          const figureGap = figureThickness * 0.25;
          const groupGap = figureGap * 3.0;
          const groups = [];
          const categories = [];
          const chart = lc
            .ChartXY(options)
            .setTitle(title)
            .setAutoCursorMode(AutoCursorModes.onHover)
            .setMouseInteractions(false)
            .setPadding({ bottom: 30 });

          const axisX = chart
            .getDefaultAxisX()
            .setMouseInteractions(false)
            .setScrollStrategy(undefined)
            .setTickStrategy(AxisTickStrategies.Empty);

          const axisY = chart
            .getDefaultAxisY()
            .setMouseInteractions(false)
            .setTitle((pen as any).lightningCharts.option.yTitle)
            .setInterval(0, 70)
            .setScrollStrategy(AxisScrollStrategies.fitting);

          chart.setAutoCursor((cursor) =>
            cursor
              .disposePointMarker()
              .disposeTickMarkerX()
              .disposeTickMarkerY()
              .setGridStrokeXStyle(emptyLine)
              .setGridStrokeYStyle(emptyLine)
              .setResultTable((table) => {
                table.setOrigin(UIOrigins.CenterBottom);
              })
          );
          const createSeriesForCategory = (category) => {
            const series = chart.addRectangleSeries();
            series.setCursorResultTableFormatter((builder, series, figure) => {
              let entry = {
                name: category.name,
                value: category.data[category.figures.indexOf(figure)],
              };
              return builder
                .addRow('Department:', entry.name)
                .addRow('# of employees:', String(entry.value));
            });
            return series;
          };

          const legendBox = chart
            .addLegendBox(LegendBoxBuilders.VerticalLegendBox)
            .setAutoDispose({
              type: 'max-width',
              maxWidth: 0.2,
            });

          const redraw = () => {
            let x = 0;
            for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
              const group = groups[groupIndex];
              const xStart = x;
              for (const category of categories) {
                const value = category.data[groupIndex];
                if (value !== undefined) {
                  const figure = category.figures[groupIndex];
                  figure.setDimensions({
                    x,
                    y: 0,
                    width: figureThickness,
                    height: value,
                  });
                  x += figureThickness + figureGap;
                }
              }
              group.tick.setValue((xStart + x - figureGap) / 2);
              x += groupGap;
            }
            axisX.setInterval(-(groupGap + figureGap), x);
          };
          const addGroups = (names) => {
            for (const name of names)
              groups.push({
                name,
                tick: axisX
                  .addCustomTick(UIElementBuilders.AxisTick)
                  .setGridStrokeLength(0)
                  .setTextFormatter((_) => name),
              });
          };
          const addCategory = (entry) => {
            const series = createSeriesForCategory(entry).setName(entry.name);
            entry.figures = entry.data.map((value) =>
              series.add({ x: 0, y: 0, width: 0, height: 0 })
            );
            legendBox.add(series);
            categories.push(entry);
            redraw();
          };
          return {
            addCategory,
            addGroups,
          };
        };
      }

      const chart = barChart({
        theme,
        container: pen.id,
      });
      chart.addGroups((pen as any).lightningCharts.option.groups);
      const categories = (pen as any).lightningCharts.option.categories;
      data.forEach((data, i) =>
        chart.addCategory({
          name: categories[i],
          data,
        })
      );
      //   (pen.calculative as any).lightningChart = chart;
      break;
    case 'pie':
      const pie = (pen.calculative as any).lightningChart
        .Pie({
          theme,
          container: pen.id,
        })
        .setTitle(title)
        .setAnimationsEnabled(true)
        .setMultipleSliceExplosion(true);
      const slices = data.map((item) => pie.addSlice(item.name, item.value));
      pie
        .setInnerRadius((pen as any).lightningCharts.option.innerRadius || 0)
        .setLabelFormatter(SliceLabelFormatters.NamePlusRelativeValue);
      pie
        .addLegendBox(LegendBoxBuilders.VerticalLegendBox)
        .setAutoDispose({
          type: 'max-width',
          maxWidth: 0.3,
        })
        .add(pie);
      //   (pen.calculative as any).lightningChart = pie;

      break;
    case 'gauge':
      const gauge = (pen.calculative as any).lightningChart
        .Gauge({
          theme,
          container: pen.id,
        })
        .setTitle(title)
        .setThickness(20)
        .setAngleInterval(
          (pen as any).lightningCharts.option.startAngle || 225,
          (pen as any).lightningCharts.option.endAngle || -45
        );
      let colorArry = colorRgb((pen as any).lightningCharts.option.background);
      const slice = gauge
        .getDefaultSlice()
        .setInterval(
          (pen as any).lightningCharts.option.min || 0,
          (pen as any).lightningCharts.option.max || 100
        )
        .setValue(data)
        .setFillStyle(
          new SolidFill({
            color: ColorRGBA(colorArry[0], colorArry[1], colorArry[2]),
          })
        );
      //   (pen.calculative as any).lightningChart = gauge;
      break;
  }
}

function destory(pen: Pen) {
  (pen.calculative as any).lightningChartDiv.remove();
  // (pen.calculative as any).lightningChart.dispose();
}

function move(pen: Pen) {
  if (!(pen.calculative as any).lightningChartDiv) {
    return;
  }
  setElemPosition(pen, (pen.calculative as any).lightningChartDiv);
}

function resize(pen: Pen) {
  if (!(pen.calculative as any).lightningChartDiv) {
    return;
  }
  setElemPosition(pen, (pen.calculative as any).lightningChartDiv);
}

function value(pen: Pen) {
  if (!(pen.calculative as any).lightningChartDiv) {
    return;
  }
  setLightningCharts(pen);
  setElemPosition(pen, (pen.calculative as any).lightningChartDiv);
}
