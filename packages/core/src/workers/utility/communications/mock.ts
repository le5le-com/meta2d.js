import { Meta2dData, WorkerMessage } from '../../../types';
import { Pen, Property } from '../../../models';

type MockValue = string | number | boolean;

type MockPen = Pick<Pen, 'id' | 'properties'>;

let mockTimer: ReturnType<typeof setInterval> | undefined;
let mockPens: MockPen[] = [];

/**
 * 根据属性配置生成一次模拟值，规则与旧版 core.ts 保持一致。
 */
export function mockValue(property: Property): MockValue | undefined {
  if (!property.enableMock || property.mock === undefined) {
    return undefined;
  }

  const mock = property.mock;
  if (property.type === 'float') {
    if (mock && mock.includes(',')) {
      const values = mock.split(',');
      return parseFloat(values[Math.floor(Math.random() * values.length)]);
    }

    if (mock && mock.includes('-')) {
      let max: number;
      let min: number;
      let length: string;
      const values = mock.split('-');

      if (mock.charAt(0) === '-') {
        // 负数范围例如 -10--2 会被 split 成 ['', '10', '', '2']。
        if (values.length === 4) {
          max = -parseFloat(values[3]);
          min = -parseFloat(values[1]);
          length = values[3];
        } else {
          max = parseFloat(values[2]);
          min = -parseFloat(values[1]);
          length = values[2];
        }
      } else {
        max = parseFloat(values[1]);
        min = parseFloat(values[0]);
        length = values[1];
      }

      const decimalLength = length.includes('.') ? length.split('.')[1].length : 0;
      const value = Math.random() * (max - min) + min;
      return decimalLength ? value.toFixed(decimalLength) : value;
    }

    return parseFloat(mock);
  }

  if (property.type === 'integer') {
    if (mock && mock.includes(',')) {
      const values = mock.split(',');
      return parseInt(values[Math.floor(Math.random() * values.length)], 10);
    }

    if (mock && mock.includes('-')) {
      let max: number;
      let min: number;
      const values = mock.split('-');

      if (mock.charAt(0) === '-') {
        if (values.length === 4) {
          max = -parseFloat(values[3]);
          min = -parseFloat(values[1]);
        } else {
          max = parseFloat(values[2]);
          min = -parseFloat(values[1]);
        }
      } else {
        max = parseInt(values[1], 10);
        min = parseInt(values[0], 10);
      }

      return parseInt(`${Math.random() * (max - min) + min}`, 10);
    }

    return parseInt(mock, 10);
  }

  if (property.type === 'bool') {
    if (typeof property.mock === 'boolean') {
      return property.mock;
    }
    if (mock === 'true') {
      return true;
    }
    if (mock === 'false') {
      return false;
    }
    return Math.random() < 0.5;
  }

  // 旧版不会为对象和数组生成模拟值，避免破坏其原有结构。
  if (property.type === 'object' || property.type === 'array') {
    return undefined;
  }

  if (mock.includes(',')) {
    const values = mock.split(',');
    return values[Math.floor(Math.random() * values.length)];
  }

  if (mock.startsWith('[') && mock.endsWith(']')) {
    const length = parseInt(mock.substring(1, mock.length - 1), 10);
    return randomString(length);
  }

  return mock;
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 开启或停止模拟定时器。每次更新配置都会先清理旧定时器，保证只存在一个推送循环。
 */
export function setMockData(data: Pick<Meta2dData, 'mock'> & { pens?: MockPen[] }) {
  stopMock();
  mockPens = data.pens || [];

  if (data.mock === true) {
    mockTimer = setInterval(pushMockData, 1000);
  }
}

export function stopMock() {
  if (mockTimer !== undefined) {
    clearInterval(mockTimer);
    mockTimer = undefined;
  }
}

function pushMockData() {
  const values: Array<{ id: string; [key: string]: MockValue }> = [];
  const valueMap = new Map<string, { id: string; [key: string]: MockValue }>();

  for (const pen of mockPens) {
    if (!pen.id || !pen.properties?.length) {
      continue;
    }

    for (const property of pen.properties) {
      if (!property.key) {
        continue;
      }

      const value = mockValue(property);
      if (value === undefined) {
        continue;
      }

      let penValue = valueMap.get(pen.id);
      if (!penValue) {
        penValue = { id: pen.id };
        valueMap.set(pen.id, penValue);
        values.push(penValue);
      }
      penValue[property.key] = value;
    }
  }

  if (values.length) {
    self.postMessage({
      action: WorkerMessage.MessageCallback,
      values,
    });
  }
}
