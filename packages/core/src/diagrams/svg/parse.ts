import { Rect } from '../../rect';

export interface SvgCommand {
  key: string;
  values: number[];
  relative?: boolean;
  worldPoints?: number[];
}

export interface SvgPath {
  commands: SvgCommand[];
}

// This logic is shamelessly borrowed from Yqnn/svg-path-editor
// https://github.com/Yqnn/svg-path-editor
const commandRegex = /^[\t\n\f\r ]*([MLHVZCSQTAmlhvzcsqta])[\t\n\f\r ]*/;
const flagRegex = /^[01]/;
const numberRegex =
  /^[+-]?(([0-9]*\.[0-9]+)|([0-9]+\.)|([0-9]+))([eE][+-]?[0-9]+)?/;
const commaWsp = /^(([\t\n\f\r ]+,?[\t\n\f\r ]*)|(,[\t\n\f\r ]*))/;

const grammar: { [key: string]: RegExp[] } = {
  M: [numberRegex, numberRegex],
  L: [numberRegex, numberRegex],
  H: [numberRegex],
  V: [numberRegex],
  Z: [],
  C: [
    numberRegex,
    numberRegex,
    numberRegex,
    numberRegex,
    numberRegex,
    numberRegex,
  ],
  S: [numberRegex, numberRegex, numberRegex, numberRegex],
  Q: [numberRegex, numberRegex, numberRegex, numberRegex],
  T: [numberRegex, numberRegex],
  A: [
    numberRegex,
    numberRegex,
    numberRegex,
    flagRegex,
    flagRegex,
    numberRegex,
    numberRegex,
  ],
};

export function parseSvgPath(path: string): SvgPath {
  let cursor = 0;
  const commands: SvgCommand[] = [];
  while (cursor < path.length) {
    const match = path.slice(cursor).match(commandRegex);
    if (match !== null) {
      const command = match[1];
      cursor += match[0].length;
      const parser = parseCommands(command, path, cursor);
      cursor = parser.cursor;
      commands.push(...parser.commands);
    } else {
      throw new Error('malformed path (first error at ' + cursor + ')');
    }
  }
  return { commands };
}

export function getRect(path: SvgPath): Rect {
  let x = Infinity;
  let y = Infinity;
  let ex = -Infinity;
  let ey = -Infinity;

  calcWorldPositions(path);

  path.commands.forEach((item) => {
    item.worldPoints.forEach((num: number, index: number) => {
      if (index % 2 === 0) {
        if (num < x) {
          x = num;
        }
        if (num > ex) {
          ex = num;
        }
      } else {
        if (num < y) {
          y = num;
        }
        if (num > ey) {
          ey = num;
        }
      }
    });
  });
  //TODO ？
  // --x;
  // --y;
  return {
    x,
    y,
    ex,
    ey,
    width: ex - x + 1,
    height: ey - y + 1,
  };
}

export function translatePath(path: SvgPath, x: number, y?: number) {
  if (y == null) {
    y = x;
  }

  path.commands.forEach((item, index) => {
    if (item.relative && index) {
      return;
    }

    switch (item.key) {
      case 'A':
      case 'a':
        item.values[5] += x;
        item.values[6] += y;
        break;
      case 'V':
      case 'v':
        item.values[0] += y;
        break;
      default:
        item.values.forEach((val, i) => {
          item.values[i] = val + (i % 2 === 0 ? x : y);
        });
        break;
    }
  });
}

export function scalePath(path: SvgPath, x: number, y?: number) {
  if (y == null) {
    y = x;
  }

  path.commands.forEach((item) => {
    switch (item.key) {
      case 'A':
      case 'a':
        const a = item.values[0];
        const b = item.values[1];
        const angle = (Math.PI * item.values[2]) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const A = b * b * y * y * cos * cos + a * a * y * y * sin * sin;
        const B = 2 * x * y * cos * sin * (b * b - a * a);
        const C = a * a * x * x * cos * cos + b * b * x * x * sin * sin;
        const F = -(a * a * b * b * x * x * y * y);
        const det = B * B - 4 * A * C;
        const val1 = Math.sqrt((A - C) * (A - C) + B * B);

        // New rotation:
        item.values[2] =
          B !== 0
            ? (Math.atan((C - A - val1) / B) * 180) / Math.PI
            : A < C
            ? 0
            : 90;

        // New radius-x, radius-y
        item.values[0] = -Math.sqrt(2 * det * F * (A + C + val1)) / det;
        item.values[1] = -Math.sqrt(2 * det * F * (A + C - val1)) / det;

        // New target
        item.values[5] *= x;
        item.values[6] *= y;

        // New sweep flag
        item.values[4] = x * y >= 0 ? item.values[4] : 1 - item.values[4];
        break;
      case 'V':
      case 'v':
        item.values[0] *= y;
        break;
      default:
        item.values.forEach((val, index) => {
          item.values[index] = val * (index % 2 === 0 ? x : y);
        });
        break;
    }
  });
}

export function pathToString(path: SvgPath): string {
  let text = '';

  path.commands.forEach((item) => {
    text += item.key + ' ';
    item.values.forEach((num) => {
      text += num + ' ';
    });
  });
  return text;
}

function parseCommands(
  type: string,
  path: string,
  cursor: number
): { cursor: number; commands: SvgCommand[] } {
  const expectedRegexList = grammar[type.toUpperCase()];

  const commands: SvgCommand[] = [];
  while (cursor <= path.length) {
    const command: SvgCommand = { key: type, values: [] };
    for (const regex of expectedRegexList) {
      const match = path.slice(cursor).match(regex);

      if (match !== null) {
        command.values.push(+match[0]);
        cursor += match[0].length;
        const ws = path.slice(cursor).match(commaWsp);
        if (ws !== null) {
          cursor += ws[0].length;
        }
      } else if (command.values.length === 0) {
        return { cursor, commands };
      } else {
        throw new Error('malformed path (first error at ' + cursor + ')');
      }
    }
    command.relative = command.key.toUpperCase() !== command.key;
    commands.push(command);
    if (expectedRegexList.length === 0) {
      return { cursor, commands };
    }
    if (type === 'm') {
      type = 'l';
    }
    if (type === 'M') {
      type = 'L';
    }
  }
  throw new Error('malformed path (first error at ' + cursor + ')');
}

function calcWorldPoints(command: SvgCommand, previous: SvgCommand) {
  const worldPoints: number[] = [];
  let current =
    command.relative && previous
      ? {
          x: previous.worldPoints[previous.worldPoints.length - 2],
          y: previous.worldPoints[previous.worldPoints.length - 1],
        }
      : { x: 0, y: 0 };
  for (let i = 0; i < command.values.length - 1; i += 2) {
    worldPoints.push(current.x + command.values[i]);
    worldPoints.push(current.y + command.values[i + 1]);
  }

  command.worldPoints = worldPoints;
}

function calcWorldPositions(path: SvgPath) {
  let previous: SvgCommand;
  let x = 0;
  let y = 0;
  path.commands.forEach((item) => {
    switch (item.key) {
      case 'Z':
      case 'z':
        item.worldPoints = [x, y];
        break;
      case 'H':
        item.worldPoints = [
          item.values[0],
          previous.worldPoints[previous.worldPoints.length - 1],
        ];
        break;
      case 'h':
        item.worldPoints = [
          item.values[0] +
            previous.worldPoints[previous.worldPoints.length - 2],
          previous.worldPoints[previous.worldPoints.length - 1],
        ];
        break;
      case 'V':
        item.worldPoints = [
          previous.worldPoints[previous.worldPoints.length - 2],
          item.values[0],
        ];
        break;
      case 'v':
        item.worldPoints = [
          previous.worldPoints[previous.worldPoints.length - 2],
          item.values[0] +
            previous.worldPoints[previous.worldPoints.length - 1],
        ];
        break;
      case 'A':
        item.worldPoints = [
          previous.worldPoints[previous.worldPoints.length - 2],
          item.values[0] +
            previous.worldPoints[previous.worldPoints.length - 1],
        ];
        break;
      default:
        calcWorldPoints(item, previous);
        break;
    }

    if (
      item.key === 'M' ||
      item.key === 'm' ||
      item.key === 'Z' ||
      item.key === 'z'
    ) {
      x = item.worldPoints[item.worldPoints.length - 2];
      y = item.worldPoints[item.worldPoints.length - 1];
    }
    previous = item;
  });
}
