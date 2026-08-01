import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Quartr's published OpenAPI document:
 * https://quartr.com/docs/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Quartr publishes no maintained Node SDK; its OpenAPI document at https://quartr.com/docs/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-companies",
    name: "List Companies",
    description:
      "List companies covered by Quartr, filterable by ticker, ISIN, CIK, OpenFIGI, country, and exchange.",
    method: "GET",
    url: (i) =>
      `/companies${restQuery({ countries: i.countries, exchanges: i.exchanges, tickers: i.tickers, limit: i.limit, cursor: i.cursor, direction: i.direction, isins: i.isins, ciks: i.ciks, openfigis: i.openfigis, updatedBefore: i.updatedBefore, updatedAfter: i.updatedAfter, ids: i.ids })}`,
    input: z
      .object({
        countries: z.string().max(4_000).optional(),
        exchanges: z.string().max(4_000).optional(),
        tickers: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
        isins: z.string().max(4_000).optional(),
        ciks: z.string().max(4_000).optional(),
        openfigis: z.string().max(4_000).optional(),
        updatedBefore: z.string().max(4_000).optional(),
        updatedAfter: z.string().max(4_000).optional(),
        ids: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-company",
    name: "Get Company",
    description: "Retrieve a single company from Quartr by its company ID.",
    method: "GET",
    url: (i) => `/companies/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
  },
  {
    action: "list-events",
    name: "List Events",
    description:
      "List corporate events (earnings calls, capital markets days, etc.) from Quartr, filterable by company, event type, and date range.",
    method: "GET",
    url: (i) =>
      `/events${restQuery({ countries: i.countries, exchanges: i.exchanges, tickers: i.tickers, limit: i.limit, cursor: i.cursor, direction: i.direction, endDate: i.endDate, startDate: i.startDate, isins: i.isins, ciks: i.ciks, typeIds: i.typeIds, companyIds: i.companyIds, sortBy: i.sortBy, updatedBefore: i.updatedBefore, updatedAfter: i.updatedAfter })}`,
    input: z
      .object({
        countries: z.string().max(4_000).optional(),
        exchanges: z.string().max(4_000).optional(),
        tickers: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
        endDate: z.string().max(4_000).optional(),
        startDate: z.string().max(4_000).optional(),
        isins: z.string().max(4_000).optional(),
        ciks: z.string().max(4_000).optional(),
        typeIds: z.string().max(4_000).optional(),
        companyIds: z.string().max(4_000).optional(),
        sortBy: z.enum(["id", "date"]).optional(),
        updatedBefore: z.string().max(4_000).optional(),
        updatedAfter: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-event",
    name: "Get Event",
    description:
      "Retrieve a single corporate event from Quartr by its event ID.",
    method: "GET",
    url: (i) => `/events/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
  },
  {
    action: "list-event-types",
    name: "List Event Types",
    description:
      "List the event types available in Quartr (e.g., earnings calls), useful for filtering events by type ID.",
    method: "GET",
    url: (i) =>
      `/event-types${restQuery({ limit: i.limit, cursor: i.cursor, direction: i.direction })}`,
    input: z
      .object({
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
      })
      .strict(),
  },
  {
    action: "list-documents",
    name: "List Documents",
    description:
      "List documents of all kinds (reports, slide decks, and transcripts) from Quartr, filterable by company, event, document type, document group, and date range.",
    method: "GET",
    url: (i) =>
      `/documents${restQuery({ countries: i.countries, exchanges: i.exchanges, tickers: i.tickers, limit: i.limit, cursor: i.cursor, direction: i.direction, endDate: i.endDate, startDate: i.startDate, typeIds: i.typeIds, isins: i.isins, ciks: i.ciks, companyIds: i.companyIds, eventIds: i.eventIds, documentGroupIds: i.documentGroupIds, updatedBefore: i.updatedBefore, updatedAfter: i.updatedAfter, expand: i.expand })}`,
    input: z
      .object({
        countries: z.string().max(4_000).optional(),
        exchanges: z.string().max(4_000).optional(),
        tickers: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
        endDate: z.string().max(4_000).optional(),
        startDate: z.string().max(4_000).optional(),
        typeIds: z.string().max(4_000).optional(),
        isins: z.string().max(4_000).optional(),
        ciks: z.string().max(4_000).optional(),
        companyIds: z.string().max(4_000).optional(),
        eventIds: z.string().max(4_000).optional(),
        documentGroupIds: z.string().max(4_000).optional(),
        updatedBefore: z.string().max(4_000).optional(),
        updatedAfter: z.string().max(4_000).optional(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-document-types",
    name: "List Document Types",
    description:
      "List the document types available in Quartr (e.g., 10-Q quarterly reports), useful for filtering documents by type ID.",
    method: "GET",
    url: (i) =>
      `/document-types${restQuery({ limit: i.limit, cursor: i.cursor, direction: i.direction })}`,
    input: z
      .object({
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
      })
      .strict(),
  },
  {
    action: "list-reports",
    name: "List Reports",
    description:
      "List filings and reports (10-K, 10-Q, earnings releases, etc.) from Quartr, filterable by company, event, document type, document group, and date range.",
    method: "GET",
    url: (i) =>
      `/documents/reports${restQuery({ countries: i.countries, exchanges: i.exchanges, tickers: i.tickers, limit: i.limit, cursor: i.cursor, direction: i.direction, endDate: i.endDate, startDate: i.startDate, typeIds: i.typeIds, isins: i.isins, ciks: i.ciks, companyIds: i.companyIds, eventIds: i.eventIds, documentGroupIds: i.documentGroupIds, updatedBefore: i.updatedBefore, updatedAfter: i.updatedAfter, expand: i.expand })}`,
    input: z
      .object({
        countries: z.string().max(4_000).optional(),
        exchanges: z.string().max(4_000).optional(),
        tickers: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
        endDate: z.string().max(4_000).optional(),
        startDate: z.string().max(4_000).optional(),
        typeIds: z.string().max(4_000).optional(),
        isins: z.string().max(4_000).optional(),
        ciks: z.string().max(4_000).optional(),
        companyIds: z.string().max(4_000).optional(),
        eventIds: z.string().max(4_000).optional(),
        documentGroupIds: z.string().max(4_000).optional(),
        updatedBefore: z.string().max(4_000).optional(),
        updatedAfter: z.string().max(4_000).optional(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-report",
    name: "Get Report",
    description:
      "Retrieve a filing or report (10-K, 10-Q, earnings release, etc.) from Quartr by its document ID and download the PDF file.",
    method: "GET",
    url: (i) =>
      `/documents/reports/${restSegment(i.id)}${restQuery({ expand: i.expand })}`,
    input: z
      .object({
        id: z.number(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-transcripts",
    name: "List Transcripts",
    description:
      "List event transcripts from Quartr, filterable by company, event, document type, document group, and date range.",
    method: "GET",
    url: (i) =>
      `/documents/transcripts${restQuery({ countries: i.countries, exchanges: i.exchanges, tickers: i.tickers, limit: i.limit, cursor: i.cursor, direction: i.direction, endDate: i.endDate, startDate: i.startDate, typeIds: i.typeIds, isins: i.isins, ciks: i.ciks, companyIds: i.companyIds, eventIds: i.eventIds, documentGroupIds: i.documentGroupIds, updatedBefore: i.updatedBefore, updatedAfter: i.updatedAfter, expand: i.expand })}`,
    input: z
      .object({
        countries: z.string().max(4_000).optional(),
        exchanges: z.string().max(4_000).optional(),
        tickers: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
        endDate: z.string().max(4_000).optional(),
        startDate: z.string().max(4_000).optional(),
        typeIds: z.string().max(4_000).optional(),
        isins: z.string().max(4_000).optional(),
        ciks: z.string().max(4_000).optional(),
        companyIds: z.string().max(4_000).optional(),
        eventIds: z.string().max(4_000).optional(),
        documentGroupIds: z.string().max(4_000).optional(),
        updatedBefore: z.string().max(4_000).optional(),
        updatedAfter: z.string().max(4_000).optional(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-transcript",
    name: "Get Transcript",
    description:
      "Retrieve an event transcript from Quartr by its document ID and download the transcript JSON file (paragraphs, sentences, timestamps, and speaker identification).",
    method: "GET",
    url: (i) =>
      `/documents/transcripts/${restSegment(i.id)}${restQuery({ expand: i.expand })}`,
    input: z
      .object({
        id: z.number(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-audio",
    name: "List Audio",
    description:
      "List archived event audio recordings from Quartr, filterable by company, event, and date range. Returns download (MPEG) and streaming (M3U8) URLs.",
    method: "GET",
    url: (i) =>
      `/audio${restQuery({ countries: i.countries, exchanges: i.exchanges, tickers: i.tickers, limit: i.limit, cursor: i.cursor, direction: i.direction, endDate: i.endDate, startDate: i.startDate, isins: i.isins, ciks: i.ciks, companyIds: i.companyIds, eventIds: i.eventIds, updatedBefore: i.updatedBefore, updatedAfter: i.updatedAfter, expand: i.expand })}`,
    input: z
      .object({
        countries: z.string().max(4_000).optional(),
        exchanges: z.string().max(4_000).optional(),
        tickers: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
        endDate: z.string().max(4_000).optional(),
        startDate: z.string().max(4_000).optional(),
        isins: z.string().max(4_000).optional(),
        ciks: z.string().max(4_000).optional(),
        companyIds: z.string().max(4_000).optional(),
        eventIds: z.string().max(4_000).optional(),
        updatedBefore: z.string().max(4_000).optional(),
        updatedAfter: z.string().max(4_000).optional(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-audio",
    name: "Get Audio",
    description:
      "Retrieve an archived event audio recording from Quartr by its audio ID. Returns download (MPEG) and streaming (M3U8) URLs.",
    method: "GET",
    url: (i) => `/audio/${restSegment(i.id)}${restQuery({ expand: i.expand })}`,
    input: z
      .object({
        id: z.number(),
        expand: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "list-live-events",
    name: "List Live Events",
    description:
      "List live and upcoming events from Quartr with live audio and transcript stream URLs, filterable by company, live state, and date range.",
    method: "GET",
    url: (i) =>
      `/live${restQuery({ countries: i.countries, exchanges: i.exchanges, tickers: i.tickers, limit: i.limit, cursor: i.cursor, direction: i.direction, isins: i.isins, ciks: i.ciks, companyIds: i.companyIds, eventIds: i.eventIds, states: i.states, transcriptVersion: i.transcriptVersion, endDate: i.endDate, startDate: i.startDate, updatedBefore: i.updatedBefore, updatedAfter: i.updatedAfter })}`,
    input: z
      .object({
        countries: z.string().max(4_000).optional(),
        exchanges: z.string().max(4_000).optional(),
        tickers: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        cursor: z.number().optional(),
        direction: z.enum(["asc", "desc"]).optional(),
        isins: z.string().max(4_000).optional(),
        ciks: z.string().max(4_000).optional(),
        companyIds: z.string().max(4_000).optional(),
        eventIds: z.string().max(4_000).optional(),
        states: z.string().max(4_000).optional(),
        transcriptVersion: z.enum(["1.6", "1.7"]).optional(),
        endDate: z.string().max(4_000).optional(),
        startDate: z.string().max(4_000).optional(),
        updatedBefore: z.string().max(4_000).optional(),
        updatedAfter: z.string().max(4_000).optional(),
      })
      .strict(),
  },
];

export function createQuartrPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "quartr",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "get-event-summary":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "list-slide-decks":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-slide-deck":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
