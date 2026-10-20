export type Guard<T> = (value: unknown) => value is T;
export const string: Guard<string> = (v): v is string => typeof v === 'string';
export const number: Guard<number> = (v): v is number =>
  typeof v === 'number' && Number.isFinite(v);
export const index: Guard<number> = (v): v is number => number(v) && Number.isInteger(v) && v >= 0;
export const object: Guard<Record<string, unknown>> = (v): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const files: Guard<{ name?: string; data?: ArrayBuffer | Uint8Array }[]> = (
  v
): v is { name?: string; data?: ArrayBuffer | Uint8Array }[] =>
  Array.isArray(v) &&
  v.every(
    x =>
      object(x) &&
      (x.name === undefined || string(x.name)) &&
      (x.data === undefined || binary(x.data))
  );
export const array: Guard<unknown[]> = Array.isArray;
export const strings: Guard<string[]> = (v): v is string[] => Array.isArray(v) && v.every(string);
export const float32: Guard<Float32Array> = (v): v is Float32Array => v instanceof Float32Array;
export const binary: Guard<ArrayBuffer | Uint8Array> = (v): v is ArrayBuffer | Uint8Array =>
  v instanceof ArrayBuffer || v instanceof Uint8Array;
export const optional =
  <T>(guard: Guard<T>): Guard<T | undefined> =>
  (value): value is T | undefined =>
    value === undefined || guard(value);
export type Fields<S> = { [K in keyof S]: S[K] extends Guard<infer T> ? T : never };

export const namedFiles: Guard<{ name: string; data: ArrayBuffer | Uint8Array }[]> = (
  value
): value is { name: string; data: ArrayBuffer | Uint8Array }[] =>
  Array.isArray(value) &&
  value.every(file => object(file) && string(file.name) && !!file.name && binary(file.data));
