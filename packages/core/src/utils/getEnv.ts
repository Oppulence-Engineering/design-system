import { env } from "std-env";

/**
 * Get an environment variable with optional default value. Runtime agnostic.
 *
 * @param name The name of the environment variable.
 * @param defaultValue The default value to return if the environment variable is not set.
 * @returns The value of the environment variable, or the default value if the environment variable is not set.
 *
 */
export function getEnvVar(
  name: string,
  defaultValue?: string,
): string | undefined {
  return env[name] ?? defaultValue;
}

/**
 * Get an environment variable as a number. Runtime agnostic.
 *
 * Anything that is not a finite number — including an empty or blank value,
 * which a shell produces for `VAR=` — falls back to the default.
 *
 * @param name The name of the environment variable.
 * @param defaultValue The value to return when the variable is unset or not a number.
 * @returns The parsed number, or the default value.
 */
export function getNumberEnvVar(
  name: string,
  defaultValue?: number,
): number | undefined {
  const value = getEnvVar(name);

  /*
   * `Number("")` and `Number(" ")` are both 0, so a variable that was set but
   * left empty read as a deliberate zero rather than as absent — a timeout or
   * a limit configured that way silently became 0.
   */
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  // Rejects NaN and the infinities, neither of which is a usable setting.
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return parsed;
}
