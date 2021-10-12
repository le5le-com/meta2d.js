export function getValidValue(num: any, value: number) {
  if (isNaN(num)) {
    return;
  }
  if (value === -1) {
    return num;
  }
  return num - parseInt(num) == 0 ? num : Number(num).toFixed(value);
  // return Number(num).toFixed(value);
}
