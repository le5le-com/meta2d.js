/**
 * SVG Path rounding function. Takes an input path string and outputs a path
 * string where all line-line corners have been rounded. Only supports absolute
 * commands at the moment.
 *
 * @param pathString The SVG input path
 * @param radius The amount to round the corners, either a value in the SVG
 *               coordinate space, or, if useFractionalRadius is true, a value
 *               from 0 to 1.
 * @param useFractionalRadius If true, the curve radius is expressed as a
 *               fraction of the distance between the point being curved and
 *               the previous and next points.
 * @returns A new SVG path string with the rounding
 */
export function roundPathCorners(paths: string[], radius: number, useFractionalRadius = false) {
  function moveTowardsLength(movingPoint: IPoint, targetPoint: IPoint, amount: number) {
    const width = targetPoint.x - movingPoint.x;
    const height = targetPoint.y - movingPoint.y;

    const distance = Math.sqrt(width * width + height * height);

    return moveTowardsFractional(movingPoint, targetPoint, Math.min(1, amount / distance));
  }

  function moveTowardsFractional(movingPoint: IPoint, targetPoint: IPoint, fraction: number) {
    return {
      x: movingPoint.x + (targetPoint.x - movingPoint.x) * fraction,
      y: movingPoint.y + (targetPoint.y - movingPoint.y) * fraction,
    };
  }

  // Adjusts the ending position of a command
  function adjustCommand(cmd: PathCommand, newPoint: IPoint) {
    if (cmd.length > 2) {
      cmd[cmd.length - 2] = newPoint.x;
      cmd[cmd.length - 1] = newPoint.y;
    }
  }

  // Gives an {x, y} object for a command's ending position
  function pointForCommand(cmd: PathCommand): IPoint {
    return {
      x: cmd[cmd.length - 2] as number,
      y: cmd[cmd.length - 1] as number,
    };
  }
  // console.log('pathString', pathString.split(/[,\s]/));
  // Split apart the path, handing concatonated letters and numbers
  // const pathParts = pathString.split(/[,\s]/).reduce((parts: string[], part: string) => {
  const pathParts = paths.reduce((parts: string[], part: string) => {
    const match = part.match(/([a-zA-Z])(.+)/);
    if (match) {
      parts.push(match[1]);
      parts.push(match[2]);
    } else {
      parts.push(part);
    }

    return parts;
  }, []);

  // Group the commands with their arguments for easier handling
  const commands = pathParts.reduce((result: PathCommand[], part: string) => {
    if (!isNaN(parseFloat(part)) && result.length) {
      // Push numbers to the last command, if there is one
      (result[result.length - 1] as number[]).push(parseFloat(part));
    } else {
      // Push non-numbers as a new command
      result.push([part]);
    }

    return result;
  }, []);

  // The resulting commands, also grouped
  let resultCommands: PathCommand[] = [];

  if (commands.length > 1) {
    const startPoint = pointForCommand(commands[0]);

    // Handle the close path case with a "virtual" closing line
    let virtualCloseLine: PathCommand | null = null;
    if (commands[commands.length - 1][0] === 'Z' && commands[0].length > 2) {
      virtualCloseLine = ['L', startPoint.x, startPoint.y];
      commands[commands.length - 1] = virtualCloseLine;
    }

    // We always use the first command (but it may be mutated)
    resultCommands.push(commands[0]);

    for (let cmdIndex = 1; cmdIndex < commands.length; cmdIndex++) {
      const prevCmd = resultCommands[resultCommands.length - 1];

      const curCmd = commands[cmdIndex];

      // Handle closing case
      const nextCmd = curCmd === virtualCloseLine ? commands[1] : commands[cmdIndex + 1];

      // Nasty logic to decide if this path is a candidate.
      if (nextCmd && prevCmd && prevCmd.length > 2 && curCmd[0] === 'L' && nextCmd.length > 2 && nextCmd[0] === 'L') {
        // Calc the points we're dealing with
        const prevPoint = pointForCommand(prevCmd);
        const curPoint = pointForCommand(curCmd);
        const nextPoint = pointForCommand(nextCmd);

        // The start and end of the curve are just our point moved towards the previous and next points, respectivly
        let curveStart: IPoint;
        let curveEnd: IPoint;

        if (useFractionalRadius) {
          curveStart = moveTowardsFractional(curPoint, prevCmd.origPoint || prevPoint, radius);
          curveEnd = moveTowardsFractional(curPoint, nextCmd.origPoint || nextPoint, radius);
        } else {
          curveStart = moveTowardsLength(curPoint, prevPoint, radius);
          curveEnd = moveTowardsLength(curPoint, nextPoint, radius);
        }

        // Adjust the current command and add it
        adjustCommand(curCmd, curveStart);
        curCmd.origPoint = curPoint;
        resultCommands.push(curCmd);

        // The curve control points are halfway between the start/end of the curve and
        // the original point
        const startControl = moveTowardsFractional(curveStart, curPoint, 0.5);
        const endControl = moveTowardsFractional(curPoint, curveEnd, 0.5);

        // Create the curve
        const curveCmd: PathCommand = [
          'C',
          startControl.x,
          startControl.y,
          endControl.x,
          endControl.y,
          curveEnd.x,
          curveEnd.y,
        ];
        // Save the original point for fractional calculations
        curveCmd.origPoint = curPoint;
        resultCommands.push(curveCmd);
      } else {
        // Pass through commands that don't qualify
        resultCommands.push(curCmd);
      }
    }

    // Fix up the starting point and restore the close path if the path was orignally closed
    if (virtualCloseLine) {
      const newStartPoint = pointForCommand(resultCommands[resultCommands.length - 1]);
      resultCommands.push(['Z']);
      adjustCommand(resultCommands[0], newStartPoint);
    }
  } else {
    resultCommands = commands;
  }

  return resultCommands.map(it => it.join(' ')).join(' ');
}

type PathCommand = ([string] | [string, number?, number?, number?, number?, number?, number?]) & { origPoint?: IPoint };

interface IPoint {
  x: number;
  y: number;
}