export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Copy, validate and freeze JSON data; sorted object keys give canonical equality. */
export function copyJson(
  value: unknown,
  ancestors = new Set<object>(),
): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Values must be finite JSON data');
  }
  if (ancestors.has(value) || ancestors.size >= 100) {
    throw new TypeError('Cyclic or excessively nested JSON value');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        throw new TypeError(
          'Arrays must be dense and have no extra properties',
        );
      }
      const result: JsonValue[] = [];
      for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !('value' in descriptor)) {
          throw new TypeError('Array elements must be data properties');
        }
        result.push(copyJson(descriptor.value, ancestors));
      }
      return Object.freeze(result);
    }
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new TypeError('JSON objects must be plain objects');
    }
    const entries: [string, JsonValue][] = [];
    for (const key of Reflect.ownKeys(value).sort((a, b) =>
      String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0,
    )) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== 'string' ||
        !descriptor?.enumerable ||
        !('value' in descriptor)
      ) {
        throw new TypeError(
          'JSON objects require enumerable string data properties',
        );
      }
      entries.push([key, copyJson(descriptor.value, ancestors)]);
    }
    return Object.freeze(Object.fromEntries(entries));
  } finally {
    ancestors.delete(value);
  }
}
