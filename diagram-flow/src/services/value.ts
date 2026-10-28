export function arraysEqual(a: any[], b: any[]) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

export function findRowIndex(twoDArray: any[][], oneDArray: any[]) {
  for (let i = 0; i < twoDArray.length; i++) {
    if (arraysEqual(twoDArray[i], oneDArray)) {
      return i;
    }
  }
  return -1;
}
