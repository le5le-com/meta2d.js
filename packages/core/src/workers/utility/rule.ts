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

  const rule = { ...options.rule, ...data.rule };
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

  drawRulerAxis(data.x, logicalWidth, scale, ruleGapConfig, ruleStyleConfig);

  ctx.save();
  ctx.translate(0, logicalHeight);
  ctx.rotate(-Math.PI / 2);
  drawRulerAxis(data.y, logicalHeight, scale, ruleGapConfig, ruleStyleConfig, true);
  ctx.restore();
  ctx.stroke();

  if (guideLines?.length) {
    drawGuideLines(guideLines, data.x, data.y, scale, logicalWidth, logicalHeight);
  }
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
