import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Daytona's published OpenAPI document:
 * https://api.daytona.io/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Daytona publishes no maintained Node SDK; its OpenAPI document at https://api.daytona.io/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "create-sandbox",
    name: "Create Sandbox",
    description:
      "Create a new Daytona sandbox for running AI-generated code in isolation",
    method: "POST",
    url: "/sandbox",
    input: z
      .object({
        name: z.string().max(4_000).optional(),
        snapshot: z.string().max(4_000).optional(),
        user: z.string().max(4_000).optional(),
        env: SpecObject.optional(),
        labels: SpecObject.optional(),
        public: z.boolean().optional(),
        networkBlockAll: z.boolean().optional(),
        networkAllowList: z.string().max(4_000).optional(),
        domainAllowList: z.string().max(4_000).optional(),
        target: z.string().max(4_000).optional(),
        cpu: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        gpu: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
        gpuType: SpecArray.optional(),
        memory: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        disk: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        autoStopInterval: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        autoPauseInterval: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        autoArchiveInterval: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        autoDeleteInterval: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        ttlMinutes: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        volumes: SpecArray.optional(),
        buildInfo: SpecObject.optional(),
        linkedSandbox: z.string().max(4_000).optional(),
        secrets: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.snapshot !== undefined ? { snapshot: i.snapshot } : {}),
      ...(i.user !== undefined ? { user: i.user } : {}),
      ...(i.env !== undefined ? { env: i.env } : {}),
      ...(i.labels !== undefined ? { labels: i.labels } : {}),
      ...(i.public !== undefined ? { public: i.public } : {}),
      ...(i.networkBlockAll !== undefined
        ? { networkBlockAll: i.networkBlockAll }
        : {}),
      ...(i.networkAllowList !== undefined
        ? { networkAllowList: i.networkAllowList }
        : {}),
      ...(i.domainAllowList !== undefined
        ? { domainAllowList: i.domainAllowList }
        : {}),
      ...(i.target !== undefined ? { target: i.target } : {}),
      ...(i.cpu !== undefined ? { cpu: i.cpu } : {}),
      ...(i.gpu !== undefined ? { gpu: i.gpu } : {}),
      ...(i.gpuType !== undefined ? { gpuType: i.gpuType } : {}),
      ...(i.memory !== undefined ? { memory: i.memory } : {}),
      ...(i.disk !== undefined ? { disk: i.disk } : {}),
      ...(i.autoStopInterval !== undefined
        ? { autoStopInterval: i.autoStopInterval }
        : {}),
      ...(i.autoPauseInterval !== undefined
        ? { autoPauseInterval: i.autoPauseInterval }
        : {}),
      ...(i.autoArchiveInterval !== undefined
        ? { autoArchiveInterval: i.autoArchiveInterval }
        : {}),
      ...(i.autoDeleteInterval !== undefined
        ? { autoDeleteInterval: i.autoDeleteInterval }
        : {}),
      ...(i.ttlMinutes !== undefined ? { ttlMinutes: i.ttlMinutes } : {}),
      ...(i.volumes !== undefined ? { volumes: i.volumes } : {}),
      ...(i.buildInfo !== undefined ? { buildInfo: i.buildInfo } : {}),
      ...(i.linkedSandbox !== undefined
        ? { linkedSandbox: i.linkedSandbox }
        : {}),
      ...(i.secrets !== undefined ? { secrets: i.secrets } : {}),
    }),
  },
  {
    action: "get-sandbox",
    name: "Get Sandbox",
    description: "Get details of a Daytona sandbox",
    method: "GET",
    url: (i) =>
      `/sandbox/${restSegment(i.sandboxIdOrName)}${restQuery({ verbose: i.verbose })}`,
    input: z
      .object({
        sandboxIdOrName: z.string().max(4_000),
        verbose: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "start-sandbox",
    name: "Start Sandbox",
    description: "Start a stopped Daytona sandbox",
    method: "POST",
    url: (i) => `/sandbox/${restSegment(i.sandboxIdOrName)}/start`,
    input: z
      .object({
        sandboxIdOrName: z.string().max(4_000),
        body: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.body ?? {}),
    }),
  },
  {
    action: "stop-sandbox",
    name: "Stop Sandbox",
    description: "Stop a running Daytona sandbox",
    method: "POST",
    url: (i) =>
      `/sandbox/${restSegment(i.sandboxIdOrName)}/stop${restQuery({ force: i.force })}`,
    input: z
      .object({
        sandboxIdOrName: z.string().max(4_000),
        force: z.boolean().optional(),
        body: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.body ?? {}),
    }),
  },
  {
    action: "delete-sandbox",
    name: "Delete Sandbox",
    description: "Delete a Daytona sandbox",
    method: "DELETE",
    url: (i) => `/sandbox/${restSegment(i.sandboxIdOrName)}`,
    input: z
      .object({
        sandboxIdOrName: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
];

export function createDaytonaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "daytona",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "run-code":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "execute-command":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "upload-file":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "download-file":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-files":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "git-clone":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-sandboxes":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
