import { Padding } from '../options';

/**
 * turn padding into [top, right, bottom, left]
 * @param  {Number|Array} padding input padding
 * @return {array} output
 */
export const formatPadding = (padding: Padding): number[] => {
  let top = 0;
  let left = 0;
  let right = 0;
  let bottom = 0;

  if (typeof padding === 'number') {
    top = left = right = bottom = padding;
  } else if (typeof padding === 'string') {
    const intPadding = parseInt(padding, 10);
    top = left = right = bottom = intPadding;
  } else if (Array.isArray(padding)) {
    top = padding[0];
    right = !isNil(padding[1]) ? padding[1] : padding[0];
    bottom = !isNil(padding[2]) ? padding[2] : padding[0];
    left = !isNil(padding[3]) ? padding[3] : right;
  }
  return [top, right, bottom, left];
};

/**
 * Checks if `value` is `null` or `undefined`.
 *
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is nullish, else `false`.
 * @example
 *
 * isNil(null)
 * // => true
 *
 * isNil(void 0)
 * // => true
 *
 * isNil(NaN)
 * // => false
 */
function isNil(value: any): boolean {
  return value == null;
}
