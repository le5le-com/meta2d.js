import type { Options } from '../options';

type ScriptOptions = Pick<Options, 'allowScript'>;

function noop() {}

export function allowScript(options?: ScriptOptions) {
  return !!options?.allowScript;
}

export function makeSafeFn<T extends (...args: any[]) => any = (...args: any[]) => any>(
  options?: ScriptOptions,
  ...args: string[]
): T {
  if (!allowScript(options)) {
    return noop as T;
  }
  return new Function(...args) as T;
}

export function makeSafeAsyncFn<
  T extends (...args: any[]) => Promise<any> = (...args: any[]) => Promise<any>
>(options?: ScriptOptions, ...args: string[]): T {
  if (!allowScript(options)) {
    return (async () => undefined) as T;
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction(...args) as T;
}

export function makeSafeFunctionString<T extends Function = Function>(
  options: ScriptOptions | undefined,
  value: string
): T {
  if (!allowScript(options)) {
    return noop as unknown as T;
  }
  return makeSafeFn<() => T>(options, `return (${value})`)();
}
