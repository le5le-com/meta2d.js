// 3x3矩阵类，用于2D变换
export class Matrix3x3 {
  elements: number[];

  constructor(elements?: number[]) {
    // 默认为单位矩阵
    this.elements = elements || [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];
  }

  // 矩阵乘法
  multiply(other: Matrix3x3): Matrix3x3 {
    const a = this.elements;
    const b = other.elements;
    const result = new Array(9);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        result[i * 3 + j] =
          a[i * 3 + 0] * b[0 * 3 + j] +
          a[i * 3 + 1] * b[1 * 3 + j] +
          a[i * 3 + 2] * b[2 * 3 + j];
      }
    }

    return new Matrix3x3(result);
  }

  // 获取逆矩阵
  inverse(): Matrix3x3 | null {
    const m = this.elements;
    const det = this.determinant();

    if (Math.abs(det) < 1e-10) {
      return null; // 矩阵不可逆
    }

    const inv = [
      (m[4] * m[8] - m[5] * m[7]) / det,
      (m[2] * m[7] - m[1] * m[8]) / det,
      (m[1] * m[5] - m[2] * m[4]) / det,
      (m[5] * m[6] - m[3] * m[8]) / det,
      (m[0] * m[8] - m[2] * m[6]) / det,
      (m[2] * m[3] - m[0] * m[5]) / det,
      (m[3] * m[7] - m[4] * m[6]) / det,
      (m[1] * m[6] - m[0] * m[7]) / det,
      (m[0] * m[4] - m[1] * m[3]) / det
    ];

    return new Matrix3x3(inv);
  }

  // 计算行列式
  determinant(): number {
    const m = this.elements;
    return m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6]);
  }

  // 转置矩阵
  transpose(): Matrix3x3 {
    const m = this.elements;
    return new Matrix3x3([
      m[0], m[3], m[6],
      m[1], m[4], m[7],
      m[2], m[5], m[8]
    ]);
  }

  // 复制矩阵
  clone(): Matrix3x3 {
    return new Matrix3x3([...this.elements]);
  }

  // 转为字符串
  toString(): string {
    const m = this.elements;
    return `Matrix3x3(\n` +
      `  ${m[0].toFixed(3)}, ${m[1].toFixed(3)}, ${m[2].toFixed(3)}\n` +
      `  ${m[3].toFixed(3)}, ${m[4].toFixed(3)}, ${m[5].toFixed(3)}\n` +
      `  ${m[6].toFixed(3)}, ${m[7].toFixed(3)}, ${m[8].toFixed(3)}\n` +
      `)`;
  }

  // 单位矩阵
  static identity(): Matrix3x3 {
    return new Matrix3x3();
  }

  // 平移矩阵
  static translate(dx: number, dy: number): Matrix3x3 {
    return new Matrix3x3([
      1, 0, dx,
      0, 1, dy,
      0, 0, 1
    ]);
  }

  // 缩放矩阵
  static scale(sx: number, sy: number): Matrix3x3 {
    return new Matrix3x3([
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1
    ]);
  }

  // 旋转矩阵
  static rotate(angle: number): Matrix3x3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Matrix3x3([
      cos, -sin, 0,
      sin, cos, 0,
      0, 0, 1
    ]);
  }

  // 倾斜矩阵
  static skew(angleX: number, angleY: number): Matrix3x3 {
    return new Matrix3x3([
      1, Math.tan(angleX), 0,
      Math.tan(angleY), 1, 0,
      0, 0, 1
    ]);
  }

  // 复合变换矩阵
  static compose(...matrices: Matrix3x3[]): Matrix3x3 {
    return matrices.reduce((result, matrix) => result.multiply(matrix), Matrix3x3.identity());
  }
}
