import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Stagehand's published OpenAPI document:
 * https://docs.browserbase.com/reference/api/openapi.v1.yaml
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Stagehand publishes no maintained Node SDK; its OpenAPI document at https://docs.browserbase.com/reference/api/openapi.v1.yaml is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "run-agent",
    name: "Run Agent",
    description:
      "Run an autonomous web agent to complete tasks and extract structured data",
    method: "POST",
    url: "/v1/agents/runs",
    input: z
      .object({
        agentId: z.string().max(4_000).optional(),
        task: z.string().max(4_000),
        resultSchema: SpecObject.optional(),
        browserSettings: SpecObject.optional(),
        variables: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.agentId !== undefined ? { agentId: i.agentId } : {}),
      task: i.task,
      ...(i.resultSchema !== undefined ? { resultSchema: i.resultSchema } : {}),
      ...(i.browserSettings !== undefined
        ? { browserSettings: i.browserSettings }
        : {}),
      ...(i.variables !== undefined ? { variables: i.variables } : {}),
    }),
  },
];

export function createStagehandPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "stagehand",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "extract-data":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
