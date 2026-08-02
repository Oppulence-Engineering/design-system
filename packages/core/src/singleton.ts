/**
 * The process-wide registry. Held on `globalThis` so a module loaded more than
 * once — different bundles, or ESM and CJS side by side — still shares one
 * instance. Values are `unknown` because callers register unrelated types; each
 * caller asserts its own on the way out.
 */
type SingletonRegistry = {
  __trigger_singletons?: Map<string, unknown>;
};

/**
 * Returns the value registered under `name`, creating it on first use.
 *
 * `getValue` runs at most once per name for the life of the process.
 *
 * @example
 * ```typescript
 * const db = singleton("db", () => new DatabaseClient());
 * ```
 */
export function singleton<T>(name: string, getValue: () => T): T {
  const registry = globalThis as SingletonRegistry;

  /*
   * A Map with an explicit `has`, rather than `??=` on a plain object. `??=`
   * treats a stored `undefined` or `null` as absent, so a factory returning
   * either one ran again on every call — the opposite of a singleton, and a
   * repeated side effect if the factory had one. A Map also keeps names like
   * "__proto__" and "constructor" from colliding with Object.prototype.
   */
  const singletons = (registry.__trigger_singletons ??= new Map<
    string,
    unknown
  >());

  if (!singletons.has(name)) {
    singletons.set(name, getValue());
  }

  return singletons.get(name) as T;
}
