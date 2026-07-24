/**
 * Minimal type declarations for humanize-duration.
 * These types are stubs that allow the build to succeed without
 * @types/humanize-duration dev dependency installed.
 *
 * During development, the full types from @types/humanize-duration
 * provide better type checking and autocompletion.
 */

declare module "humanize-duration" {
  export type Unit = "y" | "mo" | "w" | "d" | "h" | "m" | "s" | "ms";

  export type Options = {
    language?: string;
    fallbacks?: string[];
    delimiter?: string;
    spacer?: string;
    largest?: number;
    units?: Unit[];
    round?: boolean;
    decimal?: string;
    conjunction?: string;
    serialComma?: boolean;
    maxDecimalPoints?: number;
    unitMeasures?: {
      y?: number;
      mo?: number;
      w?: number;
      d?: number;
      h?: number;
      m?: number;
      s?: number;
      ms?: number;
    };
  };

  function humanizeDuration(ms: number, options?: Options): string;

  export default humanizeDuration;
}
