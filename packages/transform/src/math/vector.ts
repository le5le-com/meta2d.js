import { Matrix3x3 } from './matrix';

export class Vector2D {
  x: number;
  y: number;
  z: number = 1;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  // 向量加法
  add(v: Vector2D): Vector2D {
    return new Vector2D(this.x + v.x, this.y + v.y);
  }

  // 向量减法
  sub(v: Vector2D): Vector2D {
    return new Vector2D(this.x - v.x, this.y - v.y);
  }

  // 点乘
  dot(v: Vector2D): number {
    return this.x * v.x + this.y * v.y;
  }

  // 叉乘
  cross(v: Vector2D): number {
    return this.x * v.y - this.y * v.x;
  }


  // 向量长度
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  // 向量距离
  distance(v: Vector2D): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 单位向量 (归一化)
  normalize(): Vector2D {
    const len = this.length();
    if (len === 0) {
      return new Vector2D(0, 0);
    }
    return new Vector2D(this.x / len, this.y / len);
  }

  // 向量角度 (弧度)
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  // 向量角度 (度)
  angleDegrees(): number {
    return this.angle() * 180 / Math.PI;
  }

  // 两个向量的夹角 (弧度)
  angleBetween(v: Vector2D): number {
    const dot = this.dot(v);
    const lengths = this.length() * v.length();
    if (lengths === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / lengths)));
  }

  // 检查向量是否为零向量
  isZero(): boolean {
    return this.x === 0 && this.y === 0;
  }

  // 检查两个向量是否相等
  equals(v: Vector2D, tolerance: number = 1e-10): boolean {
    return Math.abs(this.x - v.x) < tolerance && Math.abs(this.y - v.y) < tolerance;
  }

  // 复制向量
  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  // 转为数组 多返回1 用于矩阵计算
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toArray2D(): [number, number] {
    return [this.x, this.y];
  }

  // 转为字符串
  toString(): string {
    return `Vector2D(${this.x}, ${this.y})`;
  }

  // 与3x3矩阵相乘 (齐次坐标)
  multiplyMatrix3x3(...matrices: Matrix3x3[]): Vector2D {
    const [x, y, z] = this.toArray(); // 当前点的齐次坐标
    let newX = x;
    let newY = y;
    let newZ = z;

    // 遍历每个矩阵并进行乘法运算
    for (const matrix of matrices) {
      const m = matrix.elements;

      const tempX = newX * m[0] + newY * m[1] + newZ * m[2];
      const tempY = newX * m[3] + newY * m[4] + newZ * m[5];
      const tempZ = newX * m[6] + newY * m[7] + newZ * m[8];

      newX = tempX;
      newY = tempY;
      newZ = tempZ;
    }

    // 齐次坐标归一化
    if (newZ !== 0) {
      return new Vector2D(newX / newZ, newY / newZ);
    }
    return new Vector2D(newX, newY);
  }


  // 应用变换矩阵
  transform(...matrix: Matrix3x3[]): Vector2D {
    return this.multiplyMatrix3x3(...matrix);
  }

  // 应用平移变换
  translate(dx: number, dy: number): Vector2D {
    return this.transform(Matrix3x3.translate(dx, dy));
  }

  // 应用缩放变换
  scale(sx: number, sy: number): Vector2D {
    return this.transform(Matrix3x3.scale(sx, sy));
  }


  // 应用旋转变换 (使用矩阵)
  rotate(angle: number): Vector2D {
    return this.transform(Matrix3x3.rotate(angle));
  }

  // 应用倾斜变换
  skew(angleX: number, angleY: number): Vector2D {
    return this.transform(Matrix3x3.skew(angleX, angleY));
  }

  // 零向量
  static zero(): Vector2D {
    return new Vector2D(0, 0);
  }

  // 单位向量
  static one(): Vector2D {
    return new Vector2D(1, 1);
  }

  // 从角度创建单位向量
  static fromAngle(angle: number): Vector2D {
    return new Vector2D(Math.cos(angle), Math.sin(angle));
  }

  // 从两点创建向量
  static fromPoints(p1: Vector2D, p2: Vector2D): Vector2D {
    return p2.sub(p1);
  }

  // 从数组创建向量
  static fromArray(arr: [number, number] | [number, number, number]): Vector2D {
    return new Vector2D(arr[0], arr[1]);
  }
}

export class Vector3D {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  rotateX(angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector3D(
      this.x,
      this.y * cos - this.z * sin,
      this.y * sin + this.z * cos
    );
  }

  rotateY(angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector3D(
      this.x * cos + this.z * sin,
      this.y,
      -this.x * sin + this.z * cos
    );
  }

  rotateZ(angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector3D(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos,
      this.z
    );
  }
}
