import { afterEach, describe, expect, it } from "vitest";

import { singleton } from "./singleton";

const registry = globalThis as { __trigger_singletons?: Map<string, unknown> };

describe("singleton", () => {
  afterEach(() => {
    delete registry.__trigger_singletons;
  });

  it("returns the same instance for a name", () => {
    const first = singleton("db", () => ({ id: 1 }));
    const second = singleton("db", () => ({ id: 2 }));
    expect(second).toBe(first);
  });

  it("runs the factory once", () => {
    let calls = 0;
    const make = () => {
      calls += 1;
      return { id: calls };
    };

    singleton("counted", make);
    singleton("counted", make);
    singleton("counted", make);

    expect(calls).toBe(1);
  });

  it("keeps separate names separate", () => {
    expect(singleton("a", () => "first")).toBe("first");
    expect(singleton("b", () => "second")).toBe("second");
  });

  /*
   * `??=` on a plain object treated a stored undefined or null as absent, so
   * the factory ran again on every call — repeating whatever side effect it
   * carried.
   */
  it("runs the factory once even when it returns undefined", () => {
    let calls = 0;
    const make = () => {
      calls += 1;
      return undefined;
    };

    singleton("undef", make);
    singleton("undef", make);
    singleton("undef", make);

    expect(calls).toBe(1);
  });

  it("runs the factory once even when it returns null", () => {
    let calls = 0;
    const make = () => {
      calls += 1;
      return null;
    };

    singleton("nul", make);
    singleton("nul", make);

    expect(calls).toBe(1);
  });

  it("runs the factory once even when it returns false", () => {
    let calls = 0;
    const make = () => {
      calls += 1;
      return false;
    };

    singleton("flag", make);
    singleton("flag", make);

    expect(calls).toBe(1);
    expect(singleton("flag", make)).toBe(false);
  });

  /*
   * The registry was a plain object, so these names resolved against
   * Object.prototype and read back a function rather than the stored value.
   */
  it("stores a value named after an Object.prototype member", () => {
    const value = { real: true };
    expect(singleton("constructor", () => value)).toBe(value);
    expect(singleton("toString", () => value)).toBe(value);
  });
});
