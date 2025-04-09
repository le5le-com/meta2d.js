

import { applyCommand, normalizeData, getSubPaths, isSubPathClosed, pointEquals } from './utils';

// Function for scaling vectors, keeping it's origin coordinates

const scaleVector = (p1, p2, factor) => {
    const { x: x1, y: y1 } = p1;
    const { x: x2, y: y2 } = p2;
    const x = x2 - x1;
    const y = y2 - y1;
    const dx = x - x * factor;
    const dy = y - y * factor;

    return {
        x: x2 - dx,
        y: y2 - dy
    };
};

const makeBezierPoints = (p1, p2, p3, radius) => {
    // Angle between lines
    const { PI, sqrt, pow, acos, tan, min, max } = Math;
    const { x: x1, y: y1 } = p1;
    const { x: x2, y: y2 } = p2;
    const { x: x3, y: y3 } = p3;
    const a = sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2));
    const b = sqrt(pow(x3 - x2, 2) + pow(y3 - y2, 2));
    const c = sqrt(pow(x3 - x1, 2) + pow(y3 - y1, 2));
    const cosC = (pow(a, 2) + pow(b, 2) - pow(c, 2)) / (2 * a * b); // cos theorem's
    const angle = acos(min(max(-1, cosC), 1)); // clamp acos parameter to [-1, 1]

    // Angle between any side and line from circle center to angle vertex
    const angle2 = PI / 2 - angle / 2;

    // Distance between angle vertex and point where circle touches any side
    const side = radius * tan(angle2);

    // How much new sides becomes shorter
    const aCoef = (a - side) / a;
    const bCoef = (b - side) / b;

    return [scaleVector(p1, p2, aCoef), scaleVector(p3, p2, bCoef)];
};

export const roundSubPath = (subpath, radius) => {
    if (subpath.length === 0) {
        throw new Error('Sub-path could not be empty (it should contain an M command at least');
    }

    // It's impossible to draw a corner if there are less then a 2 command
    if (subpath.length < 2) {
        return subpath;
    }

    // First command should always be an 'M' command
    const mCommand = subpath[0];
    if (mCommand.c !== 'M') {
        throw new Error(`Wrong sub-path data, first command should always by an 'M' command, not "${mCommand.c}"`);
    }

    let begin = applyCommand({ x: 0, y: 0 }, { x: 0, y: 0 }, mCommand);
    subpath = subpath.slice(1);

    const isClosed = isSubPathClosed(begin, subpath);

    const result = [];
    let position = begin;
    for (let i = 0; i < subpath.length; i++) {
        const command1 = subpath[i];
        const command2 = subpath[(i + 1) % subpath.length];
        // const command3 = subpath[(i + 2) % subpath.length]
        const isLastCommand = i === subpath.length - 1;

        const isCorner = (command1.c === 'L' || command1.c === 'Z') && (command2.c === 'L' || command2.c === 'Z');

        if (!isCorner) {
            result.push(command1);
        } else if (isLastCommand && !isClosed) {
            result.push(command1);
        } else {
            const p1 = position;
            let p2 = null;
            let p3 = null;

            if (command1.c === 'L') {
                p2 = { x: command1.x, y: command1.y };
            } else if (command1.c === 'Z') {
                p2 = begin;
            }

            if (command2.c === 'L') {
                p3 = { x: command2.x, y: command2.y };
            } else if (command2.c === 'Z') {
                p3 = begin;
            }

            if (!p1 || !p2 || !p3) {
                throw new Error('Variables weren\'t initialized (some command combination cases weren\'t' + ' handled, this is an internal bug for sure)');
            }

            // Point should not be equals, because makeBezierPoints fails on zero-length triangle sides
            if (pointEquals(p1, p2) || pointEquals(p2, p3) || pointEquals(p1, p3)) {
                result.push(command1);
            } else {
                const [q1, q2] = makeBezierPoints(p1, p2, p3, radius);

                result.push({ c: 'L', x: q1.x, y: q1.y });
                result.push({
                    c: 'Q',
                    x1: p2.x,
                    y1: p2.y,
                    x: q2.x,
                    y: q2.y
                });
                if (isLastCommand) {
                    begin = q2;
                }
            }
        }
        position = applyCommand(position, begin, command1);
    }

    return [{ c: 'M', x: begin.x, y: begin.y }].concat(result);
};

export const roundCorners = (d, radius = 0) => {
    const absD = normalizeData(d);
    const subPaths = getSubPaths(absD);

    const roundedSubPaths = subPaths.map(subPath => roundSubPath(subPath, radius));

    return [].concat(...roundedSubPaths);
};