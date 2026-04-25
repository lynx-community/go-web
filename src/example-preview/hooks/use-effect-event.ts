import { useEffect, useMemo, useRef } from 'react';

function useEffectEvent<TArgs extends unknown[]>(
  fn: ((...args: TArgs) => void) | undefined,
): (...args: TArgs) => void;

function useEffectEvent<TArgs extends unknown[], TResult>(
  fn: ((...args: TArgs) => TResult) | undefined,
  options: { fallbackResult: TResult },
): (...args: TArgs) => TResult;

function useEffectEvent<TArgs extends unknown[], TResult>(
  fn: ((...args: TArgs) => TResult) | undefined,
  options?: { fallbackResult: TResult },
): (...args: TArgs) => TResult {
  const ref = useRef(fn);

  useEffect(() => {
    ref.current = fn;
  }, [fn]);

  return useMemo(() => {
    const proxy = (...args: TArgs) => {
      const f = ref.current;
      if (f) {
        return f(...args);
      }
      if (options) {
        return options.fallbackResult;
      }
      return undefined as unknown as TResult;
    };
    return proxy;
  }, [options]);
}

export { useEffectEvent };
