import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Granola's published OpenAPI document:
 * https://docs.granola.ai/api-reference/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Granola publishes no maintained Node SDK; its OpenAPI document at https://docs.granola.ai/api-reference/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-notes",
    name: "List Notes",
    description:
      "Lists meeting notes from Granola with optional date filters and pagination.",
    method: "GET",
    url: (i) =>
      `/v1/notes${restQuery({ created_before: i.createdBefore, created_after: i.createdAfter, updated_after: i.updatedAfter, folder_id: i.folderId, cursor: i.cursor, page_size: i.pageSize })}`,
    input: z
      .object({
        createdBefore: z.string().max(4_000).optional(),
        createdAfter: z.string().max(4_000).optional(),
        updatedAfter: z.string().max(4_000).optional(),
        folderId: z.string().max(4_000).optional(),
        cursor: z.string().max(4_000).optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "get-note",
    name: "Get Note",
    description:
      "Retrieves a specific meeting note from Granola by ID, including summary, attendees, calendar event details, and optionally the transcript.",
    method: "GET",
    url: (i) =>
      `/v1/notes/${restSegment(i.noteId)}${restQuery({ include: i.include })}`,
    input: z
      .object({
        noteId: z.string().max(4_000),
        include: z.enum(["transcript"]).optional(),
      })
      .strict(),
  },
  {
    action: "list-folders",
    name: "List Folders",
    description:
      "Lists folders from Granola, sorted alphabetically, with pagination.",
    method: "GET",
    url: (i) =>
      `/v1/folders${restQuery({ cursor: i.cursor, page_size: i.pageSize })}`,
    input: z
      .object({
        cursor: z.string().max(4_000).optional(),
        pageSize: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
];

export function createGranolaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "granola",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
  });
}
