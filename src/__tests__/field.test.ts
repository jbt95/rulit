import { describe, expect, it } from "vitest";
import { Rules } from "../index";

type Facts = {
  user: {
    age: number;
    name: string;
    tags: string[];
    active: boolean;
    createdAt: Date;
  };
};

describe("field operators", () => {
  const factsField = Rules.field<Facts>();
  const facts: Facts = {
    user: {
      age: 30,
      name: "Ada",
      tags: ["vip", "new"],
      active: true,
      createdAt: new Date("2024-01-10"),
    },
  };

  it("evaluates numeric operators", () => {
    expect(factsField("user.age").gt(18)(facts).result).toBe(true);
    expect(factsField("user.age").between(20, 40)(facts).result).toBe(true);
    expect(factsField("user.age").lt(40)(facts).result).toBe(true);
    expect(factsField("user.age").lte(30)(facts).result).toBe(true);
  });

  it("evaluates string operators", () => {
    expect(factsField("user.name").contains("Ad")(facts).result).toBe(true);
    expect(factsField("user.name").startsWith("Ada")(facts).result).toBe(true);
    expect(factsField("user.name").matches(/^A/)(facts).result).toBe(true);
  });

  it("evaluates boolean operators", () => {
    expect(factsField("user.active").isTrue()(facts).result).toBe(true);
    expect(factsField("user.active").isFalse()(facts).result).toBe(false);
  });

  it("evaluates date operators", () => {
    expect(factsField("user.createdAt").after(new Date("2024-01-01"))(facts).result).toBe(true);
    expect(factsField("user.createdAt").before(new Date("2025-01-01"))(facts).result).toBe(true);
  });

  it("evaluates array operators", () => {
    expect(factsField("user.tags").contains("vip")(facts).result).toBe(true);
    expect(factsField("user.tags").any((item) => item === "vip")(facts).result).toBe(true);
    expect(factsField("user.tags").all((item) => typeof item === "string")(facts).result).toBe(
      true,
    );
  });

  it("returns false for contains on non-string/array values", () => {
    const unsafeField = factsField as unknown as (path: "user.age") => {
      contains: (value: unknown) => (facts: Facts) => { result: boolean };
    };
    expect(unsafeField("user.age").contains(99)(facts).result).toBe(false);
  });

  it("returns undefined for invalid paths at runtime", () => {
    const unsafeField = factsField as unknown as (path: "user.age.value") => {
      eq: (value: unknown) => (facts: Facts) => { result: boolean };
    };
    expect(unsafeField("user.age.value").eq(undefined)(facts).result).toBe(true);
  });
});
