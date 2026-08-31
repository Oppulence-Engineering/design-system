import { hasIntegrationLogo } from "@oppulence/integrations/logos";
import { IntegrationLogo as IntegrationLogoImage } from "@oppulence/integrations/logos/react";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Monogram tints. A fixed set rather than a generated hue keeps the fallback
 * legible in both themes and recognisably part of the product's palette.
 */
const MONOGRAM_TINTS = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
] as const;

const integrationLogoVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md",
  {
    variants: {
      size: {
        sm: "size-6 p-1 text-[10px]",
        md: "size-8 p-1.5 text-xs",
        lg: "size-10 p-1.5 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** Stable across renders and processes, so a provider keeps its colour. */
function tintFor(integrationId: string): string {
  let hash = 0;
  for (let index = 0; index < integrationId.length; index += 1) {
    hash = (hash * 31 + integrationId.charCodeAt(index)) % 100_000;
  }
  return MONOGRAM_TINTS[hash % MONOGRAM_TINTS.length]!;
}

/** Up to two letters: initials for multi-word names, otherwise a prefix. */
function monogramFor(name: string): string {
  const words = name.split(/[\s-]+/u).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}

export interface IntegrationLogoProps extends VariantProps<
  typeof integrationLogoVariants
> {
  integrationId: string;
  name: string;
}

/**
 * The provider mark for a directory row. Decorative: the provider name is
 * always rendered beside it, so this is hidden from assistive technology
 * rather than repeating the label.
 */
export function IntegrationLogo({
  integrationId,
  name,
  size,
}: IntegrationLogoProps) {
  if (hasIntegrationLogo(integrationId)) {
    return (
      <span
        aria-hidden="true"
        data-slot="integration-logo"
        data-integration-logo="brand"
        className={`${integrationLogoVariants({ size })} bg-white ring-1 ring-black/5`}
      >
        <IntegrationLogoImage
          integrationId={integrationId}
          className="size-full object-contain"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="integration-logo"
      data-integration-logo="monogram"
      className={`${integrationLogoVariants({ size })} ${tintFor(integrationId)} font-semibold`}
    >
      {monogramFor(name)}
    </span>
  );
}

/** Whether a real brand mark exists, as opposed to a monogram fallback. */
export function hasIntegrationBrandIcon(integrationId: string): boolean {
  return hasIntegrationLogo(integrationId);
}
