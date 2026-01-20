import { describe, expect, it } from "vitest";
import { Rules } from "../index";

type Facts = {
  value: number;
};

describe("op composition", () => {
  const gtZero = Rules.condition<Facts>(
    "gt-zero",
    (facts) => facts.value > 0,
    (facts) => ({
      left: facts.value,
      op: ">",
      right: 0,
    }),
  );
  const ltTen = Rules.condition<Facts>(
    "lt-ten",
    (facts) => facts.value < 10,
    (facts) => ({
      left: facts.value,
      op: "<",
      right: 10,
    }),
  );

  it("and combines conditions", () => {
    const combined = Rules.op.and(gtZero, ltTen);
    expect(combined({ value: 5 }).result).toBe(true);
    expect(combined({ value: 20 }).result).toBe(false);
  });

  it("or combines conditions", () => {
    const combined = Rules.op.or(gtZero, ltTen);
    expect(combined({ value: -1 }).result).toBe(true);
    expect(combined({ value: 20 }).result).toBe(true);
  });

  it("not negates a condition", () => {
    const combined = Rules.op.not(gtZero);
    expect(combined({ value: 1 }).result).toBe(false);
    expect(combined({ value: -1 }).result).toBe(true);
  });

  it("captures child traces", () => {
    const combined = Rules.op.and("range-check", gtZero, ltTen);
    const trace = combined({ value: 3 });
    expect(trace.children?.length).toBe(2);
    expect(trace.label).toBe("range-check");
  });

  it("handles empty condition lists", () => {
    const emptyAnd = (Rules.op.and as unknown as () => ReturnType<typeof Rules.op.and>)();
    const emptyOr = (Rules.op.or as unknown as () => ReturnType<typeof Rules.op.or>)();

    expect(emptyAnd({ value: 1 }).result).toBe(true);
    expect(emptyOr({ value: 1 }).result).toBe(false);
  });

  it("supports custom operators", () => {
    const isEven = Rules.op.custom<Facts>(
      "is-even",
      (facts) => facts.value % 2 === 0,
      (facts) => ({
        left: facts.value,
        op: "%",
        right: 2,
      }),
    );

    const trace = isEven({ value: 4 });
    expect(trace.result).toBe(true);
    expect(trace.label).toBe("is-even");
  });

  it("registers and uses operators", () => {
    const name = "is-positive";
    if (!Rules.op.has(name)) {
      Rules.op.register<Facts, []>(name, () =>
        Rules.condition("positive", (facts) => facts.value > 0),
      );
    }

    const predicate = Rules.op.use<Facts, []>(name);
    expect(predicate({ value: 1 }).result).toBe(true);
    expect(Rules.op.list()).toContain(name);
  });

  it("rejects duplicate operator names", () => {
    const name = "unique-op";
    if (!Rules.op.has(name)) {
      Rules.op.register<Facts, []>(name, () =>
        Rules.condition("unique", (facts) => facts.value > -1),
      );
    }

    expect(() => Rules.op.register(name, () => Rules.condition("dup", () => true))).toThrow(
      'Operator "unique-op" is already registered.',
    );
  });
});
