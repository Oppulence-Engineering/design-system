import { afterEach, describe, expect, it } from "vitest";

import { omit } from "./omit";
import { pick, pickBy } from "./pick";

type Loose = Record<string, unknown>;

const user = { id: "1", name: "Jo", email: "jo@example.com", secret: "s" };

describe("omit", () => {
  it("drops the named keys", () => {
    expect(omit(user, "secret")).toEqual({
      id: "1",
      name: "Jo",
      email: "jo@example.com",
    });
  });

  it("drops several keys", () => {
    expect(omit(user, "secret", "email")).toEqual({ id: "1", name: "Jo" });
  });

  it("ignores keys the object does not have", () => {
    expect(omit({ a: 1 } as Loose, "b")).toEqual({ a: 1 });
  });

  it("leaves the source untouched", () => {
    const source = { ...user };
    omit(source, "secret");
    expect(source).toEqual(user);
  });

  /*
   * `for...in` walks the prototype chain, so a function whose whole job is to
   * leave properties out was adding ones the caller never had.
   */
  it("does not copy inherited properties", () => {
    const object = Object.create({ inherited: "leaked" }) as Loose;
    object.own = 1;

    expect(omit(object, "nothing")).toEqual({ own: 1 });
  });

  describe("with a polluted prototype", () => {
    afterEach(() => {
      delete (Object.prototype as Loose).polluted;
    });

    it("does not copy the polluted key", () => {
      (Object.prototype as Loose).polluted = "leaked";

      expect(omit({ a: 1 } as Loose, "b")).toEqual({ a: 1 });
    });
  });
});

describe("pick", () => {
  it("keeps the named keys", () => {
    expect(pick(user, "id", "name")).toEqual({ id: "1", name: "Jo" });
  });

  it("skips keys the object does not have", () => {
    expect(pick({ a: 1 } as Loose, "b")).toEqual({});
  });

  // `in` finds inherited properties; pickBy, in the same module, has always
  // walked own properties only.
  it("does not reach up the prototype chain", () => {
    const object = Object.create({ inherited: "leaked" }) as Loose;
    object.own = 1;

    expect(pick(object, "inherited")).toEqual({});
    expect(pick(object, "own")).toEqual({ own: 1 });
  });
});

describe("pickBy", () => {
  it("keeps entries the predicate accepts", () => {
    expect(
      pickBy({ a: 1, b: null, c: 3 } as Loose, (_key, value) => value !== null),
    ).toEqual({ a: 1, c: 3 });
  });

  it("can select on the key", () => {
    expect(
      pickBy({ db_host: "h", api_key: "k" } as Loose, (key) =>
        key.startsWith("db_"),
      ),
    ).toEqual({ db_host: "h" });
  });
});
