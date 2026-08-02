import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Infisical's published OpenAPI document:
 * https://app.infisical.com/api/docs/json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Infisical publishes no maintained Node SDK; its OpenAPI document at https://app.infisical.com/api/docs/json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-secrets",
    name: "List Secrets",
    description:
      "List all secrets in a project environment. Returns secret keys, values, comments, tags, and metadata.",
    method: "GET",
    url: (i) =>
      `/api/v4/secrets${restQuery({ metadataFilter: i.metadataFilter, projectId: i.projectId, environment: i.environment, secretPath: i.secretPath, viewSecretValue: i.viewSecretValue, expandSecretReferences: i.expandSecretReferences, recursive: i.recursive, includePersonalOverrides: i.includePersonalOverrides, includeImports: i.includeImports, tagSlugs: i.tagSlugs })}`,
    input: z
      .object({
        metadataFilter: z.string().max(4_000).optional(),
        projectId: z.string().max(4_000).optional(),
        environment: z.string().max(4_000).optional(),
        secretPath: z.string().max(4_000).optional(),
        viewSecretValue: z.enum(["true", "false"]).optional(),
        expandSecretReferences: z.enum(["true", "false"]).optional(),
        recursive: z.enum(["true", "false"]).optional(),
        includePersonalOverrides: z.enum(["true", "false"]).optional(),
        includeImports: z.enum(["true", "false"]).optional(),
        tagSlugs: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-secret",
    name: "Get Secret",
    description: "Retrieve a single secret by name from a project environment.",
    method: "GET",
    url: (i) =>
      `/api/v4/secrets/${restSegment(i.secretName)}${restQuery({ projectId: i.projectId, environment: i.environment, secretPath: i.secretPath, version: i.version, type: i.type, viewSecretValue: i.viewSecretValue, expandSecretReferences: i.expandSecretReferences, includeImports: i.includeImports })}`,
    input: z
      .object({
        secretName: z.string().max(4_000),
        projectId: z.string().max(4_000),
        environment: z.string().max(4_000).optional(),
        secretPath: z.string().max(4_000).optional(),
        version: z.number().optional(),
        type: z.enum(["shared", "personal"]).optional(),
        viewSecretValue: z.enum(["true", "false"]).optional(),
        expandSecretReferences: z.enum(["true", "false"]).optional(),
        includeImports: z.enum(["true", "false"]).optional(),
      })
      .strict(),
  },
  {
    action: "create-secret",
    name: "Create Secret",
    description: "Create a new secret in a project environment.",
    method: "POST",
    url: "/api/v4/secrets/move",
    input: z
      .object({
        projectId: z.string().max(4_000),
        sourceEnvironment: z.string().max(4_000),
        sourceSecretPath: z.string().max(4_000).optional(),
        destinationEnvironment: z.string().max(4_000),
        destinationSecretPath: z.string().max(4_000).optional(),
        secretIds: SpecArray,
        shouldOverwrite: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      projectId: i.projectId,
      sourceEnvironment: i.sourceEnvironment,
      ...(i.sourceSecretPath !== undefined
        ? { sourceSecretPath: i.sourceSecretPath }
        : {}),
      destinationEnvironment: i.destinationEnvironment,
      ...(i.destinationSecretPath !== undefined
        ? { destinationSecretPath: i.destinationSecretPath }
        : {}),
      secretIds: i.secretIds,
      ...(i.shouldOverwrite !== undefined
        ? { shouldOverwrite: i.shouldOverwrite }
        : {}),
    }),
  },
  {
    action: "update-secret",
    name: "Update Secret",
    description: "Update an existing secret in a project environment.",
    method: "POST",
    url: (i) => `/api/v4/secrets/${restSegment(i.secretName)}`,
    input: z
      .object({
        secretName: z.string().max(4_000),
        projectId: z.string().max(4_000),
        environment: z.string().max(4_000),
        secretPath: z.string().max(4_000).optional(),
        secretValue: z.string().max(4_000),
        secretComment: z.string().max(4_000).optional(),
        secretMetadata: SpecArray.optional(),
        tagIds: SpecArray.optional(),
        skipMultilineEncoding: z.boolean().optional(),
        type: z.enum(["shared", "personal"]).optional(),
        secretReminderRepeatDays: z.number().optional(),
        secretReminderNote: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      projectId: i.projectId,
      environment: i.environment,
      ...(i.secretPath !== undefined ? { secretPath: i.secretPath } : {}),
      secretValue: i.secretValue,
      ...(i.secretComment !== undefined
        ? { secretComment: i.secretComment }
        : {}),
      ...(i.secretMetadata !== undefined
        ? { secretMetadata: i.secretMetadata }
        : {}),
      ...(i.tagIds !== undefined ? { tagIds: i.tagIds } : {}),
      ...(i.skipMultilineEncoding !== undefined
        ? { skipMultilineEncoding: i.skipMultilineEncoding }
        : {}),
      ...(i.type !== undefined ? { type: i.type } : {}),
      ...(i.secretReminderRepeatDays !== undefined
        ? { secretReminderRepeatDays: i.secretReminderRepeatDays }
        : {}),
      ...(i.secretReminderNote !== undefined
        ? { secretReminderNote: i.secretReminderNote }
        : {}),
    }),
  },
  {
    action: "delete-secret",
    name: "Delete Secret",
    description: "Delete a secret from a project environment.",
    method: "DELETE",
    url: (i) => `/api/v4/secrets/${restSegment(i.secretName)}`,
    input: z
      .object({
        secretName: z.string().max(4_000),
        projectId: z.string().max(4_000),
        environment: z.string().max(4_000),
        secretPath: z.string().max(4_000).optional(),
        type: z.enum(["shared", "personal"]).optional(),
      })
      .strict(),
    body: (i) => ({
      projectId: i.projectId,
      environment: i.environment,
      ...(i.secretPath !== undefined ? { secretPath: i.secretPath } : {}),
      ...(i.type !== undefined ? { type: i.type } : {}),
    }),
    emptyResponse: "optional",
  },
];

export function createInfisicalPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "infisical",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
  });
}
