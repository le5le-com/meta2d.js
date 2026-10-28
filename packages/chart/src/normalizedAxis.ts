export interface ScaleOption {
  max: number | null;
  min: number | null;
  splitNumber?: number;
  symmetrical?: boolean;
  deviation?: boolean;
  preferZero?: boolean;
}

export interface ScaleResult {
  max?: number;
  min?: number;
  interval?: number;
  splitNumber?: number;
}

const magics = [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 150];

export function fixedNum(num: number | string, decimal = 15): number {
  const text = String(num);
  return Number.parseFloat(text.includes('.') ? Number.parseFloat(text).toFixed(decimal) : text);
}

export function numberValid(num: unknown): num is number {
  return typeof num === 'number' && Number.isFinite(num);
}

/** 计算与 1.0 一致的“整洁”坐标轴刻度。 */
export function scaleCompute(option: ScaleOption): ScaleResult {
  const {
    max: inputMax,
    min: inputMin,
    splitNumber: requested = 4,
    symmetrical = false,
    deviation = false,
    preferZero = false,
  } = option;
  let splitNumber = numberValid(requested) && requested > 0 ? Math.round(requested) : 4;
  if (!numberValid(inputMax) || !numberValid(inputMin) || inputMax < inputMin) {
    return { splitNumber };
  }
  if (inputMax === inputMin && inputMax === 0) {
    return { max: 10 * splitNumber, min: 0, interval: 10, splitNumber };
  }

  let dataMax = inputMax;
  let dataMin = inputMin;
  let useZero = preferZero;
  if (dataMax === dataMin) useZero = true;
  if (useZero && dataMax * dataMin > 0) {
    if (dataMax < 0) dataMax = 0;
    else dataMin = 0;
  }

  const gap = (dataMax - dataMin) / splitNumber || 1;
  const multiple = 10 ** Math.floor(Math.log10(Math.abs(gap)) - 1);
  const normalizedGap = gap / multiple;
  let magicIndex = magics.findIndex((magic) => magic > normalizedGap);
  if (magicIndex < 0) magicIndex = magics.length - 1;
  let step = magics[magicIndex] * multiple;

  const getBounds = (interval: number) => {
    let axisMax = Math.ceil(dataMax / interval) * interval;
    let axisMin = Math.floor(dataMin / interval) * interval;
    if (dataMax === 0) axisMax = 0;
    if (dataMin === 0) axisMin = 0;
    if (symmetrical && axisMax * axisMin < 0) {
      const bound = Math.max(Math.abs(axisMax), Math.abs(axisMin));
      axisMax = bound;
      axisMin = -bound;
    }
    return { axisMax, axisMin };
  };

  let bounds = getBounds(step);
  if (!deviation) {
    for (let i = 0; i < magics.length * 2; i++) {
      const actual = Math.round((bounds.axisMax - bounds.axisMin) / step);
      if (actual === splitNumber) break;
      if (actual > splitNumber && magicIndex > 0) {
        step = magics[--magicIndex] * multiple;
      } else if (actual < splitNumber && magicIndex < magics.length - 1) {
        step = magics[++magicIndex] * multiple;
      } else {
        break;
      }
      bounds = getBounds(step);
    }
    const actual = Math.round((bounds.axisMax - bounds.axisMin) / step);
    while (actual < splitNumber) {
      if (bounds.axisMin !== 0 && bounds.axisMax !== 0) bounds.axisMin -= step;
      else bounds.axisMax += step;
      break;
    }
  }

  const interval = deviation ? step : (bounds.axisMax - bounds.axisMin) / splitNumber;
  return {
    max: fixedNum(bounds.axisMax),
    min: fixedNum(bounds.axisMin),
    interval: fixedNum(interval),
    splitNumber: deviation ? Math.round((bounds.axisMax - bounds.axisMin) / step) : splitNumber,
  };
}
