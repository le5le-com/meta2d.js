
export function abs(num: number, percent: number | string): number {
  if (+percent) {
    return +percent;
  }

  if (!percent || percent[(percent as string).length - 1] !== '%') {
    return 0;
  }

  percent = (percent as string).substr(0, (percent as string).length - 1);

  return (num * +percent) / 100;
}

export function distance(pt1: { x: number; y: number; }, pt2: { x: number; y: number; }) {
  const x = pt1.x - pt2.x;
  const y = pt1.y - pt2.y;
  return Math.sqrt(x * x + y * y);
}
