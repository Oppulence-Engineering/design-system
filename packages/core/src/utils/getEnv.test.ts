import { afterEach, describe, expect, it } from "vitest";

import { getEnvVar, getNumberEnvVar } from "./getEnv";

const NAME = "OPPULENCE_CORE_TEST_VAR";

describe("getEnvVar", () => {
  afterEach(() => {
    delete process.env[NAME];
  });

  it("reads a set variable", () => {
    process.env[NAME] = "hello";
    expect(getEnvVar(NAME)).toBe("hello");
  });

  it("falls back when unset", () => {
    expect(getEnvVar(NAME, "fallback")).toBe("fallback");
    expect(getEnvVar(NAME)).toBeUndefined();
  });
});

describe("getNumberEnvVar", () => {
  afterEach(() => {
    delete process.env[NAME];
  });

  it("parses a number", () => {
    process.env[NAME] = "42";
    expect(getNumberEnvVar(NAME)).toBe(42);
  });

  it("parses a negative and a decimal", () => {
    process.env[NAME] = "-1.5";
    expect(getNumberEnvVar(NAME)).toBe(-1.5);
  });

  it("falls back when unset", () => {
    expect(getNumberEnvVar(NAME, 7)).toBe(7);
    expect(getNumberEnvVar(NAME)).toBeUndefined();
  });

  it("falls back on a value that is not a number", () => {
    process.env[NAME] = "abc";
    expect(getNumberEnvVar(NAME, 7)).toBe(7);
  });

  /*
   * `Number("")` and `Number(" ")` are both 0, so a variable that was set but
   * left empty — what a shell produces for `VAR=` — read as a deliberate zero.
   * A timeout or a limit configured that way silently became 0.
   */
  it("falls back on an empty value", () => {
    process.env[NAME] = "";
    expect(getNumberEnvVar(NAME, 7)).toBe(7);
  });

  it("falls back on a blank value", () => {
    process.env[NAME] = "   ";
    expect(getNumberEnvVar(NAME, 7)).toBe(7);
  });

  it("falls back on an infinity", () => {
    process.env[NAME] = "Infinity";
    expect(getNumberEnvVar(NAME, 7)).toBe(7);
  });
});
