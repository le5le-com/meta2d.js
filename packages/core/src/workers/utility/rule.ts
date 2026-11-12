import { Meta2dData, Options, GuideLine, RuleStyle, RuleConfig } from '../../types';
import {
  RuleStyleConfigs,
  RuleLineColor,
  RuleTextCorlor,
  GuideLineColor,
  RuleGapConfigs,
  MIN_SCALE_THRESHOLD,
  RuleGapConfig,
} from '../../const';

let dpr = 1;
let ctx: CanvasRenderingContext2D;
let width: number;
let height: number;

export function setRuleCtx(_ctx: CanvasRenderingContext2D, _dpr: number, w: number, h: number) {
  ctx = _ctx;
  dpr = _dpr || 1;
  width = w;
  height = h;
}

export function renderRule(options: Options, data: Meta2dData, guideLines?: GuideLine[]) {
  ctx.resetTransform();
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(new DOMMatrix().scale(dpr));

  const rule = { ...options.rule };
  if (!rule.enable) return;

  const ruleStyleConfig = RuleStyleConfigs[rule.style || RuleStyle.Simple];
  const { ruleSize } = ruleStyleConfig;
  const scale = data.scale || 1;
  const ruleGapConfig = scale < MIN_SCALE_THRESHOLD ? RuleGapConfigs.small : RuleGapConfigs.normal;

  // 计算逻辑尺寸（物理像素 / dpr）
  const logicalWidth = width / dpr;
  const logicalHeight = height / dpr;

  if (rule.background) {
    ctx.fillStyle = rule.background;
    ctx.fillRect(0, 0, logicalWidth, ruleSize);
    ctx.fillRect(0, 0, ruleSize, logicalHeight);
  }

  ctx.strokeStyle = rule.color || RuleLineColor;
  ctx.lineWidth = 1;
  ctx.textBaseline = 'top';
  ctx.fillStyle = rule.textColor || rule.color || RuleTextCorlor;

  ctx.beginPath();
  if (rule.style === RuleStyle.Strip) {
    ctx.moveTo(0, ruleSize);
    ctx.lineTo(logicalWidth, ruleSize);
    ctx.moveTo(ruleSize, 0);
    ctx.lineTo(ruleSize, logicalHeight);
  }

  if (rule.style === RuleStyle.Adaptive) {
    drawAdaptiveAxis(data.x ?? 0, logicalWidth, scale, ruleStyleConfig);
    ctx.save();
    ctx.translate(0, logicalHeight);
    ctx.rotate(-Math.PI / 2);
    drawAdaptiveAxis(data.y ?? 0, logicalHeight, scale, ruleStyleConfig, true);
    ctx.restore();

    ctx.save();
    ctx.lineWidth = 1 / dpr;
    ctx.beginPath();
    const edge = alignStrokeCoordinate(ruleSize);
    ctx.moveTo(edge, edge);
    ctx.lineTo(logicalWidth, edge);
    ctx.moveTo(edge, edge);
    ctx.lineTo(edge, logicalHeight);
    ctx.stroke();
    ctx.restore();
  } else {
    drawRulerAxis(data.x, logicalWidth, scale, ruleGapConfig, ruleStyleConfig);

    ctx.save();
    ctx.translate(0, logicalHeight);
    ctx.rotate(-Math.PI / 2);
    drawRulerAxis(data.y, logicalHeight, scale, ruleGapConfig, ruleStyleConfig, true);
    ctx.restore();
    ctx.stroke();
  }

  if (guideLines?.length) {
    drawGuideLines(guideLines, data.x, data.y, scale, logicalWidth, logicalHeight);
  }
}

function getAdaptiveStep(minStep: number): number {
  const unit = 10 ** Math.floor(Math.log10(minStep));
  return [1, 2, 2.5, 5, 10].find((factor) => factor * unit >= minStep) * unit;
}

function alignStrokeCoordinate(value: number): number {
  return (Math.round(value * dpr - 0.5) + 0.5) / dpr;
}

function formatRuleValue(value: number, step: number): string {
  // 科学计数法同时覆盖 2.5、0.025 等步长，按有效小数位消除浮点尾差。
  const [mantissa, exponent] = step.toExponential().split('e');
  const digits = Math.min(100, Math.max(0, (mantissa.split('.')[1]?.length || 0) - Number(exponent)));
  return Number(value.toFixed(digits)).toString();
}

function drawAdaptiveAxis(
  offset: number,
  viewSize: number,
  scale: number,
  ruleStyleConfig: RuleConfig,
  isVertical = false,
) {
  const { ruleSize, minorStartPos, minorEndPos, textTop } = ruleStyleConfig;
  if (viewSize <= ruleSize || !Number.isFinite(offset) || !Number.isFinite(scale) || scale <= 0) return;

  ctx.save();
  ctx.lineWidth = 1 / dpr;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.beginPath();
  // 纵轴已逆时针旋转，其左上角空白位于局部坐标的末端。
  ctx.rect(isVertical ? 0 : ruleSize, 0, viewSize - ruleSize, ruleSize);
  ctx.clip();

  let step = getAdaptiveStep(100 / scale);
  let ticks: { pos: number; text: string }[] = [];
  while (Number.isFinite(step) && step > 0) {
    const gap = step * scale;
    const first = Math.ceil((ruleSize - offset) / gap);
    const last = Math.floor((viewSize - offset) / gap);
    // 超出安全整数范围时无法可靠区分相邻刻度，避免索引递增失效。
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) break;

    ticks = [];
    let minGap = 100;
    for (let index = first; index <= last; index++) {
      const text = formatRuleValue(index * step, step);
      ticks.push({ pos: offset + index * step * scale, text });
      minGap = Math.max(minGap, ctx.measureText(text).width + 16);
    }
    if (gap >= minGap) break;
    // 大数值需要更宽的文字空间；重新选档后再次测量，直至所有标签可读。
    // 除法舍入可能仍选中当前档位，强制递增以保证循环收敛。
    const nextStep = getAdaptiveStep(minGap / scale);
    step = nextStep > step ? nextStep : getAdaptiveStep(step * (1 + Number.EPSILON));
    ticks = [];
  }

  ctx.beginPath();
  for (const { pos, text } of ticks) {
    const textPos = isVertical ? viewSize - pos : pos;
    const strokePos = isVertical ? viewSize - alignStrokeCoordinate(pos) : alignStrokeCoordinate(pos);
    ctx.moveTo(strokePos, alignStrokeCoordinate(minorStartPos));
    ctx.lineTo(strokePos, alignStrokeCoordinate(minorEndPos));
    ctx.fillText(text, textPos, textTop);
  }
  ctx.stroke();
  ctx.restore();
}

function drawRulerAxis(
  offset: number,
  viewSize: number,
  scale: number,
  ruleGapConfig: RuleGapConfig,
  ruleStyleConfig: RuleConfig,
  isVertical = false,
) {
  const { minorInterval, majorInterval } = ruleGapConfig;
  const { ruleSize, minorStartPos, minorEndPos, textTop } = ruleStyleConfig;
  const gap = minorInterval * scale;
  let tickIndex = -Math.ceil(offset / gap);

  for (let pos = offset + tickIndex * gap; pos <= viewSize; pos += gap, tickIndex++) {
    const renderPos = isVertical ? viewSize - pos : pos;
    const logicValue = tickIndex * minorInterval;

    if (logicValue % majorInterval === 0) {
      ctx.moveTo(renderPos, 0);
      ctx.lineTo(renderPos, ruleSize);
      ctx.fillText(logicValue.toString(), renderPos + 4, textTop);
    } else {
      ctx.moveTo(renderPos, minorStartPos);
      ctx.lineTo(renderPos, minorEndPos);
    }
  }
}

function drawGuideLines(
  guideLines: GuideLine[],
  offsetX: number,
  offsetY: number,
  scale: number,
  logicalWidth: number,
  logicalHeight: number,
) {
  ctx.beginPath();
  ctx.strokeStyle = GuideLineColor;

  for (const guideLine of guideLines) {
    const pos = guideLine.pos * scale;
    if (guideLine.isVertical) {
      const posX = pos + offsetX;
      ctx.moveTo(posX, 0);
      ctx.lineTo(posX, logicalHeight);
    } else {
      const posY = pos + offsetY;
      ctx.moveTo(0, posY);
      ctx.lineTo(logicalWidth, posY);
    }
  }

  ctx.stroke();
}
