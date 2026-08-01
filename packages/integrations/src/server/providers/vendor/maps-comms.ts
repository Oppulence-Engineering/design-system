import { createRequire } from "node:module";

import { z } from "zod";

import { IntegrationProviderSdkError } from "../../provider-sdk";
import type { IntegrationProviderPack } from "../../provider-pack";
import { createIntegrationTypedRestProvider } from "../../provider-rest";
import type { IntegrationProviderSdk } from "../../provider-sdk";
import type { IntegrationApiKeyRuntime } from "../../api-key-runtime";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "./client";

const mapsRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

// --------------------------------------------------------------- Google Maps

/** A latitude/longitude pair, accepted as "lat,lng" or as two fields. */
function latLng(input: VendorInput, prefix = ""): string {
  const combined = optionalInputString(
    input,
    prefix ? `${prefix}Location` : "location",
  );
  if (combined) {
    if (!/^-?\d{1,3}(\.\d+)?,\s*-?\d{1,3}(\.\d+)?$/u.test(combined)) {
      throw invocationError();
    }
    return combined.replace(/\s/gu, "");
  }
  const lat = optionalInputNumber(input, prefix ? `${prefix}Lat` : "lat");
  const lng = optionalInputNumber(input, prefix ? `${prefix}Lng` : "lng");
  if (lat === undefined || lng === undefined) throw invocationError();
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw invocationError();
  return `${lat},${lng}`;
}

/**
 * The Maps SDK passes the key per request rather than at construction, so
 * every operation carries it. The executor supplies it from the credential.
 */
function mapsRequest(
  params: Record<string, unknown>,
): readonly [{ params: Record<string, unknown> }] {
  return [{ params }];
}

const MAPS_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "google-maps:geocode-address": {
    path: ["geocode"],
    params: (i) =>
      mapsRequest(
        definedFields({
          address: requiredInputString(i, "address"),
          region: optionalInputString(i, "region"),
        }),
      ),
  },
  "google-maps:reverse-geocode": {
    path: ["reverseGeocode"],
    params: (i) => mapsRequest({ latlng: latLng(i) }),
  },
  "google-maps:get-directions": {
    path: ["directions"],
    params: (i) =>
      mapsRequest(
        definedFields({
          origin: requiredInputString(i, "origin"),
          destination: requiredInputString(i, "destination"),
          mode: optionalInputString(i, "mode"),
          waypoints: optionalInputStringArray(i, "waypoints"),
          departure_time: optionalInputString(i, "departureTime"),
        }),
      ),
  },
  "google-maps:distance-matrix": {
    path: ["distancematrix"],
    params: (i) =>
      mapsRequest(
        definedFields({
          origins: requiredInputStringArray(i, "origins", "origin"),
          destinations: requiredInputStringArray(
            i,
            "destinations",
            "destination",
          ),
          mode: optionalInputString(i, "mode"),
        }),
      ),
  },
  "google-maps:search-places": {
    path: ["textSearch"],
    params: (i) =>
      mapsRequest(
        definedFields({
          query: requiredInputString(i, "query", "search"),
          type: optionalInputString(i, "type"),
          region: optionalInputString(i, "region"),
        }),
      ),
  },
  "google-maps:nearby-places": {
    path: ["placesNearby"],
    params: (i) =>
      mapsRequest(
        definedFields({
          location: latLng(i),
          radius: optionalInputNumber(i, "radius") ?? 1_000,
          type: optionalInputString(i, "type"),
          keyword: optionalInputString(i, "keyword"),
        }),
      ),
  },
  "google-maps:place-details": {
    path: ["placeDetails"],
    params: (i) =>
      mapsRequest(
        definedFields({
          place_id: requiredInputString(i, "placeId"),
          fields: optionalInputStringArray(i, "fields"),
        }),
      ),
  },
  "google-maps:get-elevation": {
    path: ["elevation"],
    params: (i) => mapsRequest({ locations: [latLng(i)] }),
  },
  "google-maps:get-timezone": {
    path: ["timezone"],
    params: (i) =>
      mapsRequest({
        location: latLng(i),
        timestamp:
          optionalInputNumber(i, "timestamp") ?? Math.floor(Date.now() / 1_000),
      }),
  },
  "google-maps:snap-to-roads": {
    path: ["snapToRoads"],
    params: (i) =>
      mapsRequest({
        path: requiredInputStringArray(i, "path", "points"),
        interpolate: i.interpolate === true,
      }),
  },
  "google-maps:geolocate-wifi-cell": {
    path: ["geolocate"],
    params: (i) => [
      {
        data: definedFields({
          considerIp: i.considerIp !== false,
          wifiAccessPoints: i.wifiAccessPoints,
          cellTowers: i.cellTowers,
        }),
      },
    ],
  },
};

/**
 * Five source actions belong to Google Maps Platform APIs on their own hosts —
 * addressvalidation, roads speed-limits, airquality, pollen, and solar. The
 * SDK does not cover them, and the typed REST lane resolves relative paths
 * against one configured provider host, so it cannot reach a second one
 * either. They stay deferred rather than gaining a per-tool host override,
 * which would undo the relative-URL guard that keeps a caller from choosing
 * the destination.
 */
const MAPS_DEFERRED_REASON =
  "@googlemaps/google-maps-services-js@3.4.2 does not cover this API, and it lives on its own Google Maps Platform host, which the single-host typed REST executor cannot address.";

/** The Maps SDK reads its key from each request's params. */
export const createGoogleMapsClient: VendorClientFactory = (credential) => {
  const { Client } = mapsRequire("@googlemaps/google-maps-services-js") as {
    Client: new (config?: Record<string, unknown>) => SdkMethodTarget;
  };
  const client = new Client({});
  const key = vendorToken(credential);
  // Inject the key into every call rather than repeating it in each mapping.
  return new Proxy(client, {
    get(target, property: string) {
      const value = (target as Record<string, unknown>)[property];
      if (typeof value !== "function") return value;
      return (request: { params?: Record<string, unknown>; data?: unknown }) =>
        (value as (input: unknown) => unknown).call(target, {
          ...request,
          params: { ...(request?.params ?? {}), key },
        });
    },
  }) as SdkMethodTarget;
};

export function createGoogleMapsPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  const pack = createVendorPack({
    integrationId: "google-maps",
    driver: "@googlemaps/google-maps-services-js@3.4.2",
    transportKind: "api_key",
    operations: MAPS_OPERATIONS,
    clientFactory: options.clientFactory ?? createGoogleMapsClient,
  });
  return {
    ...pack,
    coverage: pack.coverage.map((entry) =>
      entry.disposition === "deferred"
        ? { ...entry, reason: MAPS_DEFERRED_REASON }
        : entry,
    ),
  };
}

// -------------------------------------------------------------- Twilio Voice

const TWILIO_VOICE_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "twilio-voice:make-call": {
    path: ["calls", "create"],
    params: (i) => [
      definedFields({
        to: requiredInputString(i, "to"),
        from: requiredInputString(i, "from"),
        // Twilio needs instructions for the call: a TwiML document or a URL
        // that returns one.
        twiml: optionalInputString(i, "twiml"),
        url: optionalInputString(i, "url"),
        statusCallback: optionalInputString(i, "statusCallback"),
        record: i.record === true ? true : undefined,
      }),
    ],
  },
  "twilio-voice:list-calls": {
    path: ["calls", "list"],
    params: (i) => [
      definedFields({
        to: optionalInputString(i, "to"),
        from: optionalInputString(i, "from"),
        status: optionalInputString(i, "status"),
        limit: optionalInputNumber(i, "limit") ?? 50,
      }),
    ],
  },
  "twilio-voice:get-recording": {
    path: ["recordings"],
    invoke: ({ client, input }) => {
      const recordings = (
        client as unknown as {
          recordings: (sid: string) => { fetch(): Promise<unknown> };
        }
      ).recordings;
      const sid = requiredInputString(input, "recordingSid", "sid");
      if (!/^RE[a-f0-9]{32}$/iu.test(sid)) throw invocationError();
      return recordings(sid).fetch();
    },
  },
};

/** Twilio authenticates with an account SID and an auth token. */
export const createTwilioClient: VendorClientFactory = (credential) => {
  const twilio = mapsRequire("twilio") as (
    accountSid: string,
    authToken: string,
  ) => SdkMethodTarget;
  return twilio(
    requiredVendorField(credential, "accountSid"),
    vendorToken(credential),
  );
};

export function createTwilioVoicePack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "twilio-voice",
    driver: "twilio@6.0.2",
    transportKind: "api_key",
    operations: TWILIO_VOICE_OPERATIONS,
    clientFactory: options.clientFactory ?? createTwilioClient,
  });
}

// ------------------------------------------------------------ Google AppSheet

const APPSHEET_SDK_REVIEW =
  "AppSheet is not a googleapis service and has no published Node SDK; its API is a single Action endpoint per table.";

const AppSheetRowsSchema = z
  .object({
    appId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9._-]+$/u),
    tableName: z.string().min(1).max(128),
    rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
    properties: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const AppSheetResponseSchema = z
  .object({ Rows: z.array(z.record(z.string(), z.unknown())) })
  .loose();

/**
 * Every AppSheet action posts to the same table endpoint and differs only in
 * the Action field, so the four source actions share one request shape.
 */
function appSheetTool(
  id: string,
  name: string,
  description: string,
  action: "Find" | "Add" | "Edit" | "Delete",
) {
  return {
    id,
    name,
    description,
    version: "1.0.0",
    params: {
      appId: {
        type: "string",
        required: true,
        visibility: "user-or-llm" as const,
      },
      tableName: {
        type: "string",
        required: true,
        visibility: "user-or-llm" as const,
      },
      rows: {
        type: "array",
        required: action !== "Find",
        visibility: "user-or-llm" as const,
      },
      properties: { type: "object", visibility: "user-or-llm" as const },
    },
    request: {
      method: "POST" as const,
      url: (input: { appId: string; tableName: string }) =>
        `/api/v2/apps/${encodeURIComponent(input.appId)}/tables/${encodeURIComponent(input.tableName)}/Action`,
      headers: () => ({ accept: "application/json" }),
      body: (input: {
        rows?: unknown[];
        properties?: Record<string, unknown>;
      }) => ({
        Action: action,
        Properties: input.properties ?? {},
        Rows: input.rows ?? [],
      }),
    },
    inputSchema:
      action === "Find"
        ? AppSheetRowsSchema.extend({
            rows: AppSheetRowsSchema.shape.rows.optional(),
          })
        : AppSheetRowsSchema,
    outputSchema: AppSheetResponseSchema,
    maxResponseBytes: 512 * 1024,
  };
}

export interface GoogleAppSheetProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "request">;
}

export function createGoogleAppSheetProviderSdk(
  config: GoogleAppSheetProviderSdkConfig,
): IntegrationProviderSdk {
  return createIntegrationTypedRestProvider({
    integrationId: "google-appsheet",
    transport: { kind: "api_key", runtime: config.apiKeyRuntime },
    tools: [
      appSheetTool(
        "google-appsheet:find-rows",
        "Find Rows",
        "Read rows from an AppSheet table.",
        "Find",
      ),
      appSheetTool(
        "google-appsheet:add-rows",
        "Add Rows",
        "Add new rows to an AppSheet table.",
        "Add",
      ),
      appSheetTool(
        "google-appsheet:edit-rows",
        "Edit Rows",
        "Update existing rows in an AppSheet table.",
        "Edit",
      ),
      appSheetTool(
        "google-appsheet:delete-rows",
        "Delete Rows",
        "Delete rows from an AppSheet table.",
        "Delete",
      ),
    ],
  });
}

export function createGoogleAppSheetPack(): IntegrationProviderPack {
  const ids = [
    "google-appsheet:find-rows",
    "google-appsheet:add-rows",
    "google-appsheet:edit-rows",
    "google-appsheet:delete-rows",
  ];
  return {
    integrationId: "google-appsheet",
    coverage: ids.map((sourceOperationId) => ({
      sourceOperationId,
      lane: "typed_rest" as const,
      disposition: "supported" as const,
      sdkReview: APPSHEET_SDK_REVIEW,
    })),
    triggerCoverage: [],
    create(context) {
      if (!context.apiKeyRuntime) return [];
      return [
        createGoogleAppSheetProviderSdk({
          apiKeyRuntime: context.apiKeyRuntime,
        }),
      ];
    },
  };
}
