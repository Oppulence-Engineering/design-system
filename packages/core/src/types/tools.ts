import type { Schema as AISchema } from "ai";
import { z } from "zod";
import type { Schema } from "./schemas.js";

// biome-ignore lint/suspicious/noExplicitAny: AISchema requires any for generic inference
export type ToolTaskParameters = z.ZodTypeAny | AISchema<any>;

export type inferToolParameters<PARAMETERS extends ToolTaskParameters> =
  // biome-ignore lint/suspicious/noExplicitAny: AISchema requires any for generic inference
  PARAMETERS extends AISchema<any>
    ? PARAMETERS["_type"]
    : PARAMETERS extends z.ZodTypeAny
      ? z.infer<PARAMETERS>
      : never;

export function convertToolParametersToSchema<
  TToolParameters extends ToolTaskParameters,
>(toolParameters: TToolParameters): Schema {
  return isZodToolParameters(toolParameters)
    ? toolParameters
    : convertAISchemaToTaskSchema(toolParameters);
}

function isZodToolParameters(
  toolParameters: ToolTaskParameters,
): toolParameters is z.ZodTypeAny {
  return (
    typeof toolParameters === "object" &&
    toolParameters !== null &&
    toolParameters instanceof z.ZodType
  );
}

// biome-ignore lint/suspicious/noExplicitAny: AISchema requires any for generic inference
function convertAISchemaToTaskSchema(schema: AISchema<any>): Schema {
  return async (payload: unknown) => {
    const result = await schema.validate?.(payload);

    if (!result) {
      throw new Error("Invalid payload");
    }

    if (!result.success) {
      throw result.error;
    }

    return result.value;
  };
}
