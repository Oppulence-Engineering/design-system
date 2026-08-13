import { z } from "zod";
import { requireOptionalSdk } from "../shared/optional-sdk";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import { createIntegrationTypedRestProvider } from "../../core/provider-rest";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";


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
  const { Client } = requireOptionalSdk("@googlemaps/google-maps-services-js") as {
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
