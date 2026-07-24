import type { Attributes } from "@opentelemetry/api";
import type { Accessory } from "../schemas/index.ts";
import { SemanticInternalAttributes } from "../semanticInternalAttributes.ts";
import { flattenAttributes } from "./flattenAttributes.ts";

export function accessoryAttributes(accessory: Accessory): Attributes {
  return flattenAttributes(
    accessory,
    SemanticInternalAttributes.STYLE_ACCESSORY,
  );
}
