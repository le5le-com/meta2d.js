//用于规范化纵坐标的坐标值
export interface ScaleOption {
  /**
   * 数据最大值
   *
   * @type {(number | null)}
   * @memberof ScaleOption
   */
  max: number | null;
  /**
   * 数据最小值
   *
   * @type {(number | null)}
   * @memberof ScaleOption
   */
  min: number | null;
  /**
   * 预期分成几个区间
   *
   * @type {number}
   * @memberof ScaleOption
   */
  splitNumber?: number;
  /**
   * 存在异号数据时正负区间是否需要对称
   *
   * @type {boolean}
   * @memberof ScaleOption
   */
  symmetrical?: boolean;
  /**
   * 是否允许实际分成的区间数有误差
   *
   * @type {boolean}
   * @memberof ScaleOption
   */
  deviation?: boolean;
  /**
   * 是否优先取到0刻度
   *
   * @type {boolean}
   * @memberof ScaleOption
   */
  preferZero?: boolean;
}
export interface ScaleResult {
  max?: number;
  min?: number;
  interval?: number;
  splitNumber?: number;
}

// 双精度浮点数有效数字为15位
const maxDecimal = 15;
/**
 * 解决js的浮点数存在精度问题，在计算出最后结果时可以四舍五入一次，刻度太小也没有意义
 *
 * @export
 * @param {(number | string)} num
 * @param {number} [decimal=8]
 * @returns {number}
 */
export function fixedNum(
  num: number | string,
  decimal: number = maxDecimal
): number {
  let str: string = '' + num;
  if (str.indexOf('.') >= 0) str = Number.parseFloat(str).toFixed(decimal);
  return Number.parseFloat(str);
}

/**
 * 判断非Infinity非NaN的number
 *
 * @export
 * @param {*} num
 * @returns {num is number}
 */
export function numberValid(num: any): num is number {
  return typeof num === 'number' && Number.isFinite(num);
}

/**
 * 计算理想的刻度值，刻度区间大小一般是[10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]中某个数字的整10倍
 *
 * @export
 * @param {ScaleOption} option
 * @returns {ScaleResult}
 */
export function scaleCompute(option: ScaleOption): ScaleResult {
  option = {
    max: null,
    min: null,
    splitNumber: 4, // splitNumber建议取4或者5等这种容易被整除的数字
    symmetrical: false,
    deviation: false,
    preferZero: false,
    ...option,
  };
  const magics: number[] = [
    10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 150,
  ]; // 加入150形成闭环
  // tslint:disable-next-line: prefer-const
  let {
    max: dataMax,
    min: dataMin,
    splitNumber,
    symmetrical,
    deviation,
    preferZero,
  } = option;
  if (!numberValid(dataMax) || !numberValid(dataMin) || dataMax < dataMin) {
    return { splitNumber };
  } else if (dataMax === dataMin && dataMax === 0) {
    return {
      max: fixedNum(magics[0] * splitNumber),
      min: dataMin,
      interval: magics[0],
      splitNumber,
    };
  } else if (dataMax === dataMin) {
    preferZero = true;
  }
  if (!numberValid(splitNumber) || splitNumber <= 0) splitNumber = 4;
  if (preferZero && dataMax * dataMin > 0) {
    if (dataMax < 0) dataMax = 0;
    else dataMin = 0;
  }
  const tempGap: number = (dataMax - dataMin) / splitNumber;
  let multiple: number = Math.floor(Math.log10(tempGap) - 1); // 指数
  multiple = Math.pow(10, multiple);
  const tempStep: number = tempGap / multiple;
  let expectedStep: number = magics[0] * multiple;
  let storedMagicsIndex: number = -1;
  let index: number; // 当前魔数下标
  for (index = 0; index < magics.length; index++) {
    if (magics[index] > tempStep) {
      expectedStep = magics[index] * multiple; // 取出第一个大于tempStep的魔数，并乘以multiple作为期望得到的最佳间隔
      break;
    }
  }
  let axisMax: number = dataMax;
  let axisMin: number = dataMin;
  function countDegree(step: number): void {
    axisMax = parseInt('' + (dataMax / step + 1)) * step; // parseInt令小数去尾 -1.8 -> -1
    axisMin = parseInt('' + (dataMin / step - 1)) * step;
    if (dataMax === 0) axisMax = 0; // 优先0刻度
    if (dataMin === 0) axisMin = 0;
    if (symmetrical && axisMax * axisMin < 0) {
      const tm: number = Math.max(Math.abs(axisMax), Math.abs(axisMin));
      axisMax = tm;
      axisMin = -tm;
    }
  }
  countDegree(expectedStep);
  if (deviation) {
    return {
      max: fixedNum(axisMax),
      min: fixedNum(axisMin),
      interval: fixedNum(expectedStep),
      splitNumber: Math.round((axisMax - axisMin) / expectedStep),
    };
  } else if (!symmetrical || axisMax * axisMin > 0) {
    let tempSplitNumber: number;
    out: do {
      tempSplitNumber = Math.round((axisMax - axisMin) / expectedStep);
      if ((index - storedMagicsIndex) * (tempSplitNumber - splitNumber) < 0) {
        // 出现死循环
        while (tempSplitNumber < splitNumber) {
          if (
            (axisMin - dataMin <= axisMax - dataMax && axisMin !== 0) ||
            axisMax === 0
          ) {
            axisMin -= expectedStep;
          } else {
            axisMax += expectedStep;
          }
          tempSplitNumber++;
          if (tempSplitNumber === splitNumber) break out;
        }
      }
      if (
        index >= magics.length - 1 ||
        index <= 0 ||
        tempSplitNumber === splitNumber
      )
        break;
      storedMagicsIndex = index;
      if (tempSplitNumber > splitNumber)
        expectedStep = magics[++index] * multiple;
      else expectedStep = magics[--index] * multiple;
      countDegree(expectedStep);
    } while (tempSplitNumber !== splitNumber);
  }
  axisMax = fixedNum(axisMax);
  axisMin = fixedNum(axisMin);
  const interval: number = fixedNum((axisMax - axisMin) / splitNumber);
  return {
    max: axisMax,
    min: axisMin,
    interval,
    splitNumber,
  };
}
