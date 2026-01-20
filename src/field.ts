import { condition } from "./condition";
import type { Condition } from "./types";

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type DotPrefix<T extends string> = T extends "" ? "" : `.${T}`;

type PathImpl<T, Key extends keyof T> = Key extends string
  ? T[Key] extends Primitive
    ? Key
    : T[Key] extends Array<unknown>
      ? Key
      : T[Key] extends Date
        ? Key
        : Key | `${Key}${DotPrefix<Path<T[Key]>>}`
  : never;

export type Path<T> = T extends object ? { [K in keyof T]-?: PathImpl<T, K> }[keyof T] : never;

export type PathValue<T, P extends Path<T>> = P extends `${infer Key}.${infer Rest}`
  ? Key extends keyof T
    ? Rest extends Path<T[Key]>
      ? PathValue<T[Key], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

type FieldOperators<T, P extends Path<T>> =
  PathValue<T, P> extends number
    ? NumberOperators<T, P>
    : PathValue<T, P> extends string
      ? StringOperators<T, P>
      : PathValue<T, P> extends boolean
        ? BooleanOperators<T, P>
        : PathValue<T, P> extends Date
          ? DateOperators<T, P>
          : PathValue<T, P> extends Array<infer U>
            ? ArrayOperators<T, P, U>
            : BaseOperators<T, P>;

type BaseOperators<T, P extends Path<T>> = {
  eq: (value: PathValue<T, P>) => Condition<T>;
  in: (values: PathValue<T, P>[]) => Condition<T>;
};

type NumberOperators<T, P extends Path<T>> = BaseOperators<T, P> & {
  gt: (value: number) => Condition<T>;
  gte: (value: number) => Condition<T>;
  lt: (value: number) => Condition<T>;
  lte: (value: number) => Condition<T>;
  between: (min: number, max: number) => Condition<T>;
};

type StringOperators<T, P extends Path<T>> = BaseOperators<T, P> & {
  contains: (value: string) => Condition<T>;
  startsWith: (value: string) => Condition<T>;
  matches: (value: RegExp) => Condition<T>;
};

type BooleanOperators<T, P extends Path<T>> = BaseOperators<T, P> & {
  isTrue: () => Condition<T>;
  isFalse: () => Condition<T>;
};

type DateOperators<T, P extends Path<T>> = BaseOperators<T, P> & {
  before: (value: Date) => Condition<T>;
  after: (value: Date) => Condition<T>;
};

type ArrayOperators<T, P extends Path<T>, U> = BaseOperators<T, P> & {
  contains: (value: U) => Condition<T>;
  any: (predicate: (item: U) => boolean, label?: string) => Condition<T>;
  all: (predicate: (item: U) => boolean, label?: string) => Condition<T>;
};

export type Field<T, P extends Path<T>> = {
  path: P;
  get: (facts: T) => PathValue<T, P>;
} & FieldOperators<T, P>;

/**
 * Create a typed field accessor for a facts model.
 *
 * @example
 * ```ts
 * const factsField = Rules.field<Facts>();
 * const isAdult = factsField("user.age").gte(18);
 * ```
 */
export function field<T>(): <P extends Path<T>>(path: P) => Field<T, P>;
/**
 * Create a typed field accessor for a specific path.
 *
 * @example
 * ```ts
 * const isVip = Rules.field<Facts>()("user.tags").contains("vip");
 * ```
 */
export function field<T, P extends Path<T>>(path: P): Field<T, P>;
export function field<T, P extends Path<T>>(path?: P) {
  if (path === undefined) {
    return (nextPath: P) => createField<T, P>(nextPath);
  }
  return createField<T, P>(path);
}

function createField<T, P extends Path<T>>(path: P): Field<T, P> {
  const getter = (facts: T) => getPathValue(facts, path) as PathValue<T, P>;

  const base = {
    path,
    get: getter,
    eq: (value: PathValue<T, P>) =>
      condition<T>(
        `${path} == ${String(value)}`,
        (facts) => getter(facts) === value,
        (facts) => ({
          left: getter(facts),
          op: "==",
          right: value,
        }),
      ),
    in: (values: PathValue<T, P>[]) =>
      condition<T>(
        `${path} in [${values.length}]`,
        (facts) => values.includes(getter(facts)),
        (facts) => ({
          left: getter(facts),
          op: "in",
          right: values,
        }),
      ),
  } as unknown as Field<T, P>;

  return addOperators(base);
}

function addOperators<T, P extends Path<T>>(base: Field<T, P>): Field<T, P> {
  const anyBase = base as Field<T, P> & Record<string, unknown>;

  anyBase.gt = (value: number) =>
    condition<T>(
      `${base.path} > ${value}`,
      (facts) => Number(base.get(facts)) > value,
      (facts) => ({
        left: base.get(facts),
        op: ">",
        right: value,
      }),
    );

  anyBase.gte = (value: number) =>
    condition<T>(
      `${base.path} >= ${value}`,
      (facts) => Number(base.get(facts)) >= value,
      (facts) => ({
        left: base.get(facts),
        op: ">=",
        right: value,
      }),
    );

  anyBase.lt = (value: number) =>
    condition<T>(
      `${base.path} < ${value}`,
      (facts) => Number(base.get(facts)) < value,
      (facts) => ({
        left: base.get(facts),
        op: "<",
        right: value,
      }),
    );

  anyBase.lte = (value: number) =>
    condition<T>(
      `${base.path} <= ${value}`,
      (facts) => Number(base.get(facts)) <= value,
      (facts) => ({
        left: base.get(facts),
        op: "<=",
        right: value,
      }),
    );

  anyBase.between = (min: number, max: number) =>
    condition<T>(
      `${base.path} between ${min} and ${max}`,
      (facts) => {
        const value = Number(base.get(facts));
        return value >= min && value <= max;
      },
      (facts) => ({
        left: base.get(facts),
        op: "between",
        right: [min, max],
      }),
    );

  anyBase.contains = (value: unknown) =>
    condition<T>(
      `${base.path} contains ${String(value)}`,
      (facts) => {
        const current = base.get(facts) as unknown;
        if (typeof current === "string") {
          return current.includes(String(value));
        }
        if (Array.isArray(current)) {
          return current.includes(value);
        }
        return false;
      },
      (facts) => ({
        left: base.get(facts),
        op: "contains",
        right: value,
      }),
    );

  anyBase.startsWith = (value: string) =>
    condition<T>(
      `${base.path} startsWith ${value}`,
      (facts) => {
        const current = base.get(facts);
        return typeof current === "string" ? current.startsWith(value) : false;
      },
      (facts) => ({
        left: base.get(facts),
        op: "startsWith",
        right: value,
      }),
    );

  anyBase.matches = (value: RegExp) =>
    condition<T>(
      `${base.path} matches ${value.toString()}`,
      (facts) => {
        const current = base.get(facts);
        return typeof current === "string" ? value.test(current) : false;
      },
      (facts) => ({
        left: base.get(facts),
        op: "matches",
        right: value.toString(),
      }),
    );

  anyBase.isTrue = () =>
    condition<T>(
      `${base.path} is true`,
      (facts) => base.get(facts) === true,
      (facts) => ({
        left: base.get(facts),
        op: "is",
        right: true,
      }),
    );

  anyBase.isFalse = () =>
    condition<T>(
      `${base.path} is false`,
      (facts) => base.get(facts) === false,
      (facts) => ({
        left: base.get(facts),
        op: "is",
        right: false,
      }),
    );

  anyBase.before = (value: Date) =>
    condition<T>(
      `${base.path} before ${value.toISOString()}`,
      (facts) => {
        const current = base.get(facts);
        return current instanceof Date ? current.getTime() < value.getTime() : false;
      },
      (facts) => ({
        left: base.get(facts),
        op: "before",
        right: value.toISOString(),
      }),
    );

  anyBase.after = (value: Date) =>
    condition<T>(
      `${base.path} after ${value.toISOString()}`,
      (facts) => {
        const current = base.get(facts);
        return current instanceof Date ? current.getTime() > value.getTime() : false;
      },
      (facts) => ({
        left: base.get(facts),
        op: "after",
        right: value.toISOString(),
      }),
    );

  anyBase.any = (predicate: (item: unknown) => boolean, label = `${base.path} any`) =>
    condition<T>(
      label,
      (facts) => {
        const current = base.get(facts);
        return Array.isArray(current) ? current.some(predicate) : false;
      },
      (facts) => ({
        left: base.get(facts),
        op: "any",
        right: "predicate",
      }),
    );

  anyBase.all = (predicate: (item: unknown) => boolean, label = `${base.path} all`) =>
    condition<T>(
      label,
      (facts) => {
        const current = base.get(facts);
        return Array.isArray(current) ? current.every(predicate) : false;
      },
      (facts) => ({
        left: base.get(facts),
        op: "all",
        right: "predicate",
      }),
    );

  return base;
}

function getPathValue<T, P extends Path<T>>(facts: T, path: P): unknown {
  const parts = String(path).split(".");
  let current: unknown = facts;

  for (const part of parts) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
